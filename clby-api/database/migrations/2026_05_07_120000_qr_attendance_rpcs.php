<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Codify the three QR-related Postgres RPCs that the controllers
     * reference at runtime. These functions exist in production today
     * (loaded manually during the original Supabase → Laravel migration)
     * but had no migration, so a fresh deploy or test database had no
     * way to recreate them.
     *
     *   - validate_gym_qr_token(p_token)        → JSON {valid, branch_id?, reason?}
     *   - regenerate_branch_qr_token(branch, gym) → uuid (new token)
     *   - log_gym_attendance_by_token(member, token) → JSON {status, reason?}
     *
     * Definitions match what's currently in production (extracted via
     * pg_get_functiondef on 2026-05-07). Use CREATE OR REPLACE so this
     * migration is idempotent on databases that already have them.
     */
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.validate_gym_qr_token(p_token uuid)
            RETURNS json
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path TO 'public'
            AS $$
            DECLARE
                v_branch RECORD;
            BEGIN
                SELECT id, gym_id, is_active INTO v_branch
                FROM branches WHERE qr_token = p_token;

                IF NOT FOUND THEN
                    RETURN json_build_object('valid', false, 'reason', 'invalid_qr_token');
                END IF;
                IF NOT v_branch.is_active THEN
                    RETURN json_build_object('valid', false, 'reason', 'branch_inactive');
                END IF;

                RETURN json_build_object('valid', true, 'branch_id', v_branch.id::text);
            END;
            $$;
        SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.regenerate_branch_qr_token(p_branch_id uuid, p_gym_id uuid)
            RETURNS uuid
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                v_new_token UUID := gen_random_uuid();
            BEGIN
                UPDATE branches
                SET qr_token = v_new_token
                WHERE id = p_branch_id AND gym_id = p_gym_id;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Branch not found';
                END IF;

                RETURN v_new_token;
            END;
            $$;
        SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION public.log_gym_attendance_by_token(p_gym_member_id uuid, p_token uuid)
            RETURNS json
            LANGUAGE plpgsql
            AS $$
            DECLARE
                v_branch RECORD;
            BEGIN
                SELECT id, gym_id, is_active, name
                INTO v_branch
                FROM branches
                WHERE qr_token = p_token;

                IF NOT FOUND THEN
                    RETURN json_build_object('status', 'denied', 'reason', 'invalid_qr_token');
                END IF;
                IF NOT v_branch.is_active THEN
                    RETURN json_build_object('status', 'denied', 'reason', 'branch_inactive');
                END IF;

                INSERT INTO attendance_logs (
                    gym_member_id, gym_id, branch_id,
                    check_in_at, method, access_point
                )
                VALUES (
                    p_gym_member_id, v_branch.gym_id, v_branch.id,
                    NOW(), 'qr', COALESCE(v_branch.name, 'Gym Main Entrance')
                );

                RETURN json_build_object('status', 'allowed');
            END;
            $$;
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP FUNCTION IF EXISTS public.log_gym_attendance_by_token(uuid, uuid)');
        DB::statement('DROP FUNCTION IF EXISTS public.regenerate_branch_qr_token(uuid, uuid)');
        DB::statement('DROP FUNCTION IF EXISTS public.validate_gym_qr_token(uuid)');
    }
};
