--
-- PostgreSQL database dump
--

\restrict zjS9icMtAMYnmguJ7bLubBUp4MrRdB1Hac7D1wWJyh4zMKmKUX8cSJnL53YvyBZ

-- Dumped from database version 17.9 (Homebrew)
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: rtg
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO rtg;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: rtg
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$ SELECT '{}'::jsonb; $$;


ALTER FUNCTION auth.jwt() OWNER TO rtg;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: rtg
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$ SELECT 'authenticated'::text; $$;


ALTER FUNCTION auth.role() OWNER TO rtg;

--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: rtg
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ SELECT gen_random_uuid(); $$;


ALTER FUNCTION auth.uid() OWNER TO rtg;

--
-- Name: add_attendance_log(uuid, uuid, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.add_attendance_log(p_gym_id uuid, p_gym_member_id uuid, p_check_in_at timestamp with time zone DEFAULT now(), p_access_point text DEFAULT NULL::text, p_method text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Verify member exists in this gym
  IF NOT EXISTS (
    SELECT 1 FROM gym_members
    WHERE id = p_gym_member_id AND gym_id = p_gym_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  INSERT INTO attendance_logs (gym_id, gym_member_id, check_in_at, method, access_point)
  VALUES (p_gym_id, p_gym_member_id, p_check_in_at, p_method, COALESCE(p_access_point, 'Gym Main Entrance'))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION public.add_attendance_log(p_gym_id uuid, p_gym_member_id uuid, p_check_in_at timestamp with time zone, p_access_point text, p_method text) OWNER TO rtg;

--
-- Name: add_booking(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.add_booking(p_session_id uuid, p_gym_member_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                                                                          
  DECLARE
    v_id uuid;                                                                                                   
  BEGIN                                                     
    -- Upsert: if a cancelled booking exists, restore it; otherwise insert
    INSERT INTO public.session_bookings (session_id, gym_member_id, status)
    VALUES (p_session_id, p_gym_member_id, 'confirmed')                                                          
    ON CONFLICT (session_id, gym_member_id)
    DO UPDATE SET status = 'confirmed', updated_at = now()                                                       
    RETURNING id INTO v_id;                                 
                                                                                                                 
    RETURN v_id;
  END;                                                                                                           
  $$;


ALTER FUNCTION public.add_booking(p_session_id uuid, p_gym_member_id uuid) OWNER TO rtg;

--
-- Name: add_class(uuid, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.add_class(p_gym_id uuid, p_name text, p_class_type text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_instructor text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_color text DEFAULT '#7c3aed'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE v_id uuid;
  BEGIN
    INSERT INTO public.classes (gym_id, name, type, description, instructor, location, color, status)
    VALUES (p_gym_id, p_name, p_class_type, p_description, p_instructor, p_location, p_color, 'active')
    RETURNING id INTO v_id;                                                                                      
    RETURN v_id;
  END;                                                                                                           
  $$;


ALTER FUNCTION public.add_class(p_gym_id uuid, p_name text, p_class_type text, p_description text, p_instructor text, p_location text, p_color text) OWNER TO rtg;

--
-- Name: add_payment(uuid, uuid, uuid, numeric, text, text, text, text, timestamp with time zone, text, numeric, numeric, uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.add_payment(p_gym_id uuid, p_gym_member_id uuid, p_membership_id uuid DEFAULT NULL::uuid, p_amount numeric DEFAULT 0, p_currency text DEFAULT 'EGP'::text, p_payment_method text DEFAULT 'cash'::text, p_status text DEFAULT 'pending'::text, p_notes text DEFAULT NULL::text, p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_source text DEFAULT 'admin'::text, p_original_amount numeric DEFAULT 0, p_discount_amount numeric DEFAULT 0, p_promo_code_id uuid DEFAULT NULL::uuid, p_plan_promotion_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE v_id uuid;
  BEGIN
    INSERT INTO public.payments (
      gym_id, gym_member_id, membership_id, amount, currency,
      payment_method, status, notes, paid_at, source,
      original_amount, discount_amount, promo_code_id, plan_promotion_id
    ) VALUES (
      p_gym_id, p_gym_member_id, p_membership_id, p_amount, p_currency,
      p_payment_method, p_status, p_notes, p_paid_at, p_source,
      p_original_amount, p_discount_amount, p_promo_code_id, p_plan_promotion_id
    ) RETURNING id INTO v_id;
    RETURN v_id;
  END;                                                                                                           
  $$;


ALTER FUNCTION public.add_payment(p_gym_id uuid, p_gym_member_id uuid, p_membership_id uuid, p_amount numeric, p_currency text, p_payment_method text, p_status text, p_notes text, p_paid_at timestamp with time zone, p_source text, p_original_amount numeric, p_discount_amount numeric, p_promo_code_id uuid, p_plan_promotion_id uuid) OWNER TO rtg;

--
-- Name: add_plan_promotion(uuid, uuid, numeric, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.add_plan_promotion(p_gym_id uuid, p_plan_id uuid, p_promo_price numeric, p_valid_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_valid_until timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE v_id uuid;
  BEGIN
    INSERT INTO public.plan_promotions (gym_id, plan_id, promo_price, valid_from, valid_until)
    VALUES (p_gym_id, p_plan_id, p_promo_price, p_valid_from::date, p_valid_until::date)
    RETURNING id INTO v_id;
    RETURN v_id;
  END;
  $$;


ALTER FUNCTION public.add_plan_promotion(p_gym_id uuid, p_plan_id uuid, p_promo_price numeric, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone) OWNER TO rtg;

--
-- Name: add_promo_code(uuid, text, text, text, numeric, timestamp with time zone, timestamp with time zone, integer, integer); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.add_promo_code(p_gym_id uuid, p_code text, p_name text, p_discount_type text, p_discount_value numeric, p_valid_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_valid_until timestamp with time zone DEFAULT NULL::timestamp with time zone, p_max_uses integer DEFAULT NULL::integer, p_max_uses_per_member integer DEFAULT NULL::integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE v_id uuid;
  BEGIN
    INSERT INTO public.promo_codes (
      gym_id, code, name, discount_type, discount_value,
      valid_from, valid_until, max_uses, per_member_limit, is_active
    ) VALUES (
      p_gym_id, p_code, p_name, p_discount_type, p_discount_value,
      p_valid_from, p_valid_until, p_max_uses, COALESCE(p_max_uses_per_member, 1), true
    ) RETURNING id INTO v_id;
    RETURN v_id;
  END;
  $$;


ALTER FUNCTION public.add_promo_code(p_gym_id uuid, p_code text, p_name text, p_discount_type text, p_discount_value numeric, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone, p_max_uses integer, p_max_uses_per_member integer) OWNER TO rtg;

--
-- Name: add_session(uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.add_session(p_gym_id uuid, p_class_id uuid, p_session_date date, p_start_time time without time zone, p_end_time time without time zone, p_capacity integer DEFAULT NULL::integer, p_instructor text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_session_type text DEFAULT 'popup'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                           
  DECLARE v_id uuid;
  BEGIN                                                                                                          
    INSERT INTO public.class_sessions                       
      (gym_id, class_id, session_date, start_time, end_time, capacity, instructor, location, session_type)       
    VALUES
      (p_gym_id, p_class_id, p_session_date, p_start_time, p_end_time, p_capacity, p_instructor, p_location,     
  p_session_type)                                                                                                
    RETURNING id INTO v_id;
    RETURN v_id;                                                                                                 
  END;                                                                                                           
  $$;


ALTER FUNCTION public.add_session(p_gym_id uuid, p_class_id uuid, p_session_date date, p_start_time time without time zone, p_end_time time without time zone, p_capacity integer, p_instructor text, p_location text, p_session_type text) OWNER TO rtg;

--
-- Name: add_sessions(uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.add_sessions(p_membership_id uuid, p_extra_sessions integer, p_gym_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                   
  DECLARE                                                                                                  
    v_current_total     integer;                                                                           
    v_current_remaining integer;                                                                           
  BEGIN                                                                                                  
    -- Verify membership belongs to this gym and is sessions-based
    SELECT sessions_total, sessions_remaining                                                              
    INTO v_current_total, v_current_remaining                                                              
    FROM public.member_memberships                                                                         
    WHERE id = p_membership_id                                                                             
      AND gym_id = p_gym_id;                                                                               
  
    IF NOT FOUND THEN                                                                                      
      RETURN json_build_object('ok', false, 'error', 'Membership not found');                            
    END IF;                                                                                                
  
    IF v_current_total IS NULL THEN                                                                        
      RETURN json_build_object('ok', false, 'error', 'Membership is not sessions-based');                
    END IF;                                                                                                
  
    UPDATE public.member_memberships                                                                       
    SET sessions_total     = v_current_total + p_extra_sessions,                                         
        sessions_remaining = COALESCE(v_current_remaining, 0) + p_extra_sessions                           
    WHERE id = p_membership_id
      AND gym_id = p_gym_id;                                                                               
                                                                                                         
    RETURN json_build_object(
      'ok',                 true,
      'sessions_total',     v_current_total + p_extra_sessions,                                            
      'sessions_remaining', COALESCE(v_current_remaining, 0) + p_extra_sessions
    );                                                                                                     
  END;                                                                                                   
  $$;


ALTER FUNCTION public.add_sessions(p_membership_id uuid, p_extra_sessions integer, p_gym_id uuid) OWNER TO rtg;

--
-- Name: assert_gym_member(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.assert_gym_member(p_gym_id uuid) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM gym_members
    WHERE user_id = auth.uid() AND gym_id = p_gym_id AND deleted_at IS NULL
    UNION
    SELECT 1 FROM staff_members
    WHERE user_id = auth.uid() AND gym_id = p_gym_id AND deleted_at IS NULL
    UNION
    SELECT 1 FROM gyms
    WHERE id = p_gym_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this gym';
  END IF;
END;
$$;


ALTER FUNCTION public.assert_gym_member(p_gym_id uuid) OWNER TO rtg;

--
-- Name: cancel_session(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.cancel_session(p_id uuid, p_gym_id uuid, p_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                                                                                                                                                  
  BEGIN
    UPDATE public.class_sessions                                                                                                                                                         
    SET                                                                                                                                                                                  
      status              = 'cancelled',                                                                                                                                                 
      cancellation_reason = p_reason,                                                                                                                                                    
      updated_at          = now()                                                                                                                                                        
    WHERE id      = p_id                                                                                                                                                                 
      AND gym_id  = p_gym_id;                                                                                                                                                            
                                                                                                                                                                                         
    IF NOT FOUND THEN                                                                                                                                                                    
      RAISE EXCEPTION 'Session not found';                                                                                                                                               
    END IF;                                                                                                                                                                              
  END;                                                                                                                                                                                   
  $$;


ALTER FUNCTION public.cancel_session(p_id uuid, p_gym_id uuid, p_reason text) OWNER TO rtg;

--
-- Name: checkin_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.checkin_member(p_session_id uuid, p_gym_member_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                     
  DECLARE
    v_id uuid;
  BEGIN
    INSERT INTO public.session_bookings (session_id, gym_member_id, status)
    VALUES (p_session_id, p_gym_member_id, 'attended')
    ON CONFLICT (session_id, gym_member_id)                                                                      
    DO UPDATE SET status = 'attended', updated_at = now()
    RETURNING id INTO v_id;                                                                                      
                                                                                                                 
    RETURN v_id;
  END;                                                                                                           
  $$;


ALTER FUNCTION public.checkin_member(p_session_id uuid, p_gym_member_id uuid) OWNER TO rtg;

--
-- Name: consume_class_session(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.consume_class_session(p_gym_member_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_membership_id  uuid;
  v_session_count  integer;
  v_sessions_used  integer;
  v_new_used       integer;
BEGIN
  -- Find the active sessions-plan membership for this member
  SELECT mm.id, mp.session_count, COALESCE(mm.sessions_used, 0)
    INTO v_membership_id, v_session_count, v_sessions_used
    FROM member_memberships mm
    JOIN membership_plans   mp ON mp.id = mm.plan_id
   WHERE mm.gym_member_id = p_gym_member_id
     AND mm.status        = 'active'
     AND mp.plan_type     IN ('sessions', 'duration_session')
   LIMIT 1;

  IF v_membership_id IS NULL THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'no_sessions_plan');
  END IF;

  -- Increment, capped at session_count (if finite)
  v_new_used := v_sessions_used + 1;
  IF v_session_count IS NOT NULL AND v_new_used > v_session_count THEN
    v_new_used := v_session_count;
  END IF;

  UPDATE member_memberships
     SET sessions_used = v_new_used
   WHERE id = v_membership_id;

  RETURN jsonb_build_object(
    'updated',             true,
    'membership_id',       v_membership_id,
    'sessions_used',       v_new_used,
    'sessions_remaining',  GREATEST(0, COALESCE(v_session_count, 0) - v_new_used)
  );
END;
$$;


ALTER FUNCTION public.consume_class_session(p_gym_member_id uuid) OWNER TO rtg;

--
-- Name: create_recurring_session(uuid, uuid, date, time without time zone, time without time zone, integer, text, text); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.create_recurring_session(p_gym_id uuid, p_class_id uuid, p_start_date date, p_start_time time without time zone, p_end_time time without time zone, p_capacity integer DEFAULT NULL::integer, p_instructor text DEFAULT NULL::text, p_location text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$      
  DECLARE
    v_template_id uuid;
    v_date        date;
  BEGIN                                                                                                          
    -- Create template
    INSERT INTO public.recurring_session_templates                                                               
      (gym_id, class_id, day_of_week, start_time, end_time, capacity, instructor, location)
    VALUES
      (p_gym_id, p_class_id, EXTRACT(DOW FROM p_start_date)::int, p_start_time, p_end_time, p_capacity,
  p_instructor, p_location)                                                                                      
    RETURNING id INTO v_template_id;
                                                                                                                 
    -- Generate next 12 weeks of sessions                                                                        
    FOR i IN 0..11 LOOP
      v_date := p_start_date + (i * 7);                                                                          
      INSERT INTO public.class_sessions                                                                          
        (gym_id, class_id, recurring_template_id, session_date, start_time, end_time, capacity, instructor,
  location, session_type)                                                                                        
      VALUES                                                
        (p_gym_id, p_class_id, v_template_id, v_date, p_start_time, p_end_time, p_capacity, p_instructor,        
  p_location, 'recurring');                                                                                      
    END LOOP;
                                                                                                                 
    RETURN v_template_id;                                   
  END;
  $$;


ALTER FUNCTION public.create_recurring_session(p_gym_id uuid, p_class_id uuid, p_start_date date, p_start_time time without time zone, p_end_time time without time zone, p_capacity integer, p_instructor text, p_location text) OWNER TO rtg;

--
-- Name: custom_jwt_claims(jsonb); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.custom_jwt_claims(event jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_gym_id uuid;
BEGIN
  claims := event->'claims';

  SELECT role, gym_id INTO user_role, user_gym_id
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  IF user_gym_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{gym_id}', to_jsonb(user_gym_id::text));
  END IF;

  RETURN jsonb_build_object('claims', claims);
END;
$$;


ALTER FUNCTION public.custom_jwt_claims(event jsonb) OWNER TO rtg;

--
-- Name: decrement_session_booked_count(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.decrement_session_booked_count(p_session_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$                                             
    UPDATE public.class_sessions SET booked_count = GREATEST(0, booked_count - 1) WHERE id = p_session_id;                
  $$;


ALTER FUNCTION public.decrement_session_booked_count(p_session_id uuid) OWNER TO rtg;

--
-- Name: delete_class(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.delete_class(p_id uuid, p_gym_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN                                                                                                          
    DELETE FROM public.classes WHERE id = p_id AND gym_id = p_gym_id;
  END;                                                                                                           
  $$;


ALTER FUNCTION public.delete_class(p_id uuid, p_gym_id uuid) OWNER TO rtg;

--
-- Name: delete_own_account(); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.delete_own_account() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE gym_members
  SET deleted_at = now(), status = 'deleted', updated_at = now()
  WHERE user_id = v_user_id AND deleted_at IS NULL;

  UPDATE member_memberships
  SET status = 'cancelled', updated_at = now()
  WHERE gym_member_id IN (SELECT id FROM gym_members WHERE user_id = v_user_id)
    AND status IN ('active', 'frozen');

  UPDATE member_invitations
  SET status = 'invalidated'
  WHERE inviter_member_id IN (SELECT id FROM gym_members WHERE user_id = v_user_id)
    AND status = 'pending';

  UPDATE profiles
  SET is_active = false, account_status = 'paused', fcm_token = NULL, updated_at = now()
  WHERE id = v_user_id;

  UPDATE auth.users
  SET banned_until = '2999-12-31'::timestamptz, updated_at = now()
  WHERE id = v_user_id;
END;
$$;


ALTER FUNCTION public.delete_own_account() OWNER TO rtg;

--
-- Name: delete_payment(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.delete_payment(p_id uuid, p_gym_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                           
  BEGIN
    DELETE FROM public.payments WHERE id = p_id AND gym_id = p_gym_id;                                           
  END;                                                                                                           
  $$;


ALTER FUNCTION public.delete_payment(p_id uuid, p_gym_id uuid) OWNER TO rtg;

--
-- Name: delete_plan_promotion(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.delete_plan_promotion(p_id uuid, p_gym_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    DELETE FROM public.plan_promotions WHERE id = p_id AND gym_id = p_gym_id;
  END;
  $$;


ALTER FUNCTION public.delete_plan_promotion(p_id uuid, p_gym_id uuid) OWNER TO rtg;

--
-- Name: delete_promo_code(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.delete_promo_code(p_id uuid, p_gym_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    DELETE FROM public.promo_codes WHERE id = p_id AND gym_id = p_gym_id;
  END;
  $$;


ALTER FUNCTION public.delete_promo_code(p_id uuid, p_gym_id uuid) OWNER TO rtg;

--
-- Name: extend_membership(uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.extend_membership(p_membership_id uuid, p_extra_days integer, p_gym_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                 
  DECLARE                                                                                                  
    v_end_date date;                                                                                     
    v_new_end  date;                                                                                       
  BEGIN
    -- Verify the membership belongs to this gym                                                           
    SELECT end_date INTO v_end_date                                                                        
    FROM public.member_memberships
    WHERE id = p_membership_id                                                                             
      AND gym_id = p_gym_id;                                                                             
                                                                                                           
    IF NOT FOUND THEN
      RETURN json_build_object('ok', false, 'error', 'Membership not found');                              
    END IF;                                                                                                
   
    -- If no end_date (open-ended), nothing to extend                                                      
    IF v_end_date IS NULL THEN                                                                           
      RETURN json_build_object('ok', false, 'error', 'Membership has no expiry date to extend');           
    END IF;                                                                                                
   
    -- Extend from current end_date (or today if already expired)                                          
    v_new_end := GREATEST(v_end_date, CURRENT_DATE) + p_extra_days;                                      
                                                                                                           
    UPDATE public.member_memberships                                                                     
    SET end_date = v_new_end,                                                                              
        status   = CASE WHEN status = 'expired' THEN 'active' ELSE status END                              
    WHERE id = p_membership_id
      AND gym_id = p_gym_id;                                                                               
                                                                                                         
    RETURN json_build_object('ok', true, 'new_end_date', v_new_end);                                       
  END;                                                                                                   
  $$;


ALTER FUNCTION public.extend_membership(p_membership_id uuid, p_extra_days integer, p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_attendance_logs(uuid, timestamp with time zone, timestamp with time zone, uuid, text, integer); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_attendance_logs(p_gym_id uuid, p_from_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_member_id uuid DEFAULT NULL::uuid, p_access_point text DEFAULT NULL::text, p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, gym_id uuid, gym_member_id uuid, member_number text, full_name text, check_in_at timestamp with time zone, method text, access_point text, branch_name text, specialist_name text)
    LANGUAGE sql STABLE
    AS $$
  SELECT
    al.id,
    al.gym_id,
    al.gym_member_id,
    gm.member_number::text,
    p.full_name,
    al.check_in_at,
    al.method,
    al.access_point,
    b.name AS branch_name,
    al.specialist_name
  FROM   attendance_logs al
  JOIN   gym_members gm ON gm.id      = al.gym_member_id
  JOIN   profiles    p  ON p.id       = gm.user_id
  LEFT JOIN branches b  ON b.id       = al.branch_id
  WHERE  al.gym_id       = p_gym_id
    AND  (p_from_date    IS NULL OR al.check_in_at >= p_from_date)
    AND  (p_to_date      IS NULL OR al.check_in_at <= p_to_date)
    AND  (p_member_id    IS NULL OR al.gym_member_id = p_member_id)
    AND  (p_access_point IS NULL OR al.access_point  = p_access_point)
  ORDER BY al.check_in_at DESC
  LIMIT p_limit;
$$;


ALTER FUNCTION public.get_attendance_logs(p_gym_id uuid, p_from_date timestamp with time zone, p_to_date timestamp with time zone, p_member_id uuid, p_access_point text, p_limit integer) OWNER TO rtg;

--
-- Name: get_gym_capacity(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_gym_capacity(p_gym_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_enabled boolean;
  v_max_cap integer;
  v_active  bigint;
  v_pct     integer;
  v_status  text;
BEGIN
  SELECT capacity_feature_enabled, max_capacity
    INTO v_enabled, v_max_cap
    FROM gyms
   WHERE id = p_gym_id;

  -- Feature off or gym not found
  IF NOT FOUND OR NOT v_enabled OR v_max_cap IS NULL OR v_max_cap <= 0 THEN
    RETURN jsonb_build_object('is_enabled', false);
  END IF;

  -- Count distinct members who checked in within the last 2 hours.
  -- We count ALL attendance_logs entries (gym entrance + class) so that a member
  -- attending a class is also reflected in occupancy. DISTINCT prevents double-count.
  SELECT COUNT(DISTINCT gym_member_id)
    INTO v_active
    FROM attendance_logs
   WHERE gym_id     = p_gym_id
     AND check_in_at >= NOW() - INTERVAL '2 hours';

  v_pct := LEAST(ROUND((v_active::numeric / v_max_cap::numeric) * 100)::integer, 100);

  v_status := CASE
    WHEN v_pct <= 30 THEN 'not_busy'
    WHEN v_pct <= 70 THEN 'moderate'
    ELSE 'busy'
  END;

  RETURN jsonb_build_object(
    'is_enabled',          true,
    'active_users',        v_active,
    'max_capacity',        v_max_cap,
    'capacity_percentage', v_pct,
    'status',              v_status
  );
END;
$$;


ALTER FUNCTION public.get_gym_capacity(p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_gym_classes(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_gym_classes(p_gym_id uuid) RETURNS TABLE(id uuid, name text, class_type text, description text, instructor text, trainer_id uuid, location text, color text, image_url text, is_active boolean, branch_id uuid, created_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    c.id,
    c.name,
    c.class_type,
    c.description,
    c.instructor,
    c.trainer_id,
    c.location,
    c.color,
    c.image_url,
    NOT c.is_cancelled AS is_active,
    c.branch_id,
    c.created_at
  FROM classes c
  WHERE c.gym_id = p_gym_id
  ORDER BY c.created_at DESC;
$$;


ALTER FUNCTION public.get_gym_classes(p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_gym_dashboard_stats(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_gym_dashboard_stats(p_gym_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                                                        
  DECLARE                                                                                                                        
    v_first_of_month timestamptz := date_trunc('month', now());                                                                
  BEGIN                                                                                                                          
    RETURN (                                                                                                                   
      SELECT jsonb_build_object(                                                                                                 
        'total_revenue',  COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0),                                             
        'month_revenue',  COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND created_at >= v_first_of_month), 0),            
        'recent_payments', (                                                                                                     
          SELECT jsonb_agg(r)                                                                                                    
          FROM (                                                                                                                 
            SELECT id, amount, currency, status, payment_method, created_at                                                    
            FROM public.payments                                                                                                 
            WHERE gym_id = p_gym_id                                                                                              
            ORDER BY created_at DESC
            LIMIT 5                                                                                                              
          ) r                                                                                                                  
        )
      )
      FROM public.payments
      WHERE gym_id = p_gym_id
    );                                                                                                                           
  END;
  $$;


ALTER FUNCTION public.get_gym_dashboard_stats(p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_gym_payment_creds(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_gym_payment_creds(p_gym_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_config record;
BEGIN
  SELECT secret_key, public_key, integration_id,
         valu_integration_id, applepay_integration_id, is_active
  INTO v_config
  FROM gym_payment_config
  WHERE gym_id = p_gym_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'secret_key',              v_config.secret_key,
    'public_key',              v_config.public_key,
    'integration_id',          v_config.integration_id,
    'valu_integration_id',     v_config.valu_integration_id,
    'applepay_integration_id', v_config.applepay_integration_id
  );
END;
$$;


ALTER FUNCTION public.get_gym_payment_creds(p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_gym_payment_status(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_gym_payment_status(p_gym_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_owner_id uuid; v_config record;
BEGIN
  SELECT owner_id INTO v_owner_id FROM gyms WHERE id = p_gym_id;
  IF v_owner_id != auth.uid() THEN RETURN jsonb_build_object('configured', false); END IF;
  SELECT * INTO v_config FROM gym_payment_config WHERE gym_id = p_gym_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('configured', false); END IF;
  RETURN jsonb_build_object(
    'configured', true, 'is_active', v_config.is_active, 'provider', v_config.provider,
    'secret_key_hint', CASE WHEN v_config.secret_key IS NOT NULL THEN CONCAT('••••', RIGHT(v_config.secret_key, 4)) ELSE NULL END,
    'public_key_hint', CASE WHEN v_config.public_key IS NOT NULL THEN CONCAT('••••', RIGHT(v_config.public_key, 4)) ELSE NULL END,
    'has_card', v_config.integration_id IS NOT NULL,
    'has_valu', v_config.valu_integration_id IS NOT NULL,
    'has_applepay', v_config.applepay_integration_id IS NOT NULL,
    'updated_at', v_config.updated_at
  );
END; $$;


ALTER FUNCTION public.get_gym_payment_status(p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_gym_payments(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_gym_payments(p_gym_id uuid) RETURNS TABLE(id uuid, gym_id uuid, gym_member_id uuid, membership_id uuid, amount numeric, original_amount numeric, discount_amount numeric, promo_code text, currency text, payment_method text, status text, notes text, paid_at timestamp with time zone, source text, service_type text, service_name text, specialist_name text, branch_name text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.gym_id, p.gym_member_id, p.membership_id,
    p.amount, p.original_amount, p.discount_amount,
    pc.code AS promo_code, p.currency, p.payment_method,
    p.status, p.notes, p.paid_at, p.source,
    p.service_type, p.service_name, p.specialist_name,
    COALESCE(
      b.name,
      CASE
        WHEN mp.access_scope = 'all_branches' THEN 'All Branches'
        WHEN mp.allowed_branch_ids IS NOT NULL AND array_length(mp.allowed_branch_ids, 1) > 0 THEN (
          SELECT string_agg(br.name, ', ' ORDER BY br.name)
          FROM public.branches br
          WHERE br.id::text = ANY(mp.allowed_branch_ids)
        )
        ELSE NULL
      END,
      CASE
        WHEN mp2.access_scope = 'all_branches' THEN 'All Branches'
        WHEN mp2.allowed_branch_ids IS NOT NULL AND array_length(mp2.allowed_branch_ids, 1) > 0 THEN (
          SELECT string_agg(br.name, ', ' ORDER BY br.name)
          FROM public.branches br
          WHERE br.id::text = ANY(mp2.allowed_branch_ids)
        )
        ELSE NULL
      END
    ) AS branch_name,
    p.created_at
  FROM public.payments p
  LEFT JOIN public.promo_codes pc ON pc.id = p.promo_code_id
  LEFT JOIN public.branches b ON b.id = p.branch_id
  LEFT JOIN public.member_memberships mm ON mm.id = p.membership_id
  LEFT JOIN public.membership_plans mp ON mp.id = mm.plan_id
  LEFT JOIN public.membership_plans mp2
    ON mp2.gym_id = p.gym_id
    AND mp2.name = p.service_name
    AND p.membership_id IS NULL
    AND mp2.is_active = true
  WHERE p.gym_id = p_gym_id
  ORDER BY p.created_at DESC;
END;
$$;


ALTER FUNCTION public.get_gym_payments(p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_gym_sessions(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_gym_sessions(p_gym_id uuid) RETURNS TABLE(id uuid, class_id uuid, class_name text, class_type text, instructor text, location text, color text, session_date date, start_time text, end_time text, capacity integer, booked_count integer, session_type text, recurring_template_id uuid, is_published boolean, status text, cancel_reason text, cancelled_at timestamp with time zone, branch_id uuid, studio_id uuid, walk_in_allowed boolean, created_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    cs.id,
    cs.class_id,
    c.name            AS class_name,
    c.class_type,
    COALESCE(cs.instructor, c.instructor) AS instructor,
    c.location,
    c.color,
    cs.session_date,
    cs.start_time::text,
    cs.end_time::text,
    cs.capacity,
    cs.booked_count,
    cs.session_type,
    cs.recurring_template_id,
    cs.is_published,
    cs.status,
    cs.cancel_reason,
    cs.cancelled_at,
    cs.branch_id,
    cs.studio_id,
    cs.walk_in_allowed,
    cs.created_at
  FROM class_sessions cs
  JOIN classes c ON c.id = cs.class_id
  WHERE c.gym_id = p_gym_id
  ORDER BY cs.session_date DESC, cs.start_time DESC;
$$;


ALTER FUNCTION public.get_gym_sessions(p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_last_unrated_attended_session(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_last_unrated_attended_session(p_member_id uuid) RETURNS TABLE(id uuid, status text, created_at timestamp with time zone, session_id uuid, session_date date, start_time text, end_time text, class_name text, instructor text, class_type text, color text)
    LANGUAGE sql SECURITY DEFINER
    AS $$                                                                                                                                                    
    SELECT                                                                                                                                                                               
      sb.id,                                                                                                                                                                             
      sb.status::text,                                                                                                                                                                   
      sb.created_at,                                                                                                                                                                     
      cs.id            AS session_id,                                                                                                                                                    
      cs.session_date,                                                                                                                                                                   
      cs.start_time::text,                                                                                                                                                               
      cs.end_time::text,                                                                                                                                                                 
      c.name           AS class_name,                                                                                                                                                    
      c.instructor,                                                                                                                                                                      
      c.class_type::text,                                                                                                                                                                
      c.color                                                                                                                                                                            
    FROM public.session_bookings sb                                                                                                                                                      
    JOIN public.class_sessions cs ON cs.id = sb.session_id                                                                                                                               
    JOIN public.classes         c  ON c.id  = cs.class_id                                                                                                                                
    WHERE sb.gym_member_id = p_member_id                                                                                                                                                 
      AND sb.status        = 'attended'                                                                                                                                                  
    ORDER BY sb.created_at DESC                                                                                                                                                          
    LIMIT 20;                                                                                                                                                                            
  $$;


ALTER FUNCTION public.get_last_unrated_attended_session(p_member_id uuid) OWNER TO rtg;

--
-- Name: get_plan_promotions(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_plan_promotions(p_gym_id uuid) RETURNS TABLE(id uuid, plan_id uuid, plan_name text, promo_price numeric, valid_from date, valid_until date, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    RETURN QUERY
    SELECT pp.id, pp.plan_id, mp.name AS plan_name,
      pp.promo_price, pp.valid_from, pp.valid_until, pp.created_at
    FROM public.plan_promotions pp
    JOIN public.membership_plans mp ON mp.id = pp.plan_id
    WHERE pp.gym_id = p_gym_id
    ORDER BY pp.created_at DESC;
  END;
  $$;


ALTER FUNCTION public.get_plan_promotions(p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_promo_codes(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_promo_codes(p_gym_id uuid) RETURNS TABLE(id uuid, code text, name text, discount_type text, discount_value numeric, valid_from timestamp with time zone, valid_until timestamp with time zone, max_uses integer, per_member_limit integer, uses_count integer, is_active boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    RETURN QUERY
    SELECT p.id, p.code, p.name, p.discount_type, p.discount_value,
      p.valid_from, p.valid_until, p.max_uses, p.per_member_limit,
      p.uses_count, p.is_active, p.created_at
    FROM public.promo_codes p
    WHERE p.gym_id = p_gym_id
    ORDER BY p.created_at DESC;
  END;
  $$;


ALTER FUNCTION public.get_promo_codes(p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_promo_redemptions(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_promo_redemptions(p_promo_code_id uuid, p_gym_id uuid) RETURNS TABLE(member_number text, full_name text, plan_name text, original_price numeric, discount_amount numeric, final_price numeric, currency text, redeemed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM promo_codes
    WHERE id = p_promo_code_id AND gym_id = p_gym_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(gm.member_number::text, '')                       AS member_number,
    p.full_name                                                AS full_name,
    COALESCE(mp.name, '—')                                     AS plan_name,
    COALESCE(mm.original_price, mp.price, 0)                   AS original_price,
    r.discount_applied                                         AS discount_amount,
    COALESCE(mm.final_price, GREATEST(0, COALESCE(mm.original_price, mp.price, 0) - r.discount_applied)) AS final_price,
    COALESCE(mp.currency, 'EGP')                               AS currency,
    r.redeemed_at
  FROM promo_code_redemptions r
  JOIN profiles p                ON p.id   = r.member_id
  LEFT JOIN member_memberships mm ON mm.id  = r.membership_id
  LEFT JOIN membership_plans mp   ON mp.id  = mm.plan_id
  LEFT JOIN gym_members gm        ON gm.user_id = r.member_id
                                  AND gm.gym_id  = p_gym_id
  WHERE r.promo_code_id = p_promo_code_id
  ORDER BY r.redeemed_at DESC;
END;
$$;


ALTER FUNCTION public.get_promo_redemptions(p_promo_code_id uuid, p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_schedule_settings(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_schedule_settings(p_gym_id uuid) RETURNS TABLE(is_published boolean, published_at timestamp with time zone, last_updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                                        
  BEGIN
    RETURN QUERY                                                                                                 
    SELECT s.is_published, s.published_at, s.last_updated_at
    FROM public.schedule_settings s                                                                              
    WHERE s.gym_id = p_gym_id;
  END;                                                                                                           
  $$;


ALTER FUNCTION public.get_schedule_settings(p_gym_id uuid) OWNER TO rtg;

--
-- Name: get_session_bookings(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_session_bookings(p_session_id uuid) RETURNS TABLE(id uuid, session_id uuid, gym_member_id uuid, status text, created_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    AS $$
    SELECT
      sb.id,
      sb.session_id,                                                                                             
      sb.gym_member_id,
      sb.status::text,                                                                                           
      sb.created_at                                         
    FROM public.session_bookings sb
    WHERE sb.session_id = p_session_id;
  $$;


ALTER FUNCTION public.get_session_bookings(p_session_id uuid) OWNER TO rtg;

--
-- Name: get_session_bookings_detail(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.get_session_bookings_detail(p_session_id uuid) RETURNS TABLE(id uuid, session_id uuid, gym_member_id uuid, status text, created_at timestamp with time zone, member_name text, member_number text, member_photo text, member_email text)
    LANGUAGE sql SECURITY DEFINER
    AS $$
    SELECT
      sb.id,
      sb.session_id,
      sb.gym_member_id,
      sb.status::text,                                                                                           
      sb.created_at,
      COALESCE(p.full_name, p.email, 'Unknown')::text  AS member_name,                                           
      gm.member_number::text                            AS member_number,
      NULL::text                                        AS member_photo,                                         
      p.email::text                                     AS member_email
    FROM public.session_bookings sb                                                                              
    JOIN public.gym_members gm ON gm.id = sb.gym_member_id  
    JOIN public.profiles    p  ON p.id  = gm.user_id                                                             
    WHERE sb.session_id = p_session_id
      AND sb.status <> 'cancelled'                                                                               
    ORDER BY sb.created_at;                                 
  $$;


ALTER FUNCTION public.get_session_bookings_detail(p_session_id uuid) OWNER TO rtg;

--
-- Name: increment_promo_usage(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.increment_promo_usage(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                           
  BEGIN
    UPDATE public.promo_codes                                                                                    
    SET uses_count  = uses_count  + 1,                      
        usage_count = usage_count + 1
    WHERE id = p_id;                                                                                             
  END;
  $$;


ALTER FUNCTION public.increment_promo_usage(p_id uuid) OWNER TO rtg;

--
-- Name: increment_session_booked_count(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.increment_session_booked_count(p_session_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
    UPDATE public.class_sessions                                                                                 
    SET booked_count = booked_count + 1                                                                          
    WHERE id = p_session_id;
  $$;


ALTER FUNCTION public.increment_session_booked_count(p_session_id uuid) OWNER TO rtg;

--
-- Name: is_staff_of_gym(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.is_staff_of_gym(p_gym_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE gym_id = p_gym_id
      AND profile_id = auth.uid()
      AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.gyms
    WHERE id = p_gym_id
      AND owner_id = auth.uid()
  );
$$;


ALTER FUNCTION public.is_staff_of_gym(p_gym_id uuid) OWNER TO rtg;

--
-- Name: log_gym_attendance_by_token(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.log_gym_attendance_by_token(p_gym_member_id uuid, p_token uuid) RETURNS json
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


ALTER FUNCTION public.log_gym_attendance_by_token(p_gym_member_id uuid, p_token uuid) OWNER TO rtg;

--
-- Name: my_gym_id(); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.my_gym_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select gym_id from public.profiles where id = auth.uid() limit 1;
$$;


ALTER FUNCTION public.my_gym_id() OWNER TO rtg;

--
-- Name: my_gym_ids(); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.my_gym_ids() RETURNS uuid[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT array_agg(DISTINCT gid) FROM (
    SELECT gym_id AS gid FROM profiles WHERE id = auth.uid()
    UNION
    SELECT gym_id FROM gym_members WHERE user_id = auth.uid() AND deleted_at IS NULL
    UNION
    SELECT gym_id FROM staff_members WHERE user_id = auth.uid() AND deleted_at IS NULL
    UNION
    SELECT id FROM gyms WHERE owner_id = auth.uid()
  ) sub;
$$;


ALTER FUNCTION public.my_gym_ids() OWNER TO rtg;

--
-- Name: my_role(); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.my_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;


ALTER FUNCTION public.my_role() OWNER TO rtg;

--
-- Name: publish_schedule(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.publish_schedule(p_gym_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                           
  BEGIN                                                                                                          
    INSERT INTO public.schedule_settings (gym_id, is_published, published_at, last_updated_at)
    VALUES (p_gym_id, true, now(), now())                                                                        
    ON CONFLICT (gym_id) DO UPDATE                          
    SET is_published = true, published_at = now(), last_updated_at = now();
  END;
  $$;


ALTER FUNCTION public.publish_schedule(p_gym_id uuid) OWNER TO rtg;

--
-- Name: purchase_membership_mobile(uuid, uuid, numeric, text, text, date, numeric, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.purchase_membership_mobile(p_gym_id uuid, p_plan_id uuid, p_amount numeric DEFAULT 0, p_currency text DEFAULT 'EGP'::text, p_payment_method text DEFAULT 'card'::text, p_start_date date DEFAULT CURRENT_DATE, p_original_amount numeric DEFAULT NULL::numeric, p_promo_code_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_gym_member_id  uuid;
  v_plan           record;
  v_promo          record;
  v_promo_uses     int;
  v_end_date       date    := NULL;
  v_sessions_total int     := NULL;
  v_membership_id  uuid;
  v_payment_id     uuid;
  v_discount       numeric;
BEGIN
  SELECT id INTO v_gym_member_id
  FROM public.gym_members
  WHERE gym_id = p_gym_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_gym_member_id IS NULL THEN
    RAISE EXCEPTION 'Member record not found for this gym';
  END IF;

  SELECT * INTO v_plan
  FROM public.membership_plans
  WHERE id = p_plan_id AND gym_id = p_gym_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  IF v_plan.plan_type IN ('monthly', 'annual', 'duration', 'duration_session')
     AND v_plan.duration_days IS NOT NULL THEN
    v_end_date := p_start_date + v_plan.duration_days;
  END IF;

  IF v_plan.plan_type IN ('sessions', 'duration_session') THEN
    v_sessions_total := v_plan.session_count;
  END IF;

  UPDATE public.member_memberships
  SET
    status              = 'cancelled',
    cancelled_at        = now(),
    cancellation_reason = 'Plan purchased via mobile app'
  WHERE gym_member_id = v_gym_member_id
    AND gym_id        = p_gym_id
    AND status        = 'active';

  INSERT INTO public.member_memberships (
    gym_id, gym_member_id, plan_id,
    status, payment_status,
    start_date, end_date,
    sessions_remaining, sessions_total, sessions_used,
    invitations_remaining, invitations_used,
    original_price, discount_amount, final_price
  ) VALUES (
    p_gym_id, v_gym_member_id, p_plan_id,
    'active', 'paid',
    p_start_date, v_end_date,
    v_sessions_total, v_sessions_total, 0,
    CASE WHEN v_plan.invitations_enabled
         THEN COALESCE(v_plan.invitations_per_cycle, 0)
         ELSE 0 END,
    0,
    COALESCE(p_original_amount, p_amount),
    COALESCE(p_original_amount, p_amount) - p_amount,
    p_amount
  ) RETURNING id INTO v_membership_id;

  INSERT INTO public.payments (
    gym_id, gym_member_id, membership_id,
    amount, currency, payment_method,
    status, paid_at, source,
    service_type, service_name,
    original_amount, discount_amount,
    promo_code_id, branch_id
  ) VALUES (
    p_gym_id, v_gym_member_id, v_membership_id,
    p_amount, p_currency, p_payment_method,
    'paid', now(), 'mobile_app',
    'membership', v_plan.name,
    COALESCE(p_original_amount, p_amount),
    COALESCE(p_original_amount, p_amount) - p_amount,
    p_promo_code_id,
    CASE WHEN v_plan.access_scope = 'specific_branches'
              AND v_plan.allowed_branch_ids IS NOT NULL
              AND array_length(v_plan.allowed_branch_ids, 1) = 1
         THEN (v_plan.allowed_branch_ids[1])::uuid
         ELSE NULL
    END
  ) RETURNING id INTO v_payment_id;

  -- Validate + record promo code redemption
  IF p_promo_code_id IS NOT NULL THEN
    SELECT * INTO v_promo FROM public.promo_codes
    WHERE id = p_promo_code_id
      AND gym_id = p_gym_id
      AND is_active = true
      AND (valid_from IS NULL OR valid_from <= now())
      AND (valid_until IS NULL OR valid_until >= now())
      AND (max_uses IS NULL OR uses_count < max_uses);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid, expired, or exhausted promo code';
    END IF;

    -- Check per-member limit
    IF v_promo.per_member_limit IS NOT NULL THEN
      SELECT count(*) INTO v_promo_uses
      FROM public.promo_code_redemptions
      WHERE promo_code_id = p_promo_code_id AND member_id = auth.uid();
      IF v_promo_uses >= v_promo.per_member_limit THEN
        RAISE EXCEPTION 'Promo code usage limit reached for this member';
      END IF;
    END IF;

    v_discount := COALESCE(p_original_amount, p_amount) - p_amount;
    INSERT INTO public.promo_code_redemptions (
      promo_code_id, member_id, membership_id, discount_applied
    ) VALUES (
      p_promo_code_id, auth.uid(), v_membership_id, v_discount
    );
    UPDATE public.promo_codes
    SET uses_count  = uses_count  + 1,
        usage_count = usage_count + 1
    WHERE id = p_promo_code_id;
  END IF;

  UPDATE public.gym_members
  SET status = 'active'
  WHERE id = v_gym_member_id
    AND status IN ('inactive', 'expired', 'cancelled');

  RETURN v_payment_id;
END;
$$;


ALTER FUNCTION public.purchase_membership_mobile(p_gym_id uuid, p_plan_id uuid, p_amount numeric, p_currency text, p_payment_method text, p_start_date date, p_original_amount numeric, p_promo_code_id uuid) OWNER TO rtg;

--
-- Name: purchase_service_package_mobile(uuid, uuid, numeric, text, text, text, numeric, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.purchase_service_package_mobile(p_gym_id uuid, p_package_id uuid, p_amount numeric DEFAULT 0, p_currency text DEFAULT 'EGP'::text, p_payment_method text DEFAULT 'card'::text, p_specialist_name text DEFAULT NULL::text, p_original_amount numeric DEFAULT NULL::numeric, p_promo_code_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_gym_member_id  uuid;
  v_package        record;
  v_promo          record;
  v_promo_uses     int;
  v_assignment_id  uuid;
  v_payment_id     uuid;
  v_discount       numeric;
BEGIN
  SELECT id INTO v_gym_member_id
  FROM public.gym_members
  WHERE gym_id = p_gym_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_gym_member_id IS NULL THEN
    RAISE EXCEPTION 'Member record not found for this gym';
  END IF;

  SELECT * INTO v_package
  FROM public.service_session_packages
  WHERE id = p_package_id AND gym_id = p_gym_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service package not found';
  END IF;

  INSERT INTO public.member_service_assignments (
    gym_id, gym_member_id, service_package_id,
    package_name, service_type,
    sessions_total, sessions_used,
    status
  ) VALUES (
    p_gym_id, v_gym_member_id, p_package_id,
    v_package.name, v_package.trainer_type,
    v_package.session_count, 0,
    'active'
  ) RETURNING id INTO v_assignment_id;

  INSERT INTO public.payments (
    gym_id, gym_member_id,
    amount, currency, payment_method,
    status, paid_at, source,
    service_type, service_name, specialist_name,
    original_amount, discount_amount,
    promo_code_id
  ) VALUES (
    p_gym_id, v_gym_member_id,
    p_amount, p_currency, p_payment_method,
    'paid', now(), 'mobile_app',
    v_package.trainer_type, v_package.name, p_specialist_name,
    COALESCE(p_original_amount, p_amount),
    COALESCE(p_original_amount, p_amount) - p_amount,
    p_promo_code_id
  ) RETURNING id INTO v_payment_id;

  -- Validate + record promo code redemption
  IF p_promo_code_id IS NOT NULL THEN
    SELECT * INTO v_promo FROM public.promo_codes
    WHERE id = p_promo_code_id
      AND gym_id = p_gym_id
      AND is_active = true
      AND (valid_from IS NULL OR valid_from <= now())
      AND (valid_until IS NULL OR valid_until >= now())
      AND (max_uses IS NULL OR uses_count < max_uses);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid, expired, or exhausted promo code';
    END IF;

    IF v_promo.per_member_limit IS NOT NULL THEN
      SELECT count(*) INTO v_promo_uses
      FROM public.promo_code_redemptions
      WHERE promo_code_id = p_promo_code_id AND member_id = auth.uid();
      IF v_promo_uses >= v_promo.per_member_limit THEN
        RAISE EXCEPTION 'Promo code usage limit reached for this member';
      END IF;
    END IF;

    v_discount := COALESCE(p_original_amount, p_amount) - p_amount;
    INSERT INTO public.promo_code_redemptions (
      promo_code_id, member_id, discount_applied
    ) VALUES (
      p_promo_code_id, auth.uid(), v_discount
    );
    UPDATE public.promo_codes
    SET uses_count  = uses_count  + 1,
        usage_count = usage_count + 1
    WHERE id = p_promo_code_id;
  END IF;

  RETURN v_payment_id;
END;
$$;


ALTER FUNCTION public.purchase_service_package_mobile(p_gym_id uuid, p_package_id uuid, p_amount numeric, p_currency text, p_payment_method text, p_specialist_name text, p_original_amount numeric, p_promo_code_id uuid) OWNER TO rtg;

--
-- Name: regenerate_branch_qr_token(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.regenerate_branch_qr_token(p_branch_id uuid, p_gym_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.regenerate_branch_qr_token(p_branch_id uuid, p_gym_id uuid) OWNER TO rtg;

--
-- Name: register_gym_member(uuid, uuid, text, text, text, date); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.register_gym_member(p_user_id uuid, p_gym_id uuid, p_email text, p_full_name text, p_phone text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_auth_user       record;
  v_existing_profile record;
  v_gym_member_id   uuid;
BEGIN
  -- ── Security: validate the auth user exists and was recently created ──
  SELECT id, email, created_at
  INTO v_auth_user
  FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  -- Must match the email (prevent registering as someone else)
  IF lower(v_auth_user.email) != lower(p_email) THEN
    RAISE EXCEPTION 'Email mismatch';
  END IF;

  -- Must have been created within last 10 minutes (prevents stale user_id abuse)
  IF v_auth_user.created_at < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Registration window expired';
  END IF;

  -- ── Check for existing deactivated profile (paused account) ──
  SELECT id, is_active, gym_id INTO v_existing_profile
  FROM profiles
  WHERE email = p_email AND is_active = false
  LIMIT 1;

  IF v_existing_profile IS NOT NULL THEN
    -- Reattach: update old profile to point to new auth user
    UPDATE profiles
    SET id            = p_user_id,
        full_name     = p_full_name,
        phone         = p_phone,
        date_of_birth = p_date_of_birth,
        gym_id        = p_gym_id,
        is_active     = true,
        account_status = 'active',
        role          = 'member',
        updated_at    = now()
    WHERE id = v_existing_profile.id;

    IF p_gym_id = v_existing_profile.gym_id THEN
      SELECT id INTO v_gym_member_id
      FROM gym_members WHERE user_id = v_existing_profile.id AND gym_id = p_gym_id LIMIT 1;

      IF v_gym_member_id IS NOT NULL THEN
        UPDATE gym_members
        SET user_id = p_user_id, status = 'active', deleted_at = NULL, updated_at = now()
        WHERE id = v_gym_member_id;
      ELSE
        INSERT INTO gym_members (user_id, gym_id, status)
        VALUES (p_user_id, p_gym_id, 'active');
      END IF;
    ELSE
      INSERT INTO gym_members (user_id, gym_id, status)
      VALUES (p_user_id, p_gym_id, 'active');
    END IF;

    RETURN;
  END IF;

  -- ── Fresh signup: create new profile + gym_members ──
  INSERT INTO profiles (id, email, full_name, phone, date_of_birth, gym_id, role)
  VALUES (p_user_id, p_email, p_full_name, p_phone, p_date_of_birth, p_gym_id, 'member')
  ON CONFLICT (id) DO UPDATE
  SET email         = EXCLUDED.email,
      full_name     = EXCLUDED.full_name,
      phone         = EXCLUDED.phone,
      date_of_birth = EXCLUDED.date_of_birth,
      gym_id        = EXCLUDED.gym_id,
      role          = 'member',
      is_active     = true,
      updated_at    = now();

  INSERT INTO gym_members (user_id, gym_id, status)
  VALUES (p_user_id, p_gym_id, 'active')
  ON CONFLICT DO NOTHING;
END;
$$;


ALTER FUNCTION public.register_gym_member(p_user_id uuid, p_gym_id uuid, p_email text, p_full_name text, p_phone text, p_date_of_birth date) OWNER TO rtg;

--
-- Name: remove_booking(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.remove_booking(p_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
    UPDATE public.session_bookings
    SET status = 'cancelled', updated_at = now()                                                                 
    WHERE id = p_id;
  $$;


ALTER FUNCTION public.remove_booking(p_id uuid) OWNER TO rtg;

--
-- Name: reregister_deleted_account(text, text, uuid, text, text, date); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.reregister_deleted_account(p_email text, p_password text, p_gym_id uuid, p_full_name text, p_phone text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_user_id       uuid;
  v_old_gym_id    uuid;
  v_gym_member_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email AND banned_until > now();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No paused account found');
  END IF;

  SELECT gym_id INTO v_old_gym_id
  FROM profiles
  WHERE id = v_user_id AND (account_status = 'paused' OR is_active = false);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is still active');
  END IF;

  UPDATE auth.users
  SET banned_until       = NULL,
      encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = now(),
      updated_at         = now()
  WHERE id = v_user_id;

  UPDATE profiles
  SET full_name = p_full_name, phone = p_phone, date_of_birth = p_date_of_birth,
      gym_id = p_gym_id, is_active = true, account_status = 'active',
      role = 'member', updated_at = now()
  WHERE id = v_user_id;

  IF p_gym_id = v_old_gym_id THEN
    SELECT id INTO v_gym_member_id
    FROM gym_members WHERE user_id = v_user_id AND gym_id = p_gym_id LIMIT 1;

    IF v_gym_member_id IS NOT NULL THEN
      UPDATE gym_members SET status = 'active', deleted_at = NULL, updated_at = now()
      WHERE id = v_gym_member_id;
    ELSE
      INSERT INTO gym_members (user_id, gym_id, status) VALUES (v_user_id, p_gym_id, 'active');
    END IF;
  ELSE
    INSERT INTO gym_members (user_id, gym_id, status) VALUES (v_user_id, p_gym_id, 'active');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION public.reregister_deleted_account(p_email text, p_password text, p_gym_id uuid, p_full_name text, p_phone text, p_date_of_birth date) OWNER TO rtg;

--
-- Name: set_booking_gym_id(); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.set_booking_gym_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$   
  BEGIN                                                                                                                                      
    IF NEW.gym_id IS NULL THEN                              
      SELECT gym_id INTO NEW.gym_id
      FROM   public.classes                                                                                                                  
      WHERE  id = NEW.class_id;
    END IF;                                                                                                                                  
    RETURN NEW;                                             
  END;
  $$;


ALTER FUNCTION public.set_booking_gym_id() OWNER TO rtg;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN new.updated_at = now(); RETURN new; END; $$;


ALTER FUNCTION public.set_updated_at() OWNER TO rtg;

--
-- Name: stamp_paymob_transaction_id(uuid, text); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.stamp_paymob_transaction_id(p_payment_id uuid, p_txn_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$                                                           
  DECLARE                                                         
    v_member_id uuid;                                                                                                                                                         
  BEGIN                                                                                                                                                                       
    SELECT id INTO v_member_id                                                                                                                                                
    FROM public.gym_members                                                                                                                                                   
    WHERE user_id = auth.uid()                                                     
    LIMIT 1;                                                                                                                                                                  
                                                         
    IF v_member_id IS NULL THEN                                                                                                                                               
      RAISE EXCEPTION 'Not a gym member';                                          
    END IF;                                                       
                                                                 
    IF p_txn_id IS NULL OR trim(p_txn_id) = '' THEN               
      RETURN;                                            
    END IF;                                                                                                                                                                   
                                                                         
    UPDATE public.payments                                                                                                                                                    
    SET paymob_transaction_id = p_txn_id                                           
    WHERE id              = p_payment_id                          
      AND gym_member_id   = v_member_id                                  
      AND paymob_transaction_id IS NULL;                                                                                                                                      
  END;                                                           
  $$;


ALTER FUNCTION public.stamp_paymob_transaction_id(p_payment_id uuid, p_txn_id text) OWNER TO rtg;

--
-- Name: unpublish_schedule(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.unpublish_schedule(p_gym_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    INSERT INTO public.schedule_settings (gym_id, is_published, last_updated_at)
    VALUES (p_gym_id, false, now())
    ON CONFLICT (gym_id) DO UPDATE
    SET is_published = false, last_updated_at = now();
  END;                                                                                                           
  $$;


ALTER FUNCTION public.unpublish_schedule(p_gym_id uuid) OWNER TO rtg;

--
-- Name: update_booking_status(uuid, text); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.update_booking_status(p_id uuid, p_status text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$                                                                                                          
    UPDATE public.session_bookings
    SET status = p_status, updated_at = now()                                                                    
    WHERE id = p_id;                                        
  $$;


ALTER FUNCTION public.update_booking_status(p_id uuid, p_status text) OWNER TO rtg;

--
-- Name: update_class(uuid, uuid, text, text, text, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.update_class(p_id uuid, p_gym_id uuid, p_name text, p_class_type text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_instructor text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_color text DEFAULT '#7c3aed'::text, p_is_active boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN                                                                                                          
    UPDATE public.classes SET                               
      name        = p_name,
      type        = p_class_type,                                                                                
      description = p_description,
      instructor  = p_instructor,                                                                                
      location    = p_location,                             
      color       = p_color,
      status      = CASE WHEN p_is_active THEN 'active' ELSE 'inactive' END,
      updated_at  = now()                                                                                        
    WHERE id = p_id AND gym_id = p_gym_id;
  END;                                                                                                           
  $$;


ALTER FUNCTION public.update_class(p_id uuid, p_gym_id uuid, p_name text, p_class_type text, p_description text, p_instructor text, p_location text, p_color text, p_is_active boolean) OWNER TO rtg;

--
-- Name: update_payment(uuid, uuid, text, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.update_payment(p_id uuid, p_gym_id uuid, p_status text DEFAULT NULL::text, p_paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$      
  BEGIN
    UPDATE public.payments
    SET
      status     = COALESCE(p_status,  status),
      paid_at    = CASE WHEN p_status = 'paid' THEN COALESCE(p_paid_at, now()) ELSE paid_at END,                 
      notes      = COALESCE(p_notes,   notes),
      updated_at = now()                                                                                         
    WHERE id = p_id AND gym_id = p_gym_id;                  
  END;                                                                                                           
  $$;


ALTER FUNCTION public.update_payment(p_id uuid, p_gym_id uuid, p_status text, p_paid_at timestamp with time zone, p_notes text) OWNER TO rtg;

--
-- Name: update_plan_promotion(uuid, uuid, numeric, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.update_plan_promotion(p_id uuid, p_gym_id uuid, p_promo_price numeric, p_valid_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_valid_until timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    UPDATE public.plan_promotions SET
      promo_price = p_promo_price,
      valid_from  = p_valid_from::date,
      valid_until = p_valid_until::date
    WHERE id = p_id AND gym_id = p_gym_id;
  END;
  $$;


ALTER FUNCTION public.update_plan_promotion(p_id uuid, p_gym_id uuid, p_promo_price numeric, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone) OWNER TO rtg;

--
-- Name: update_promo_code(uuid, uuid, text, text, text, numeric, timestamp with time zone, timestamp with time zone, integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.update_promo_code(p_id uuid, p_gym_id uuid, p_code text, p_name text, p_discount_type text, p_discount_value numeric, p_valid_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_valid_until timestamp with time zone DEFAULT NULL::timestamp with time zone, p_max_uses integer DEFAULT NULL::integer, p_max_uses_per_member integer DEFAULT NULL::integer, p_is_active boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    UPDATE public.promo_codes SET
      code             = p_code,
      name             = p_name,
      discount_type    = p_discount_type,
      discount_value   = p_discount_value,
      valid_from       = p_valid_from,
      valid_until      = p_valid_until,
      max_uses         = p_max_uses,
      per_member_limit = COALESCE(p_max_uses_per_member, 1),
      is_active        = p_is_active,
      updated_at       = now()
    WHERE id = p_id AND gym_id = p_gym_id;
  END;
  $$;


ALTER FUNCTION public.update_promo_code(p_id uuid, p_gym_id uuid, p_code text, p_name text, p_discount_type text, p_discount_value numeric, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone, p_max_uses integer, p_max_uses_per_member integer, p_is_active boolean) OWNER TO rtg;

--
-- Name: update_session(uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.update_session(p_id uuid, p_gym_id uuid, p_session_date date, p_start_time time without time zone, p_end_time time without time zone DEFAULT NULL::time without time zone, p_capacity integer DEFAULT NULL::integer, p_instructor text DEFAULT NULL::text, p_session_type text DEFAULT 'regular'::text, p_location text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                           
  BEGIN                                                                                                        
    UPDATE public.class_sessions cs                                                                              
    SET
      session_date = p_session_date,                                                                             
      start_time   = p_start_time,                                                                             
      end_time     = p_end_time,                                                                                 
      capacity     = p_capacity,
      instructor   = p_instructor,                                                                               
      session_type = p_session_type,                                                                           
      location     = p_location,
      updated_at   = now()                                                                                       
    FROM public.classes c
    WHERE cs.id       = p_id                                                                                     
      AND cs.class_id = c.id                                                                                   
      AND c.gym_id    = p_gym_id;                                                                                
  END;
  $$;


ALTER FUNCTION public.update_session(p_id uuid, p_gym_id uuid, p_session_date date, p_start_time time without time zone, p_end_time time without time zone, p_capacity integer, p_instructor text, p_session_type text, p_location text) OWNER TO rtg;

--
-- Name: upsert_gym_payment_config(uuid, uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.upsert_gym_payment_config(p_gym_id uuid, p_user_id uuid, p_secret_key text, p_public_key text, p_integration_id text, p_valu_integration_id text DEFAULT NULL::text, p_applepay_integration_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id FROM gyms WHERE id = p_gym_id;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gym not found');
  END IF;
  IF v_owner_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the gym owner can configure payment settings');
  END IF;
  IF p_secret_key IS NULL OR p_secret_key = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Secret key is required');
  END IF;
  IF p_public_key IS NULL OR p_public_key = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Public key is required');
  END IF;
  IF p_integration_id IS NULL OR p_integration_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Card integration ID is required');
  END IF;

  INSERT INTO gym_payment_config (
    gym_id, secret_key, public_key, integration_id,
    valu_integration_id, applepay_integration_id, is_active
  ) VALUES (
    p_gym_id, p_secret_key, p_public_key, p_integration_id,
    NULLIF(p_valu_integration_id, ''), NULLIF(p_applepay_integration_id, ''), true
  )
  ON CONFLICT (gym_id) DO UPDATE SET
    secret_key = EXCLUDED.secret_key, public_key = EXCLUDED.public_key,
    integration_id = EXCLUDED.integration_id,
    valu_integration_id = EXCLUDED.valu_integration_id,
    applepay_integration_id = EXCLUDED.applepay_integration_id,
    is_active = true, updated_at = now();

  INSERT INTO gym_payment_audit_logs (gym_id, action, performed_by, details)
  VALUES (p_gym_id, 'updated', p_user_id, jsonb_build_object('provider', 'paymob'));

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION public.upsert_gym_payment_config(p_gym_id uuid, p_user_id uuid, p_secret_key text, p_public_key text, p_integration_id text, p_valu_integration_id text, p_applepay_integration_id text) OWNER TO rtg;

--
-- Name: validate_branch_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.validate_branch_access(p_gym_member_id uuid, p_branch_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$                                                     
  DECLARE
    v_membership record;
  BEGIN                                                                                         
    -- Fetch active, paid, non-expired membership
    SELECT allowed_branch_ids, status, payment_status, end_date                                 
    INTO   v_membership                                                                         
    FROM   member_memberships
    WHERE  gym_member_id = p_gym_member_id                                                      
      AND  status        = 'active'                         
      AND  payment_status = 'paid'                                                              
      AND  (end_date IS NULL OR end_date >= current_date)   
    ORDER BY created_at DESC                                                                    
    LIMIT 1;                                                
                                                                                                
    -- No active membership                                 
    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'no_active_membership');
    END IF;                                                                                     
   
    -- all_branches plan (allowed_branch_ids is NULL)                                           
    IF v_membership.allowed_branch_ids IS NULL THEN         
      RETURN jsonb_build_object('allowed', true);                                               
    END IF;                                                                                     
   
    -- specific_branches — check membership                                                     
    IF p_branch_id = ANY(v_membership.allowed_branch_ids) THEN
      RETURN jsonb_build_object('allowed', true);                                               
    END IF;
                                                                                                
    RETURN jsonb_build_object('allowed', false, 'reason', 'wrong_branch');
  END;
  $$;


ALTER FUNCTION public.validate_branch_access(p_gym_member_id uuid, p_branch_id uuid) OWNER TO rtg;

--
-- Name: validate_gym_qr_token(uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.validate_gym_qr_token(p_token uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.validate_gym_qr_token(p_token uuid) OWNER TO rtg;

--
-- Name: validate_promo_code(uuid, text, numeric); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.validate_promo_code(p_gym_id uuid, p_code text, p_amount numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_promo       record;
  v_member_id   uuid;
  v_uses_by_me  int;
  v_discount    numeric;
  v_final       numeric;
BEGIN
  -- Gym membership check
  PERFORM public.assert_gym_member(p_gym_id);

  SELECT * INTO v_promo
  FROM promo_codes
  WHERE gym_id = p_gym_id AND upper(code) = upper(p_code) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid promo code');
  END IF;

  IF v_promo.valid_from IS NOT NULL AND now() < v_promo.valid_from THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code is not yet active');
  END IF;
  IF v_promo.valid_until IS NOT NULL AND now() > v_promo.valid_until THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code has expired');
  END IF;

  IF v_promo.max_uses IS NOT NULL AND v_promo.uses_count >= v_promo.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code has reached its usage limit');
  END IF;

  SELECT id INTO v_member_id FROM public.profiles WHERE id = auth.uid();

  SELECT count(*) INTO v_uses_by_me
  FROM public.promo_code_redemptions
  WHERE promo_code_id = v_promo.id
    AND member_id     = auth.uid();

  IF v_uses_by_me >= v_promo.per_member_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'You have already used this promo code');
  END IF;

  IF v_promo.discount_type = 'percent' THEN
    v_discount := round((p_amount * v_promo.discount_value / 100), 2);
  ELSE
    v_discount := least(v_promo.discount_value, p_amount);
  END IF;

  v_final := greatest(p_amount - v_discount, 0);

  RETURN jsonb_build_object(
    'valid',           true,
    'promo_code_id',   v_promo.id,
    'discount_type',   v_promo.discount_type,
    'discount_value',  v_promo.discount_value,
    'discount_amount', v_discount,
    'final_amount',    v_final
  );
END;
$$;


ALTER FUNCTION public.validate_promo_code(p_gym_id uuid, p_code text, p_amount numeric) OWNER TO rtg;

--
-- Name: validate_studio_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: rtg
--

CREATE FUNCTION public.validate_studio_access(p_studio_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_now          timestamp := CURRENT_TIMESTAMP::timestamp;
  v_studio       record;
  v_gym_member_id uuid;
  v_membership   record;
  v_session      record;
  v_booking_id   uuid;
  v_booking_st   text;
BEGIN
  SELECT s.id, s.name AS studio_name, s.branch_id, s.gym_id, b.name AS branch_name
  INTO v_studio
  FROM studios s JOIN branches b ON b.id = s.branch_id
  WHERE s.id = p_studio_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','denied','reason','studio_not_found');
  END IF;

  SELECT gm.id INTO v_gym_member_id
  FROM gym_members gm
  WHERE gm.user_id = p_user_id AND gm.gym_id = v_studio.gym_id AND gm.deleted_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','denied','reason','not_a_member');
  END IF;

  SELECT mm.id AS mm_id, mm.sessions_used, mm.sessions_remaining, mm.allowed_branch_ids,
         mm.freeze_status, mp.plan_type, mp.session_count
  INTO v_membership
  FROM member_memberships mm JOIN membership_plans mp ON mp.id = mm.plan_id
  WHERE mm.gym_member_id = v_gym_member_id AND mm.status = 'active' AND mm.payment_status = 'paid'
    AND (mm.end_date IS NULL OR mm.end_date >= v_now::date)
  ORDER BY mm.start_date DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','denied','reason','no_active_membership');
  END IF;
  IF v_membership.freeze_status = 'frozen' THEN
    RETURN jsonb_build_object('status','denied','reason','membership_frozen');
  END IF;

  IF v_membership.allowed_branch_ids IS NOT NULL THEN
    IF NOT (v_studio.branch_id::text = ANY(v_membership.allowed_branch_ids)) THEN
      RETURN jsonb_build_object('status','denied','reason','branch_not_allowed');
    END IF;
  END IF;

  SELECT cs.id, cs.session_date, cs.start_time, cs.end_time, cs.walk_in_allowed,
         c.name AS class_name, COALESCE(cs.instructor, c.instructor) AS instructor
  INTO v_session
  FROM class_sessions cs JOIN classes c ON c.id = cs.class_id
  WHERE cs.status <> 'cancelled'
    AND cs.session_date::date = v_now::date
    AND (cs.session_date::date + cs.start_time::time - interval '15 minutes') <= v_now
    AND (cs.session_date::date + cs.end_time::time) >= v_now
    AND (cs.studio_id = p_studio_id OR (cs.studio_id IS NULL AND cs.branch_id = v_studio.branch_id)
         OR (cs.studio_id IS NULL AND cs.branch_id IS NULL AND cs.gym_id = v_studio.gym_id))
  ORDER BY CASE WHEN cs.studio_id = p_studio_id THEN 0 ELSE 1 END,
           cs.session_date::date + cs.start_time::time DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','denied','reason','no_active_session');
  END IF;

  SELECT sb.id, sb.status INTO v_booking_id, v_booking_st
  FROM session_bookings sb
  WHERE sb.session_id = v_session.id AND sb.gym_member_id = v_gym_member_id
    AND sb.status IN ('confirmed','attended')
  LIMIT 1;
  IF FOUND THEN
    IF v_booking_st = 'attended' THEN
      RETURN jsonb_build_object('status','denied','reason','already_attended');
    END IF;
  ELSE
    IF NOT v_session.walk_in_allowed THEN
      RETURN jsonb_build_object('status','denied','reason','no_booking');
    END IF;
    IF EXISTS (SELECT 1 FROM attendance_logs WHERE class_session_id = v_session.id AND gym_member_id = v_gym_member_id) THEN
      RETURN jsonb_build_object('status','denied','reason','already_attended');
    END IF;
  END IF;

  IF v_membership.plan_type = 'sessions'
     OR (v_membership.plan_type = 'duration_session' AND v_booking_id IS NOT NULL) THEN
    IF v_membership.session_count IS NOT NULL AND v_membership.sessions_used >= v_membership.session_count THEN
      RETURN jsonb_build_object('status','denied','reason','sessions_exhausted');
    END IF;
  END IF;

  IF v_booking_id IS NOT NULL THEN
    UPDATE session_bookings SET status = 'attended' WHERE id = v_booking_id;
  END IF;
  INSERT INTO attendance_logs (gym_member_id, gym_id, branch_id, check_in_at, method, access_point, class_session_id, studio_id, specialist_name)
  VALUES (v_gym_member_id, v_studio.gym_id, v_studio.branch_id, CURRENT_TIMESTAMP, 'qr', v_session.class_name, v_session.id, p_studio_id, v_session.instructor);

  IF v_membership.plan_type = 'sessions'
     OR (v_membership.plan_type = 'duration_session' AND v_booking_id IS NOT NULL) THEN
    UPDATE member_memberships SET sessions_used = sessions_used + 1,
      sessions_remaining = GREATEST(0, COALESCE(sessions_remaining, 0) - 1)
    WHERE id = v_membership.mm_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'allowed', 'session_id', v_session.id,
    'class_name', v_session.class_name, 'session_date', v_session.session_date,
    'start_time', left(v_session.start_time::text, 5), 'end_time', left(v_session.end_time::text, 5),
    'instructor', v_session.instructor, 'studio_name', v_studio.studio_name, 'branch_name', v_studio.branch_name
  );
END;
$$;


ALTER FUNCTION public.validate_studio_access(p_studio_id uuid, p_user_id uuid) OWNER TO rtg;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: auth; Owner: rtg
--

CREATE TABLE auth.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    encrypted_password text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE auth.users OWNER TO rtg;

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.announcements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    published_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.announcements OWNER TO rtg;

--
-- Name: attendance_logs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.attendance_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    gym_member_id uuid NOT NULL,
    check_in_at timestamp with time zone DEFAULT now() NOT NULL,
    method text,
    access_point text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    class_session_id uuid,
    studio_id uuid,
    branch_id uuid,
    specialist_name text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    check_out_at timestamp with time zone
);


ALTER TABLE public.attendance_logs OWNER TO rtg;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid,
    user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    old_values jsonb,
    new_values jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now(),
    actor_id uuid,
    actor_email text,
    resource_id uuid,
    metadata jsonb,
    resource_table text
);


ALTER TABLE public.audit_logs OWNER TO rtg;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.bookings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    class_id uuid NOT NULL,
    member_id uuid NOT NULL,
    status text DEFAULT 'confirmed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    gym_id uuid NOT NULL
);


ALTER TABLE public.bookings OWNER TO rtg;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    name text NOT NULL,
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    maps_url text,
    qr_token uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.branches OWNER TO rtg;

--
-- Name: cache; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration bigint NOT NULL
);


ALTER TABLE public.cache OWNER TO rtg;

--
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration bigint NOT NULL
);


ALTER TABLE public.cache_locks OWNER TO rtg;

--
-- Name: check_ins; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.check_ins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    member_id uuid NOT NULL,
    session_id uuid,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.check_ins OWNER TO rtg;

--
-- Name: checkins_deprecated; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.checkins_deprecated (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    member_id uuid NOT NULL,
    gym_id uuid NOT NULL,
    notes text,
    is_manual boolean DEFAULT false NOT NULL,
    logged_by uuid,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    method text,
    access_point text,
    check_out_at timestamp with time zone
);


ALTER TABLE public.checkins_deprecated OWNER TO rtg;

--
-- Name: class_sessions; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.class_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    class_id uuid NOT NULL,
    recurring_template_id uuid,
    session_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    capacity integer,
    booked_count integer DEFAULT 0 NOT NULL,
    instructor text,
    location text,
    session_type text DEFAULT 'popup'::text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    cancel_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    branch_id uuid,
    cancellation_reason text,
    studio_id uuid,
    walk_in_allowed boolean DEFAULT false NOT NULL
);


ALTER TABLE public.class_sessions OWNER TO rtg;

--
-- Name: class_types; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.class_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.class_types OWNER TO rtg;

--
-- Name: classes; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.classes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    trainer_id uuid,
    name text NOT NULL,
    type text,
    description text,
    capacity integer DEFAULT 20 NOT NULL,
    location text,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_cancelled boolean DEFAULT false NOT NULL,
    cancel_reason text,
    is_recurring boolean DEFAULT false NOT NULL,
    recurrence_rule text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    min_attendees integer DEFAULT 1,
    max_waiting_list integer DEFAULT 10,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    status text DEFAULT 'active'::text,
    image_url text,
    instructor text,
    color text DEFAULT '#7c3aed'::text,
    class_type text,
    branch_id uuid,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.classes OWNER TO rtg;

--
-- Name: contact_submissions; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.contact_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    company text,
    phone text,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contact_submissions OWNER TO rtg;

--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.email_verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.email_verification_tokens OWNER TO rtg;

--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.failed_jobs OWNER TO rtg;

--
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: rtg
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.failed_jobs_id_seq OWNER TO rtg;

--
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rtg
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- Name: faqs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.faqs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.faqs OWNER TO rtg;

--
-- Name: gym_announcements; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_announcements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    visible_from timestamp with time zone,
    visible_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_announcements OWNER TO rtg;

--
-- Name: gym_banners; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_banners (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    image_url text NOT NULL,
    storage_path text,
    caption text,
    description text,
    tag text,
    tag_color text,
    action_type text DEFAULT 'none'::text NOT NULL,
    action_value text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_banners OWNER TO rtg;

--
-- Name: gym_faqs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_faqs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_faqs OWNER TO rtg;

--
-- Name: gym_feature_toggles; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_feature_toggles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    classes boolean DEFAULT true NOT NULL,
    bookings boolean DEFAULT true NOT NULL,
    payments boolean DEFAULT true NOT NULL,
    checkins boolean DEFAULT true NOT NULL,
    announcements boolean DEFAULT true NOT NULL,
    trainer_profiles boolean DEFAULT false NOT NULL,
    promo_codes boolean DEFAULT false NOT NULL,
    guest_mode boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_feature_toggles OWNER TO rtg;

--
-- Name: gym_members; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    user_id uuid,
    member_number integer,
    status text DEFAULT 'active'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_members OWNER TO rtg;

--
-- Name: gym_notifications; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    recipient_type text DEFAULT 'all'::text NOT NULL,
    recipient_filter jsonb,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    status text DEFAULT 'sent'::text NOT NULL,
    recipient_count integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_notifications OWNER TO rtg;

--
-- Name: gym_offers; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_offers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    title text NOT NULL,
    short_description text,
    full_description text,
    tag_label text,
    tag_color text,
    hero_image_url text,
    expires_at timestamp with time zone NOT NULL,
    cta_label text,
    cta_action text,
    terms jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    offer_price numeric,
    original_price numeric,
    session_count integer,
    linked_plan_id uuid,
    linked_package_id uuid
);


ALTER TABLE public.gym_offers OWNER TO rtg;

--
-- Name: gym_onboarding_slides; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_onboarding_slides (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    storage_path text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_onboarding_slides OWNER TO rtg;

--
-- Name: gym_partners; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_partners (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    name text NOT NULL,
    image_url text,
    storage_path text,
    is_visible boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_partners OWNER TO rtg;

--
-- Name: gym_payment_audit_logs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_payment_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    action text NOT NULL,
    performed_by uuid NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_payment_audit_logs OWNER TO rtg;

--
-- Name: gym_payment_config; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_payment_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    provider text DEFAULT 'paymob'::text NOT NULL,
    secret_key text,
    public_key text,
    integration_id text,
    valu_integration_id text,
    applepay_integration_id text,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_payment_config OWNER TO rtg;

--
-- Name: gym_popups; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_popups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    title text NOT NULL,
    subtitle text,
    image_url text,
    storage_path text,
    cta_label text,
    cta_action_type text DEFAULT 'none'::text NOT NULL,
    cta_action_value text,
    is_active boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_popups OWNER TO rtg;

--
-- Name: gym_programs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_programs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    storage_path text,
    duration_weeks integer,
    status text DEFAULT 'draft'::text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category text,
    total_sessions integer,
    session_duration_minutes integer,
    level text,
    trainer_name text,
    schedule_text text,
    focus_areas text[] DEFAULT '{}'::text[] NOT NULL,
    price numeric,
    full_description text
);


ALTER TABLE public.gym_programs OWNER TO rtg;

--
-- Name: gym_saas_invoices; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_saas_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid,
    saas_tier_id uuid,
    amount numeric,
    currency text DEFAULT 'USD'::text,
    status text DEFAULT 'pending'::text,
    billing_period_start timestamp with time zone,
    billing_period_end timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_saas_invoices OWNER TO rtg;

--
-- Name: gym_saas_subscriptions; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gym_saas_subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    saas_plan_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    end_date timestamp with time zone,
    stripe_subscription_id text,
    invoice_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.gym_saas_subscriptions OWNER TO rtg;

--
-- Name: gyms; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.gyms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    address text,
    city text,
    country text,
    phone text,
    email text,
    website text,
    logo_url text,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    owner_id uuid,
    saas_tier text DEFAULT 'starter'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    branding_config jsonb DEFAULT '{"icon_url": null, "logo_url": null, "splash_url": null, "font_family": "System", "primary_color": "#4f46e5", "secondary_color": "#818cf8"}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mobile_payments_enabled boolean DEFAULT true NOT NULL,
    operating_hours jsonb,
    max_branches integer DEFAULT 1 NOT NULL,
    price_per_branch numeric,
    capacity_feature_enabled boolean DEFAULT false NOT NULL,
    max_capacity integer DEFAULT 100 NOT NULL,
    category text DEFAULT 'gym'::text,
    latitude double precision,
    longitude double precision,
    services text[] DEFAULT '{}'::text[],
    is_listed boolean DEFAULT false,
    cover_image_url text,
    avg_rating numeric DEFAULT 0,
    rating_count integer DEFAULT 0
);


ALTER TABLE public.gyms OWNER TO rtg;

--
-- Name: job_batches; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);


ALTER TABLE public.job_batches OWNER TO rtg;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


ALTER TABLE public.jobs OWNER TO rtg;

--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: rtg
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.jobs_id_seq OWNER TO rtg;

--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rtg
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: landing_leads; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.landing_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    gym_name text NOT NULL,
    branches integer DEFAULT 1,
    notes text,
    source text DEFAULT 'landing-hero'::text,
    user_agent text,
    contacted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.landing_leads OWNER TO rtg;

--
-- Name: landing_sections; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.landing_sections (
    key text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.landing_sections OWNER TO rtg;

--
-- Name: member_invitations; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.member_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    inviter_member_id uuid NOT NULL,
    membership_id uuid NOT NULL,
    guest_name text,
    guest_email text NOT NULL,
    guest_phone text NOT NULL,
    invitation_token uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    duration_type text DEFAULT 'per_visit'::text NOT NULL,
    duration_days integer,
    max_visits integer DEFAULT 1 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    activated_at timestamp with time zone,
    pass_expires_at timestamp with time zone,
    visits_used integer DEFAULT 0 NOT NULL,
    invalidated_by uuid,
    invalidated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.member_invitations OWNER TO rtg;

--
-- Name: member_memberships; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.member_memberships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_member_id uuid NOT NULL,
    plan_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    end_date timestamp with time zone,
    max_visits integer,
    visits_used integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invitations_remaining integer DEFAULT 0 NOT NULL,
    invitations_used integer DEFAULT 0 NOT NULL,
    gym_id uuid,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    sessions_total integer,
    sessions_used integer DEFAULT 0 NOT NULL,
    sessions_remaining integer,
    original_price numeric DEFAULT 0 NOT NULL,
    discount_amount numeric DEFAULT 0 NOT NULL,
    final_price numeric DEFAULT 0 NOT NULL,
    promo_code_id uuid,
    plan_promotion_id uuid,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    transferred_from uuid,
    transferred_to uuid,
    freeze_status text,
    freeze_days_used integer DEFAULT 0 NOT NULL,
    freeze_count integer DEFAULT 0 NOT NULL,
    frozen_at timestamp with time zone,
    frozen_until timestamp with time zone,
    branch_id uuid,
    allowed_branch_ids text[]
);


ALTER TABLE public.member_memberships OWNER TO rtg;

--
-- Name: member_notes; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.member_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid,
    gym_id uuid,
    author_id uuid,
    content text NOT NULL,
    is_private boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.member_notes OWNER TO rtg;

--
-- Name: member_service_assignments; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.member_service_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    gym_member_id uuid NOT NULL,
    service_package_id uuid NOT NULL,
    trainer_id uuid,
    trainer_name text,
    package_name text NOT NULL,
    service_type text NOT NULL,
    sessions_total integer NOT NULL,
    sessions_used integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.member_service_assignments OWNER TO rtg;

--
-- Name: membership_freeze_logs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.membership_freeze_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    membership_id uuid NOT NULL,
    freeze_days integer DEFAULT 0 NOT NULL,
    frozen_at timestamp with time zone DEFAULT now() NOT NULL,
    frozen_until timestamp with time zone,
    resumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    gym_member_id uuid
);


ALTER TABLE public.membership_freeze_logs OWNER TO rtg;

--
-- Name: membership_plans; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.membership_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    name text NOT NULL,
    plan_type text DEFAULT 'time_based'::text NOT NULL,
    duration_days integer,
    max_visits integer,
    price numeric DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invitations_enabled boolean DEFAULT false NOT NULL,
    invitations_per_cycle integer,
    invitation_duration_type text,
    invitation_duration_days integer,
    invitation_validity_days integer DEFAULT 7 NOT NULL,
    currency text DEFAULT 'EGP'::text NOT NULL,
    session_count integer,
    description text,
    deleted_at timestamp with time zone,
    billing_cycle text DEFAULT 'one-time'::text NOT NULL,
    facilities text[],
    visits_per_week integer,
    visits_per_month integer,
    add_ons text[],
    trainer_type text,
    freeze_enabled boolean DEFAULT false NOT NULL,
    freeze_max_days integer,
    freeze_max_count integer,
    discount_pct numeric DEFAULT 0 NOT NULL,
    session_expiry_days integer,
    access_scope text DEFAULT 'all_branches'::text NOT NULL,
    allowed_branch_ids text[]
);


ALTER TABLE public.membership_plans OWNER TO rtg;

--
-- Name: membership_transfer_logs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.membership_transfer_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    membership_id uuid NOT NULL,
    from_member_id uuid NOT NULL,
    to_member_id uuid NOT NULL,
    transferred_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.membership_transfer_logs OWNER TO rtg;

--
-- Name: memberships_deprecated; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.memberships_deprecated (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    member_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auto_renew boolean DEFAULT false,
    pause_start_date date,
    pause_end_date date,
    renewal_reminder_sent_at timestamp with time zone,
    created_by uuid,
    gym_id uuid,
    max_visits integer,
    visits_used integer DEFAULT 0
);


ALTER TABLE public.memberships_deprecated OWNER TO rtg;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


ALTER TABLE public.migrations OWNER TO rtg;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: rtg
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO rtg;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rtg
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT true,
    membership_expiry_reminders boolean DEFAULT true,
    booking_confirmations boolean DEFAULT true,
    booking_reminders boolean DEFAULT true,
    payment_receipts boolean DEFAULT true,
    announcements boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.notification_preferences OWNER TO rtg;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    gym_id uuid,
    title text NOT NULL,
    body text NOT NULL,
    channel text DEFAULT 'both'::text NOT NULL,
    data jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO rtg;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);


ALTER TABLE public.password_reset_tokens OWNER TO rtg;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    membership_id uuid,
    member_id uuid,
    gym_id uuid,
    amount numeric NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    method text DEFAULT 'card'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    stripe_payment_intent_id text,
    invoice_number text,
    notes text,
    refund_amount numeric,
    refund_reason text,
    refunded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    receipt_email_sent_at timestamp with time zone,
    transaction_id text,
    metadata jsonb,
    gym_member_id uuid,
    payment_method text DEFAULT 'cash'::text,
    paid_at timestamp with time zone,
    source text DEFAULT 'admin'::text,
    service_type text,
    service_name text,
    original_amount numeric,
    discount_amount numeric DEFAULT 0,
    promo_code_id uuid,
    plan_promotion_id uuid,
    specialist_name text,
    paymob_transaction_id text,
    payment_link_url text,
    refunded_amount numeric DEFAULT 0 NOT NULL,
    branch_id uuid
);


ALTER TABLE public.payments OWNER TO rtg;

--
-- Name: personal_access_tokens; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.personal_access_tokens (
    id bigint NOT NULL,
    tokenable_type character varying(255) NOT NULL,
    tokenable_id character varying(36) NOT NULL,
    name text NOT NULL,
    token character varying(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


ALTER TABLE public.personal_access_tokens OWNER TO rtg;

--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: rtg
--

CREATE SEQUENCE public.personal_access_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.personal_access_tokens_id_seq OWNER TO rtg;

--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rtg
--

ALTER SEQUENCE public.personal_access_tokens_id_seq OWNED BY public.personal_access_tokens.id;


--
-- Name: plan_branches; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.plan_branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    branch_id uuid NOT NULL
);


ALTER TABLE public.plan_branches OWNER TO rtg;

--
-- Name: plan_promotions; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.plan_promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    plan_id uuid,
    promo_price numeric(10,2) NOT NULL,
    valid_from date NOT NULL,
    valid_until date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.plan_promotions OWNER TO rtg;

--
-- Name: plans_deprecated; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.plans_deprecated (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid,
    name text NOT NULL,
    description text,
    price numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    billing_cycle text DEFAULT 'monthly'::text NOT NULL,
    duration_days integer DEFAULT 30 NOT NULL,
    max_visits_per_week integer,
    max_visits_per_month integer,
    benefits jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    freeze_allowed boolean DEFAULT false,
    transfer_allowed boolean DEFAULT false,
    installments_allowed boolean DEFAULT false
);


ALTER TABLE public.plans_deprecated OWNER TO rtg;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    phone text,
    date_of_birth date,
    gender text,
    address text,
    emergency_contact_name text,
    emergency_contact_phone text,
    photo_url text,
    fcm_token text,
    gym_id uuid,
    role text DEFAULT 'member'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notification_preferences jsonb DEFAULT '{"bookings": true, "payments": true, "announcements": true, "class_reminders": true, "membership_expiry": true}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_verified boolean DEFAULT false,
    preferred_language text DEFAULT 'en'::text,
    deleted_at timestamp with time zone,
    must_reset_password boolean DEFAULT false NOT NULL,
    account_status text DEFAULT 'active'::text NOT NULL,
    password text
);


ALTER TABLE public.profiles OWNER TO rtg;

--
-- Name: promo_code_redemptions; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.promo_code_redemptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    promo_code_id uuid NOT NULL,
    member_id uuid NOT NULL,
    membership_id uuid,
    discount_applied numeric NOT NULL,
    redeemed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.promo_code_redemptions OWNER TO rtg;

--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.promo_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    code text NOT NULL,
    discount_type text NOT NULL,
    discount_value numeric NOT NULL,
    max_uses integer,
    uses_count integer DEFAULT 0 NOT NULL,
    per_member_limit integer DEFAULT 1 NOT NULL,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    name text
);


ALTER TABLE public.promo_codes OWNER TO rtg;

--
-- Name: recurring_session_templates; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.recurring_session_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    class_id uuid NOT NULL,
    day_of_week integer,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    capacity integer,
    instructor text,
    location text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recurring_session_templates OWNER TO rtg;

--
-- Name: refresh_token_blacklist; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.refresh_token_blacklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.refresh_token_blacklist OWNER TO rtg;

--
-- Name: saas_plans; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.saas_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    tier text NOT NULL,
    price numeric NOT NULL,
    billing_cycle text DEFAULT 'monthly'::text NOT NULL,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    max_members integer,
    max_staff integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.saas_plans OWNER TO rtg;

--
-- Name: saas_tiers; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.saas_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price_monthly numeric DEFAULT 0 NOT NULL,
    price_annual numeric DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.saas_tiers OWNER TO rtg;

--
-- Name: schedule_settings; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.schedule_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    last_updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schedule_settings OWNER TO rtg;

--
-- Name: service_session_packages; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.service_session_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    name text NOT NULL,
    trainer_type text,
    session_count integer,
    price numeric,
    currency text DEFAULT 'EGP'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text
);


ALTER TABLE public.service_session_packages OWNER TO rtg;

--
-- Name: session_bookings; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.session_bookings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    gym_member_id uuid NOT NULL,
    status text DEFAULT 'confirmed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.session_bookings OWNER TO rtg;

--
-- Name: session_ratings; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.session_ratings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    gym_member_id uuid NOT NULL,
    gym_id uuid NOT NULL,
    session_rating integer NOT NULL,
    trainer_rating integer,
    review text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_ratings_session_rating_check CHECK (((session_rating >= 1) AND (session_rating <= 5))),
    CONSTRAINT session_ratings_trainer_rating_check CHECK (((trainer_rating >= 1) AND (trainer_rating <= 5)))
);


ALTER TABLE public.session_ratings OWNER TO rtg;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id bigint,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);


ALTER TABLE public.sessions OWNER TO rtg;

--
-- Name: staff_activity_logs; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.staff_activity_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid,
    staff_id uuid,
    action text,
    entity text,
    entity_id uuid,
    details jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    staff_name text,
    action_type text,
    module text,
    description text
);


ALTER TABLE public.staff_activity_logs OWNER TO rtg;

--
-- Name: staff_member_roles; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.staff_member_roles (
    staff_id uuid NOT NULL,
    role_id uuid NOT NULL
);


ALTER TABLE public.staff_member_roles OWNER TO rtg;

--
-- Name: staff_members; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.staff_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    user_id uuid,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    is_active boolean DEFAULT true NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.staff_members OWNER TO rtg;

--
-- Name: staff_role_permissions; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.staff_role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    module text NOT NULL,
    action text NOT NULL
);


ALTER TABLE public.staff_role_permissions OWNER TO rtg;

--
-- Name: staff_roles; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.staff_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.staff_roles OWNER TO rtg;

--
-- Name: staff_users; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.staff_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    staff_role text DEFAULT 'staff'::text NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    employment_start_date date,
    hourly_rate numeric
);


ALTER TABLE public.staff_users OWNER TO rtg;

--
-- Name: studios; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.studios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    name text NOT NULL,
    capacity integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.studios OWNER TO rtg;

--
-- Name: super_admins; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.super_admins (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.super_admins OWNER TO rtg;

--
-- Name: trainer_branches; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.trainer_branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trainer_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.trainer_branches OWNER TO rtg;

--
-- Name: trainer_profiles; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.trainer_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    profile_id uuid,
    gym_id uuid NOT NULL,
    bio text,
    specialties text[],
    certifications text[],
    photo_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text,
    trainer_type text DEFAULT 'personal_trainer'::text,
    branch_id uuid
);


ALTER TABLE public.trainer_profiles OWNER TO rtg;

--
-- Name: users; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password character varying(255) NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


ALTER TABLE public.users OWNER TO rtg;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: rtg
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO rtg;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rtg
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: waitlists; Type: TABLE; Schema: public; Owner: rtg
--

CREATE TABLE public.waitlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid,
    member_id uuid,
    gym_id uuid,
    "position" integer NOT NULL,
    status text DEFAULT 'waiting'::text,
    notified_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.waitlists OWNER TO rtg;

--
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: personal_access_tokens id; Type: DEFAULT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.personal_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.personal_access_tokens_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: rtg
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: attendance_logs attendance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_class_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_class_id_member_id_key UNIQUE (class_id, member_id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: cache_locks cache_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);


--
-- Name: check_ins check_ins_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_pkey PRIMARY KEY (id);


--
-- Name: checkins_deprecated checkins_deprecated_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.checkins_deprecated
    ADD CONSTRAINT checkins_deprecated_pkey PRIMARY KEY (id);


--
-- Name: class_sessions class_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.class_sessions
    ADD CONSTRAINT class_sessions_pkey PRIMARY KEY (id);


--
-- Name: class_types class_types_gym_id_name_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.class_types
    ADD CONSTRAINT class_types_gym_id_name_key UNIQUE (gym_id, name);


--
-- Name: class_types class_types_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.class_types
    ADD CONSTRAINT class_types_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: contact_submissions contact_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_key UNIQUE (token);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: faqs faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);


--
-- Name: gym_announcements gym_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_announcements
    ADD CONSTRAINT gym_announcements_pkey PRIMARY KEY (id);


--
-- Name: gym_banners gym_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_banners
    ADD CONSTRAINT gym_banners_pkey PRIMARY KEY (id);


--
-- Name: gym_faqs gym_faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_faqs
    ADD CONSTRAINT gym_faqs_pkey PRIMARY KEY (id);


--
-- Name: gym_feature_toggles gym_feature_toggles_gym_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_feature_toggles
    ADD CONSTRAINT gym_feature_toggles_gym_id_key UNIQUE (gym_id);


--
-- Name: gym_feature_toggles gym_feature_toggles_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_feature_toggles
    ADD CONSTRAINT gym_feature_toggles_pkey PRIMARY KEY (id);


--
-- Name: gym_members gym_members_gym_id_member_number_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_members
    ADD CONSTRAINT gym_members_gym_id_member_number_key UNIQUE (gym_id, member_number);


--
-- Name: gym_members gym_members_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_members
    ADD CONSTRAINT gym_members_pkey PRIMARY KEY (id);


--
-- Name: gym_members gym_members_user_gym_unique; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_members
    ADD CONSTRAINT gym_members_user_gym_unique UNIQUE (user_id, gym_id);


--
-- Name: gym_notifications gym_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_notifications
    ADD CONSTRAINT gym_notifications_pkey PRIMARY KEY (id);


--
-- Name: gym_offers gym_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_offers
    ADD CONSTRAINT gym_offers_pkey PRIMARY KEY (id);


--
-- Name: gym_onboarding_slides gym_onboarding_slides_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_onboarding_slides
    ADD CONSTRAINT gym_onboarding_slides_pkey PRIMARY KEY (id);


--
-- Name: gym_partners gym_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_partners
    ADD CONSTRAINT gym_partners_pkey PRIMARY KEY (id);


--
-- Name: gym_payment_audit_logs gym_payment_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_payment_audit_logs
    ADD CONSTRAINT gym_payment_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: gym_payment_config gym_payment_config_gym_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_payment_config
    ADD CONSTRAINT gym_payment_config_gym_id_key UNIQUE (gym_id);


--
-- Name: gym_payment_config gym_payment_config_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_payment_config
    ADD CONSTRAINT gym_payment_config_pkey PRIMARY KEY (id);


--
-- Name: gym_popups gym_popups_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_popups
    ADD CONSTRAINT gym_popups_pkey PRIMARY KEY (id);


--
-- Name: gym_programs gym_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_programs
    ADD CONSTRAINT gym_programs_pkey PRIMARY KEY (id);


--
-- Name: gym_saas_invoices gym_saas_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_saas_invoices
    ADD CONSTRAINT gym_saas_invoices_pkey PRIMARY KEY (id);


--
-- Name: gym_saas_subscriptions gym_saas_subscriptions_gym_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_saas_subscriptions
    ADD CONSTRAINT gym_saas_subscriptions_gym_id_key UNIQUE (gym_id);


--
-- Name: gym_saas_subscriptions gym_saas_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_saas_subscriptions
    ADD CONSTRAINT gym_saas_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: gym_saas_subscriptions gym_saas_subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_saas_subscriptions
    ADD CONSTRAINT gym_saas_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: gyms gyms_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gyms
    ADD CONSTRAINT gyms_pkey PRIMARY KEY (id);


--
-- Name: job_batches job_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: landing_leads landing_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.landing_leads
    ADD CONSTRAINT landing_leads_pkey PRIMARY KEY (id);


--
-- Name: landing_sections landing_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.landing_sections
    ADD CONSTRAINT landing_sections_pkey PRIMARY KEY (key);


--
-- Name: member_invitations member_invitations_invitation_token_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_invitations
    ADD CONSTRAINT member_invitations_invitation_token_key UNIQUE (invitation_token);


--
-- Name: member_invitations member_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_invitations
    ADD CONSTRAINT member_invitations_pkey PRIMARY KEY (id);


--
-- Name: member_memberships member_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_memberships
    ADD CONSTRAINT member_memberships_pkey PRIMARY KEY (id);


--
-- Name: member_notes member_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_notes
    ADD CONSTRAINT member_notes_pkey PRIMARY KEY (id);


--
-- Name: member_service_assignments member_service_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_service_assignments
    ADD CONSTRAINT member_service_assignments_pkey PRIMARY KEY (id);


--
-- Name: membership_freeze_logs membership_freeze_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_freeze_logs
    ADD CONSTRAINT membership_freeze_logs_pkey PRIMARY KEY (id);


--
-- Name: membership_plans membership_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_plans
    ADD CONSTRAINT membership_plans_pkey PRIMARY KEY (id);


--
-- Name: membership_transfer_logs membership_transfer_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_transfer_logs
    ADD CONSTRAINT membership_transfer_logs_pkey PRIMARY KEY (id);


--
-- Name: memberships_deprecated memberships_deprecated_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.memberships_deprecated
    ADD CONSTRAINT memberships_deprecated_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: payments payments_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_number_key UNIQUE (invoice_number);


--
-- Name: payments payments_paymob_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_paymob_transaction_id_key UNIQUE (paymob_transaction_id);


--
-- Name: payments payments_paymob_transaction_id_unique; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_paymob_transaction_id_unique UNIQUE (paymob_transaction_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_stripe_payment_intent_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);


--
-- Name: personal_access_tokens personal_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: personal_access_tokens personal_access_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_key UNIQUE (token);


--
-- Name: personal_access_tokens personal_access_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique UNIQUE (token);


--
-- Name: plan_branches plan_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.plan_branches
    ADD CONSTRAINT plan_branches_pkey PRIMARY KEY (id);


--
-- Name: plan_branches plan_branches_plan_id_branch_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.plan_branches
    ADD CONSTRAINT plan_branches_plan_id_branch_id_key UNIQUE (plan_id, branch_id);


--
-- Name: plan_promotions plan_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.plan_promotions
    ADD CONSTRAINT plan_promotions_pkey PRIMARY KEY (id);


--
-- Name: plans_deprecated plans_deprecated_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.plans_deprecated
    ADD CONSTRAINT plans_deprecated_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: promo_code_redemptions promo_code_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.promo_code_redemptions
    ADD CONSTRAINT promo_code_redemptions_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_gym_id_code_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_gym_id_code_key UNIQUE (gym_id, code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: recurring_session_templates recurring_session_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.recurring_session_templates
    ADD CONSTRAINT recurring_session_templates_pkey PRIMARY KEY (id);


--
-- Name: refresh_token_blacklist refresh_token_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.refresh_token_blacklist
    ADD CONSTRAINT refresh_token_blacklist_pkey PRIMARY KEY (id);


--
-- Name: saas_plans saas_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.saas_plans
    ADD CONSTRAINT saas_plans_pkey PRIMARY KEY (id);


--
-- Name: saas_plans saas_plans_tier_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.saas_plans
    ADD CONSTRAINT saas_plans_tier_key UNIQUE (tier);


--
-- Name: saas_tiers saas_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.saas_tiers
    ADD CONSTRAINT saas_tiers_pkey PRIMARY KEY (id);


--
-- Name: schedule_settings schedule_settings_gym_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.schedule_settings
    ADD CONSTRAINT schedule_settings_gym_id_key UNIQUE (gym_id);


--
-- Name: schedule_settings schedule_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.schedule_settings
    ADD CONSTRAINT schedule_settings_pkey PRIMARY KEY (id);


--
-- Name: service_session_packages service_session_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.service_session_packages
    ADD CONSTRAINT service_session_packages_pkey PRIMARY KEY (id);


--
-- Name: session_bookings session_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.session_bookings
    ADD CONSTRAINT session_bookings_pkey PRIMARY KEY (id);


--
-- Name: session_bookings session_bookings_session_id_gym_member_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.session_bookings
    ADD CONSTRAINT session_bookings_session_id_gym_member_id_key UNIQUE (session_id, gym_member_id);


--
-- Name: session_ratings session_ratings_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.session_ratings
    ADD CONSTRAINT session_ratings_booking_id_key UNIQUE (booking_id);


--
-- Name: session_ratings session_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.session_ratings
    ADD CONSTRAINT session_ratings_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: staff_activity_logs staff_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_activity_logs
    ADD CONSTRAINT staff_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: staff_member_roles staff_member_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_member_roles
    ADD CONSTRAINT staff_member_roles_pkey PRIMARY KEY (staff_id, role_id);


--
-- Name: staff_members staff_members_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_pkey PRIMARY KEY (id);


--
-- Name: staff_role_permissions staff_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_role_permissions
    ADD CONSTRAINT staff_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: staff_role_permissions staff_role_permissions_role_id_module_action_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_role_permissions
    ADD CONSTRAINT staff_role_permissions_role_id_module_action_key UNIQUE (role_id, module, action);


--
-- Name: staff_roles staff_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_roles
    ADD CONSTRAINT staff_roles_pkey PRIMARY KEY (id);


--
-- Name: staff_users staff_users_gym_id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_gym_id_profile_id_key UNIQUE (gym_id, profile_id);


--
-- Name: staff_users staff_users_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_pkey PRIMARY KEY (id);


--
-- Name: studios studios_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_pkey PRIMARY KEY (id);


--
-- Name: super_admins super_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_pkey PRIMARY KEY (user_id);


--
-- Name: trainer_branches trainer_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.trainer_branches
    ADD CONSTRAINT trainer_branches_pkey PRIMARY KEY (id);


--
-- Name: trainer_branches trainer_branches_trainer_id_branch_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.trainer_branches
    ADD CONSTRAINT trainer_branches_trainer_id_branch_id_key UNIQUE (trainer_id, branch_id);


--
-- Name: trainer_profiles trainer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.trainer_profiles
    ADD CONSTRAINT trainer_profiles_pkey PRIMARY KEY (id);


--
-- Name: trainer_profiles trainer_profiles_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.trainer_profiles
    ADD CONSTRAINT trainer_profiles_profile_id_key UNIQUE (profile_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: waitlists waitlists_class_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_class_id_member_id_key UNIQUE (class_id, member_id);


--
-- Name: waitlists waitlists_pkey; Type: CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_pkey PRIMARY KEY (id);


--
-- Name: branches_gym_id_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX branches_gym_id_idx ON public.branches USING btree (gym_id);


--
-- Name: cache_expiration_index; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX cache_expiration_index ON public.cache USING btree (expiration);


--
-- Name: cache_locks_expiration_index; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX cache_locks_expiration_index ON public.cache_locks USING btree (expiration);


--
-- Name: class_sessions_branch_id_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX class_sessions_branch_id_idx ON public.class_sessions USING btree (branch_id);


--
-- Name: classes_branch_id_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX classes_branch_id_idx ON public.classes USING btree (branch_id);


--
-- Name: gym_popups_active_prio_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX gym_popups_active_prio_idx ON public.gym_popups USING btree (gym_id, is_active, priority DESC);


--
-- Name: gym_popups_gym_id_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX gym_popups_gym_id_idx ON public.gym_popups USING btree (gym_id);


--
-- Name: idx_activity_logs_gym; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_activity_logs_gym ON public.staff_activity_logs USING btree (gym_id);


--
-- Name: idx_activity_logs_staff; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_activity_logs_staff ON public.staff_activity_logs USING btree (staff_id);


--
-- Name: idx_announcements_gym; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_announcements_gym ON public.announcements USING btree (gym_id);


--
-- Name: idx_attendance_logs_branch_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_attendance_logs_branch_id ON public.attendance_logs USING btree (branch_id);


--
-- Name: idx_attendance_logs_checkin; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_attendance_logs_checkin ON public.attendance_logs USING btree (check_in_at);


--
-- Name: idx_attendance_logs_class_session_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_attendance_logs_class_session_id ON public.attendance_logs USING btree (class_session_id) WHERE (class_session_id IS NOT NULL);


--
-- Name: idx_attendance_logs_gym; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_attendance_logs_gym ON public.attendance_logs USING btree (gym_id);


--
-- Name: idx_attendance_logs_gym_date; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_attendance_logs_gym_date ON public.attendance_logs USING btree (gym_id, check_in_at DESC);


--
-- Name: idx_attendance_logs_member; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_attendance_logs_member ON public.attendance_logs USING btree (gym_member_id);


--
-- Name: idx_attendance_logs_studio_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_attendance_logs_studio_id ON public.attendance_logs USING btree (studio_id);


--
-- Name: idx_audit_logs_actor_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs USING btree (actor_id, created_at DESC);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_audit_logs_gym_id ON public.audit_logs USING btree (gym_id);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_table, resource_id);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_bookings_class; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_bookings_class ON public.bookings USING btree (class_id);


--
-- Name: idx_bookings_class_member; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_bookings_class_member ON public.bookings USING btree (class_id, member_id);


--
-- Name: idx_bookings_created_at; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_bookings_created_at ON public.bookings USING btree (created_at);


--
-- Name: idx_bookings_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_bookings_gym_id ON public.bookings USING btree (gym_id);


--
-- Name: idx_bookings_member; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_bookings_member ON public.bookings USING btree (member_id);


--
-- Name: idx_bookings_member_status; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_bookings_member_status ON public.bookings USING btree (member_id, status);


--
-- Name: idx_class_sessions_class_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_class_sessions_class_id ON public.class_sessions USING btree (class_id, session_date);


--
-- Name: idx_class_sessions_gym_date; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_class_sessions_gym_date ON public.class_sessions USING btree (gym_id, session_date, start_time);


--
-- Name: idx_class_sessions_studio_date; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_class_sessions_studio_date ON public.class_sessions USING btree (studio_id, session_date) WHERE ((studio_id IS NOT NULL) AND (status <> 'cancelled'::text));


--
-- Name: idx_class_types_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_class_types_gym_id ON public.class_types USING btree (gym_id);


--
-- Name: idx_classes_gym; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_classes_gym ON public.classes USING btree (gym_id);


--
-- Name: idx_classes_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_classes_gym_id ON public.classes USING btree (gym_id);


--
-- Name: idx_classes_gym_starts_at; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_classes_gym_starts_at ON public.classes USING btree (gym_id, starts_at) WHERE (is_cancelled = false);


--
-- Name: idx_classes_starts_at; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_classes_starts_at ON public.classes USING btree (starts_at);


--
-- Name: idx_classes_trainer; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_classes_trainer ON public.classes USING btree (trainer_id);


--
-- Name: idx_evt_token; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_evt_token ON public.email_verification_tokens USING btree (token);


--
-- Name: idx_gym_banners_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_gym_banners_gym_id ON public.gym_banners USING btree (gym_id);


--
-- Name: idx_gym_members_gym_active; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_gym_members_gym_active ON public.gym_members USING btree (gym_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_gym_members_unique_user_gym; Type: INDEX; Schema: public; Owner: rtg
--

CREATE UNIQUE INDEX idx_gym_members_unique_user_gym ON public.gym_members USING btree (gym_id, user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_gym_notifications_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_gym_notifications_gym_id ON public.gym_notifications USING btree (gym_id);


--
-- Name: idx_gym_offers_expires; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_gym_offers_expires ON public.gym_offers USING btree (expires_at);


--
-- Name: idx_gym_offers_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_gym_offers_gym_id ON public.gym_offers USING btree (gym_id);


--
-- Name: idx_gym_offers_status; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_gym_offers_status ON public.gym_offers USING btree (gym_id, status);


--
-- Name: idx_gym_partners_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_gym_partners_gym_id ON public.gym_partners USING btree (gym_id);


--
-- Name: idx_gym_programs_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_gym_programs_gym_id ON public.gym_programs USING btree (gym_id);


--
-- Name: idx_gym_programs_status; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_gym_programs_status ON public.gym_programs USING btree (gym_id, status);


--
-- Name: idx_gym_saas_sub_gym; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_gym_saas_sub_gym ON public.gym_saas_subscriptions USING btree (gym_id);


--
-- Name: idx_member_invitations_guest_email; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_invitations_guest_email ON public.member_invitations USING btree (guest_email);


--
-- Name: idx_member_invitations_guest_phone; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_invitations_guest_phone ON public.member_invitations USING btree (guest_phone);


--
-- Name: idx_member_invitations_gym; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_invitations_gym ON public.member_invitations USING btree (gym_id);


--
-- Name: idx_member_invitations_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_invitations_gym_id ON public.member_invitations USING btree (gym_id);


--
-- Name: idx_member_invitations_inviter; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_invitations_inviter ON public.member_invitations USING btree (inviter_member_id);


--
-- Name: idx_member_invitations_membership; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_invitations_membership ON public.member_invitations USING btree (membership_id);


--
-- Name: idx_member_invitations_status; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_invitations_status ON public.member_invitations USING btree (status);


--
-- Name: idx_member_invitations_token; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_invitations_token ON public.member_invitations USING btree (invitation_token);


--
-- Name: idx_member_memberships_active; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_memberships_active ON public.member_memberships USING btree (gym_member_id, gym_id) WHERE (status = 'active'::text);


--
-- Name: idx_member_memberships_allowed_branches; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_memberships_allowed_branches ON public.member_memberships USING gin (allowed_branch_ids) WHERE (allowed_branch_ids IS NOT NULL);


--
-- Name: idx_member_notes_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_notes_gym_id ON public.member_notes USING btree (gym_id);


--
-- Name: idx_member_notes_member_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_notes_member_id ON public.member_notes USING btree (member_id);


--
-- Name: idx_member_service_assignments_member; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_member_service_assignments_member ON public.member_service_assignments USING btree (gym_member_id, status);


--
-- Name: idx_members_gym_id_created; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_members_gym_id_created ON public.gym_members USING btree (gym_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_members_gym_id_status; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_members_gym_id_status ON public.gym_members USING btree (gym_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_pat_tokenable; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_pat_tokenable ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);


--
-- Name: idx_payments_branch_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_branch_id ON public.payments USING btree (branch_id);


--
-- Name: idx_payments_created_at; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at);


--
-- Name: idx_payments_gym; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_gym ON public.payments USING btree (gym_id);


--
-- Name: idx_payments_gym_created; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_gym_created ON public.payments USING btree (gym_id, created_at);


--
-- Name: idx_payments_gym_id_created; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_gym_id_created ON public.payments USING btree (gym_id, created_at DESC);


--
-- Name: idx_payments_gym_id_created_at; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_gym_id_created_at ON public.payments USING btree (gym_id, created_at DESC);


--
-- Name: idx_payments_gym_member; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_gym_member ON public.payments USING btree (gym_id, gym_member_id);


--
-- Name: idx_payments_gym_status_time; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_gym_status_time ON public.payments USING btree (gym_id, status, created_at DESC);


--
-- Name: idx_payments_member; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_member ON public.payments USING btree (member_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_stripe; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_payments_stripe ON public.payments USING btree (stripe_payment_intent_id);


--
-- Name: idx_plan_branches_branch_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_plan_branches_branch_id ON public.plan_branches USING btree (branch_id);


--
-- Name: idx_plan_branches_plan_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_plan_branches_plan_id ON public.plan_branches USING btree (plan_id);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);


--
-- Name: idx_profiles_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_profiles_gym_id ON public.profiles USING btree (gym_id);


--
-- Name: idx_profiles_gym_role; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_profiles_gym_role ON public.profiles USING btree (gym_id, role);


--
-- Name: idx_profiles_gym_role_active; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_profiles_gym_role_active ON public.profiles USING btree (gym_id, role) WHERE (is_active = true);


--
-- Name: idx_profiles_is_active; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_profiles_is_active ON public.profiles USING btree (is_active);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_promo_codes_gym; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_promo_codes_gym ON public.promo_codes USING btree (gym_id);


--
-- Name: idx_promo_codes_gym_code; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_promo_codes_gym_code ON public.promo_codes USING btree (gym_id, code) WHERE (is_active = true);


--
-- Name: idx_promo_redemptions_code; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_promo_redemptions_code ON public.promo_code_redemptions USING btree (promo_code_id);


--
-- Name: idx_prt_token; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_prt_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_rtb_token; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_rtb_token ON public.refresh_token_blacklist USING btree (token);


--
-- Name: idx_rtb_user_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_rtb_user_id ON public.refresh_token_blacklist USING btree (user_id);


--
-- Name: idx_session_bookings_session_status; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_session_bookings_session_status ON public.session_bookings USING btree (session_id, status);


--
-- Name: idx_session_bookings_unique_active; Type: INDEX; Schema: public; Owner: rtg
--

CREATE UNIQUE INDEX idx_session_bookings_unique_active ON public.session_bookings USING btree (session_id, gym_member_id) WHERE (status <> 'cancelled'::text);


--
-- Name: idx_staff_gym; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_staff_gym ON public.staff_users USING btree (gym_id);


--
-- Name: idx_staff_members_gym_active; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_staff_members_gym_active ON public.staff_members USING btree (gym_id) WHERE ((deleted_at IS NULL) AND (status = 'active'::text));


--
-- Name: idx_studios_branch_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_studios_branch_id ON public.studios USING btree (branch_id);


--
-- Name: idx_studios_gym_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_studios_gym_id ON public.studios USING btree (gym_id);


--
-- Name: idx_trainer_branches_branch; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_trainer_branches_branch ON public.trainer_branches USING btree (branch_id);


--
-- Name: idx_trainer_branches_trainer; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_trainer_branches_trainer ON public.trainer_branches USING btree (trainer_id);


--
-- Name: idx_waitlists_class_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_waitlists_class_id ON public.waitlists USING btree (class_id);


--
-- Name: idx_waitlists_member_id; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX idx_waitlists_member_id ON public.waitlists USING btree (member_id);


--
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- Name: payments_paymob_transaction_id_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX payments_paymob_transaction_id_idx ON public.payments USING btree (paymob_transaction_id) WHERE (paymob_transaction_id IS NOT NULL);


--
-- Name: personal_access_tokens_expires_at_index; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX personal_access_tokens_expires_at_index ON public.personal_access_tokens USING btree (expires_at);


--
-- Name: personal_access_tokens_tokenable_type_tokenable_id_index; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);


--
-- Name: session_ratings_gym_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX session_ratings_gym_idx ON public.session_ratings USING btree (gym_id);


--
-- Name: session_ratings_member_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX session_ratings_member_idx ON public.session_ratings USING btree (gym_member_id);


--
-- Name: session_ratings_session_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX session_ratings_session_idx ON public.session_ratings USING btree (session_id);


--
-- Name: sessions_last_activity_index; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);


--
-- Name: sessions_user_id_index; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);


--
-- Name: trainer_branches_branch_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX trainer_branches_branch_idx ON public.trainer_branches USING btree (branch_id);


--
-- Name: trainer_branches_trainer_idx; Type: INDEX; Schema: public; Owner: rtg
--

CREATE INDEX trainer_branches_trainer_idx ON public.trainer_branches USING btree (trainer_id);


--
-- Name: announcements trg_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: attendance_logs trg_attendance_logs_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_attendance_logs_updated_at BEFORE UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: bookings trg_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: classes trg_classes_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: faqs trg_faqs_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_faqs_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gym_feature_toggles trg_feature_toggles_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_feature_toggles_updated_at BEFORE UPDATE ON public.gym_feature_toggles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gym_members trg_gym_members_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_gym_members_updated_at BEFORE UPDATE ON public.gym_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gym_offers trg_gym_offers_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_gym_offers_updated_at BEFORE UPDATE ON public.gym_offers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gym_payment_config trg_gym_payment_config_updated; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_gym_payment_config_updated BEFORE UPDATE ON public.gym_payment_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gym_programs trg_gym_programs_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_gym_programs_updated_at BEFORE UPDATE ON public.gym_programs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gym_saas_subscriptions trg_gym_saas_sub_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_gym_saas_sub_updated_at BEFORE UPDATE ON public.gym_saas_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gyms trg_gyms_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_gyms_updated_at BEFORE UPDATE ON public.gyms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payments trg_payments_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: promo_codes trg_promo_codes_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: saas_plans trg_saas_plans_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_saas_plans_updated_at BEFORE UPDATE ON public.saas_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: bookings trg_set_booking_gym_id; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_set_booking_gym_id BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_booking_gym_id();


--
-- Name: staff_users trg_staff_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON public.staff_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: trainer_profiles trg_trainer_updated_at; Type: TRIGGER; Schema: public; Owner: rtg
--

CREATE TRIGGER trg_trainer_updated_at BEFORE UPDATE ON public.trainer_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: announcements announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: announcements announcements_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: attendance_logs attendance_logs_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: attendance_logs attendance_logs_class_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_class_session_id_fkey FOREIGN KEY (class_session_id) REFERENCES public.class_sessions(id);


--
-- Name: attendance_logs attendance_logs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: attendance_logs attendance_logs_gym_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_gym_member_id_fkey FOREIGN KEY (gym_member_id) REFERENCES public.gym_members(id);


--
-- Name: attendance_logs attendance_logs_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id);


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);


--
-- Name: audit_logs audit_logs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: bookings bookings_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: bookings bookings_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: bookings bookings_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id);


--
-- Name: branches branches_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: check_ins check_ins_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: check_ins check_ins_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.gym_members(id);


--
-- Name: checkins_deprecated checkins_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.checkins_deprecated
    ADD CONSTRAINT checkins_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: checkins_deprecated checkins_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.checkins_deprecated
    ADD CONSTRAINT checkins_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES public.profiles(id);


--
-- Name: checkins_deprecated checkins_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.checkins_deprecated
    ADD CONSTRAINT checkins_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id);


--
-- Name: class_sessions class_sessions_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.class_sessions
    ADD CONSTRAINT class_sessions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: class_sessions class_sessions_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.class_sessions
    ADD CONSTRAINT class_sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: class_sessions class_sessions_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.class_sessions
    ADD CONSTRAINT class_sessions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: class_sessions class_sessions_recurring_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.class_sessions
    ADD CONSTRAINT class_sessions_recurring_template_id_fkey FOREIGN KEY (recurring_template_id) REFERENCES public.recurring_session_templates(id);


--
-- Name: class_sessions class_sessions_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.class_sessions
    ADD CONSTRAINT class_sessions_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id);


--
-- Name: class_types class_types_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.class_types
    ADD CONSTRAINT class_types_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: classes classes_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: classes classes_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: classes classes_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.trainer_profiles(id);


--
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: faqs faqs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_saas_invoices fk_invoices_gym; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_saas_invoices
    ADD CONSTRAINT fk_invoices_gym FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_saas_invoices fk_invoices_saas_tier; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_saas_invoices
    ADD CONSTRAINT fk_invoices_saas_tier FOREIGN KEY (saas_tier_id) REFERENCES public.saas_tiers(id);


--
-- Name: gym_announcements gym_announcements_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_announcements
    ADD CONSTRAINT gym_announcements_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_banners gym_banners_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_banners
    ADD CONSTRAINT gym_banners_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_faqs gym_faqs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_faqs
    ADD CONSTRAINT gym_faqs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_feature_toggles gym_feature_toggles_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_feature_toggles
    ADD CONSTRAINT gym_feature_toggles_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_members gym_members_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_members
    ADD CONSTRAINT gym_members_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_members gym_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_members
    ADD CONSTRAINT gym_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: gym_notifications gym_notifications_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_notifications
    ADD CONSTRAINT gym_notifications_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_offers gym_offers_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_offers
    ADD CONSTRAINT gym_offers_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_offers gym_offers_linked_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_offers
    ADD CONSTRAINT gym_offers_linked_package_id_fkey FOREIGN KEY (linked_package_id) REFERENCES public.service_session_packages(id);


--
-- Name: gym_offers gym_offers_linked_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_offers
    ADD CONSTRAINT gym_offers_linked_plan_id_fkey FOREIGN KEY (linked_plan_id) REFERENCES public.membership_plans(id);


--
-- Name: gym_onboarding_slides gym_onboarding_slides_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_onboarding_slides
    ADD CONSTRAINT gym_onboarding_slides_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_partners gym_partners_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_partners
    ADD CONSTRAINT gym_partners_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_payment_audit_logs gym_payment_audit_logs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_payment_audit_logs
    ADD CONSTRAINT gym_payment_audit_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_payment_config gym_payment_config_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_payment_config
    ADD CONSTRAINT gym_payment_config_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_popups gym_popups_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_popups
    ADD CONSTRAINT gym_popups_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_programs gym_programs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_programs
    ADD CONSTRAINT gym_programs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_saas_invoices gym_saas_invoices_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_saas_invoices
    ADD CONSTRAINT gym_saas_invoices_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_saas_invoices gym_saas_invoices_saas_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_saas_invoices
    ADD CONSTRAINT gym_saas_invoices_saas_tier_id_fkey FOREIGN KEY (saas_tier_id) REFERENCES public.saas_tiers(id);


--
-- Name: gym_saas_subscriptions gym_saas_subscriptions_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_saas_subscriptions
    ADD CONSTRAINT gym_saas_subscriptions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_saas_subscriptions gym_saas_subscriptions_saas_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gym_saas_subscriptions
    ADD CONSTRAINT gym_saas_subscriptions_saas_plan_id_fkey FOREIGN KEY (saas_plan_id) REFERENCES public.saas_plans(id);


--
-- Name: gyms gyms_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.gyms
    ADD CONSTRAINT gyms_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: member_invitations member_invitations_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_invitations
    ADD CONSTRAINT member_invitations_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: member_invitations member_invitations_invalidated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_invitations
    ADD CONSTRAINT member_invitations_invalidated_by_fkey FOREIGN KEY (invalidated_by) REFERENCES public.profiles(id);


--
-- Name: member_invitations member_invitations_inviter_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_invitations
    ADD CONSTRAINT member_invitations_inviter_member_id_fkey FOREIGN KEY (inviter_member_id) REFERENCES public.gym_members(id);


--
-- Name: member_invitations member_invitations_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_invitations
    ADD CONSTRAINT member_invitations_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.member_memberships(id);


--
-- Name: member_memberships member_memberships_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_memberships
    ADD CONSTRAINT member_memberships_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: member_memberships member_memberships_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_memberships
    ADD CONSTRAINT member_memberships_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: member_memberships member_memberships_gym_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_memberships
    ADD CONSTRAINT member_memberships_gym_member_id_fkey FOREIGN KEY (gym_member_id) REFERENCES public.gym_members(id);


--
-- Name: member_memberships member_memberships_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_memberships
    ADD CONSTRAINT member_memberships_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.membership_plans(id);


--
-- Name: member_notes member_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_notes
    ADD CONSTRAINT member_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);


--
-- Name: member_notes member_notes_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_notes
    ADD CONSTRAINT member_notes_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: member_notes member_notes_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_notes
    ADD CONSTRAINT member_notes_member_id_fkey FOREIGN KEY (member_id) REFERENCES auth.users(id);


--
-- Name: member_service_assignments member_service_assignments_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_service_assignments
    ADD CONSTRAINT member_service_assignments_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: member_service_assignments member_service_assignments_gym_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_service_assignments
    ADD CONSTRAINT member_service_assignments_gym_member_id_fkey FOREIGN KEY (gym_member_id) REFERENCES public.gym_members(id);


--
-- Name: member_service_assignments member_service_assignments_service_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_service_assignments
    ADD CONSTRAINT member_service_assignments_service_package_id_fkey FOREIGN KEY (service_package_id) REFERENCES public.service_session_packages(id);


--
-- Name: member_service_assignments member_service_assignments_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.member_service_assignments
    ADD CONSTRAINT member_service_assignments_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.trainer_profiles(id);


--
-- Name: membership_freeze_logs membership_freeze_logs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_freeze_logs
    ADD CONSTRAINT membership_freeze_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: membership_freeze_logs membership_freeze_logs_gym_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_freeze_logs
    ADD CONSTRAINT membership_freeze_logs_gym_member_id_fkey FOREIGN KEY (gym_member_id) REFERENCES public.gym_members(id);


--
-- Name: membership_freeze_logs membership_freeze_logs_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_freeze_logs
    ADD CONSTRAINT membership_freeze_logs_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.member_memberships(id);


--
-- Name: membership_plans membership_plans_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_plans
    ADD CONSTRAINT membership_plans_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: membership_transfer_logs membership_transfer_logs_from_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_transfer_logs
    ADD CONSTRAINT membership_transfer_logs_from_member_id_fkey FOREIGN KEY (from_member_id) REFERENCES public.profiles(id);


--
-- Name: membership_transfer_logs membership_transfer_logs_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_transfer_logs
    ADD CONSTRAINT membership_transfer_logs_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships_deprecated(id);


--
-- Name: membership_transfer_logs membership_transfer_logs_to_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_transfer_logs
    ADD CONSTRAINT membership_transfer_logs_to_member_id_fkey FOREIGN KEY (to_member_id) REFERENCES public.profiles(id);


--
-- Name: membership_transfer_logs membership_transfer_logs_transferred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.membership_transfer_logs
    ADD CONSTRAINT membership_transfer_logs_transferred_by_fkey FOREIGN KEY (transferred_by) REFERENCES public.profiles(id);


--
-- Name: memberships_deprecated memberships_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.memberships_deprecated
    ADD CONSTRAINT memberships_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: memberships_deprecated memberships_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.memberships_deprecated
    ADD CONSTRAINT memberships_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: memberships_deprecated memberships_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.memberships_deprecated
    ADD CONSTRAINT memberships_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id);


--
-- Name: memberships_deprecated memberships_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.memberships_deprecated
    ADD CONSTRAINT memberships_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans_deprecated(id);


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: notifications notifications_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: payments payments_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: payments payments_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: payments payments_gym_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_gym_member_id_fkey FOREIGN KEY (gym_member_id) REFERENCES public.gym_members(id);


--
-- Name: payments payments_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id);


--
-- Name: payments payments_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.member_memberships(id);


--
-- Name: plan_branches plan_branches_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.plan_branches
    ADD CONSTRAINT plan_branches_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: plan_branches plan_branches_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.plan_branches
    ADD CONSTRAINT plan_branches_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.membership_plans(id);


--
-- Name: plan_promotions plan_promotions_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.plan_promotions
    ADD CONSTRAINT plan_promotions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE CASCADE;


--
-- Name: plan_promotions plan_promotions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.plan_promotions
    ADD CONSTRAINT plan_promotions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.membership_plans(id) ON DELETE CASCADE;


--
-- Name: plans_deprecated plans_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.plans_deprecated
    ADD CONSTRAINT plans_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: profiles profiles_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: promo_code_redemptions promo_code_redemptions_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.promo_code_redemptions
    ADD CONSTRAINT promo_code_redemptions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id);


--
-- Name: promo_code_redemptions promo_code_redemptions_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.promo_code_redemptions
    ADD CONSTRAINT promo_code_redemptions_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.member_memberships(id);


--
-- Name: promo_code_redemptions promo_code_redemptions_promo_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.promo_code_redemptions
    ADD CONSTRAINT promo_code_redemptions_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id);


--
-- Name: promo_codes promo_codes_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: recurring_session_templates recurring_session_templates_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.recurring_session_templates
    ADD CONSTRAINT recurring_session_templates_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: recurring_session_templates recurring_session_templates_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.recurring_session_templates
    ADD CONSTRAINT recurring_session_templates_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: refresh_token_blacklist refresh_token_blacklist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.refresh_token_blacklist
    ADD CONSTRAINT refresh_token_blacklist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: schedule_settings schedule_settings_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.schedule_settings
    ADD CONSTRAINT schedule_settings_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: service_session_packages service_session_packages_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.service_session_packages
    ADD CONSTRAINT service_session_packages_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: session_bookings session_bookings_gym_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.session_bookings
    ADD CONSTRAINT session_bookings_gym_member_id_fkey FOREIGN KEY (gym_member_id) REFERENCES public.gym_members(id);


--
-- Name: session_bookings session_bookings_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.session_bookings
    ADD CONSTRAINT session_bookings_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id);


--
-- Name: session_ratings session_ratings_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.session_ratings
    ADD CONSTRAINT session_ratings_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.session_bookings(id);


--
-- Name: session_ratings session_ratings_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.session_ratings
    ADD CONSTRAINT session_ratings_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: session_ratings session_ratings_gym_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.session_ratings
    ADD CONSTRAINT session_ratings_gym_member_id_fkey FOREIGN KEY (gym_member_id) REFERENCES public.gym_members(id);


--
-- Name: session_ratings session_ratings_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.session_ratings
    ADD CONSTRAINT session_ratings_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id);


--
-- Name: staff_activity_logs staff_activity_logs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_activity_logs
    ADD CONSTRAINT staff_activity_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: staff_activity_logs staff_activity_logs_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_activity_logs
    ADD CONSTRAINT staff_activity_logs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.profiles(id);


--
-- Name: staff_member_roles staff_member_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_member_roles
    ADD CONSTRAINT staff_member_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.staff_roles(id);


--
-- Name: staff_member_roles staff_member_roles_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_member_roles
    ADD CONSTRAINT staff_member_roles_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff_members(id);


--
-- Name: staff_members staff_members_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: staff_members staff_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: staff_role_permissions staff_role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_role_permissions
    ADD CONSTRAINT staff_role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.staff_roles(id);


--
-- Name: staff_roles staff_roles_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_roles
    ADD CONSTRAINT staff_roles_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: staff_users staff_users_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: staff_users staff_users_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: studios studios_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: studios studios_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: super_admins super_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: trainer_branches trainer_branches_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.trainer_branches
    ADD CONSTRAINT trainer_branches_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: trainer_branches trainer_branches_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.trainer_branches
    ADD CONSTRAINT trainer_branches_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.trainer_profiles(id);


--
-- Name: trainer_profiles trainer_profiles_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.trainer_profiles
    ADD CONSTRAINT trainer_profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: trainer_profiles trainer_profiles_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.trainer_profiles
    ADD CONSTRAINT trainer_profiles_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: trainer_profiles trainer_profiles_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.trainer_profiles
    ADD CONSTRAINT trainer_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: waitlists waitlists_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: waitlists waitlists_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: waitlists waitlists_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rtg
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id);


--
-- Name: session_ratings Members can insert their own rating; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY "Members can insert their own rating" ON public.session_ratings FOR INSERT WITH CHECK ((gym_member_id IN ( SELECT gym_members.id
   FROM public.gym_members
  WHERE (gym_members.user_id = auth.uid()))));


--
-- Name: session_ratings Members can update their own rating; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY "Members can update their own rating" ON public.session_ratings FOR UPDATE USING ((gym_member_id IN ( SELECT gym_members.id
   FROM public.gym_members
  WHERE (gym_members.user_id = auth.uid()))));


--
-- Name: session_ratings Members can view ratings in their gym; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY "Members can view ratings in their gym" ON public.session_ratings FOR SELECT USING ((gym_id = public.my_gym_id()));


--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements announcements_public_read; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY announcements_public_read ON public.announcements FOR SELECT USING (((is_visible = true) AND (gym_id = public.my_gym_id())));


--
-- Name: announcements announcements_write; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY announcements_write ON public.announcements USING ((public.my_role() = ANY (ARRAY['gym_admin'::text, 'superadmin'::text])));


--
-- Name: attendance_logs; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_logs attendance_logs_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY attendance_logs_delete ON public.attendance_logs FOR DELETE TO authenticated USING (false);


--
-- Name: attendance_logs attendance_logs_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY attendance_logs_insert ON public.attendance_logs FOR INSERT WITH CHECK (true);


--
-- Name: attendance_logs attendance_logs_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY attendance_logs_select ON public.attendance_logs FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY audit_logs_delete ON public.audit_logs FOR DELETE TO authenticated USING (false);


--
-- Name: audit_logs audit_logs_gym_read; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY audit_logs_gym_read ON public.audit_logs FOR SELECT USING ((gym_id IN ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: audit_logs audit_logs_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: audit_logs audit_logs_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated USING ((gym_id = ANY (public.my_gym_ids())));


--
-- Name: audit_logs audit_logs_service_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY audit_logs_service_insert ON public.audit_logs FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: audit_logs audit_logs_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY audit_logs_update ON public.audit_logs FOR UPDATE TO authenticated USING (false);


--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings bookings_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY bookings_select ON public.bookings FOR SELECT USING (((member_id = auth.uid()) OR (public.my_role() = ANY (ARRAY['gym_admin'::text, 'superadmin'::text]))));


--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: branches branches_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY branches_delete ON public.branches FOR DELETE TO authenticated USING (false);


--
-- Name: branches branches_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY branches_insert ON public.branches FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: branches branches_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY branches_select ON public.branches FOR SELECT TO authenticated USING ((gym_id = ANY (public.my_gym_ids())));


--
-- Name: branches branches_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY branches_update ON public.branches FOR UPDATE TO authenticated USING (false);


--
-- Name: check_ins; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

--
-- Name: check_ins check_ins_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY check_ins_all ON public.check_ins USING (true);


--
-- Name: class_sessions; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: class_sessions class_sessions_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY class_sessions_delete ON public.class_sessions FOR DELETE TO authenticated USING (false);


--
-- Name: class_sessions class_sessions_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY class_sessions_insert ON public.class_sessions FOR INSERT WITH CHECK (true);


--
-- Name: class_sessions class_sessions_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY class_sessions_select ON public.class_sessions FOR SELECT USING (((COALESCE(gym_id, ( SELECT classes.gym_id
   FROM public.classes
  WHERE (classes.id = class_sessions.class_id))) = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: class_sessions class_sessions_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY class_sessions_update ON public.class_sessions FOR UPDATE USING (((COALESCE(gym_id, ( SELECT classes.gym_id
   FROM public.classes
  WHERE (classes.id = class_sessions.class_id))) = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: class_types; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.class_types ENABLE ROW LEVEL SECURITY;

--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: classes classes_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY classes_delete ON public.classes FOR DELETE TO authenticated USING (false);


--
-- Name: classes classes_gym_read; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY classes_gym_read ON public.classes FOR SELECT USING (((gym_id IN ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (auth.role() = 'service_role'::text)));


--
-- Name: classes classes_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY classes_insert ON public.classes FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: classes classes_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY classes_select ON public.classes FOR SELECT TO authenticated USING ((gym_id = ANY (public.my_gym_ids())));


--
-- Name: classes classes_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY classes_update ON public.classes FOR UPDATE TO authenticated USING (false);


--
-- Name: contact_submissions; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_payment_config deny_all_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY deny_all_delete ON public.gym_payment_config FOR DELETE USING (false);


--
-- Name: gym_payment_config deny_all_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY deny_all_insert ON public.gym_payment_config FOR INSERT WITH CHECK (false);


--
-- Name: gym_payment_audit_logs deny_all_payment_audit; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY deny_all_payment_audit ON public.gym_payment_audit_logs USING (false);


--
-- Name: gym_payment_config deny_all_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY deny_all_select ON public.gym_payment_config FOR SELECT USING (false);


--
-- Name: gym_payment_config deny_all_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY deny_all_update ON public.gym_payment_config FOR UPDATE USING (false);


--
-- Name: email_verification_tokens; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: email_verification_tokens evt_deny; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY evt_deny ON public.email_verification_tokens USING (false);


--
-- Name: faqs; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

--
-- Name: faqs faqs_gym_read; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY faqs_gym_read ON public.faqs FOR SELECT USING ((((gym_id IN ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) AND (is_visible = true)) OR (auth.role() = 'service_role'::text)));


--
-- Name: faqs faqs_write; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY faqs_write ON public.faqs USING ((public.my_role() = ANY (ARRAY['gym_admin'::text, 'superadmin'::text])));


--
-- Name: class_types gym_admin_all_class_types; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_admin_all_class_types ON public.class_types USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.gym_id = class_types.gym_id) AND (profiles.role = ANY (ARRAY['gym_admin'::text, 'staff'::text]))))));


--
-- Name: member_invitations gym_admin_invitations; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_admin_invitations ON public.member_invitations USING ((gym_id IN ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())
UNION
 SELECT staff_users.gym_id
   FROM public.staff_users
  WHERE (staff_users.profile_id = auth.uid()))));


--
-- Name: gym_banners; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_banners ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_banners gym_banners_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_banners_select ON public.gym_banners FOR SELECT USING (true);


--
-- Name: gym_banners gym_banners_write; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_banners_write ON public.gym_banners USING ((gym_id = public.my_gym_id()));


--
-- Name: gym_feature_toggles; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_feature_toggles ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_members; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_members ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_members gym_members_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_members_delete ON public.gym_members FOR DELETE USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: gym_members gym_members_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_members_insert ON public.gym_members FOR INSERT WITH CHECK (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: gym_members gym_members_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_members_select ON public.gym_members FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: gym_members gym_members_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_members_update ON public.gym_members FOR UPDATE USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: gym_notifications; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_notifications gym_notifications_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_notifications_all ON public.gym_notifications USING ((gym_id = public.my_gym_id()));


--
-- Name: gym_offers; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_offers gym_offers_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_offers_delete ON public.gym_offers FOR DELETE USING ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_offers gym_offers_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_offers_insert ON public.gym_offers FOR INSERT WITH CHECK ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_offers gym_offers_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_offers_select ON public.gym_offers FOR SELECT USING ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_offers gym_offers_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_offers_update ON public.gym_offers FOR UPDATE USING ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_partners; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_partners ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_partners gym_partners_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_partners_delete ON public.gym_partners FOR DELETE USING ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_partners gym_partners_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_partners_insert ON public.gym_partners FOR INSERT WITH CHECK ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_partners gym_partners_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_partners_select ON public.gym_partners FOR SELECT USING ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_partners gym_partners_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_partners_update ON public.gym_partners FOR UPDATE USING ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_payment_audit_logs; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_payment_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_payment_config; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_payment_config ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_popups; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_popups ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_programs; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_programs gym_programs_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_programs_delete ON public.gym_programs FOR DELETE USING ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_programs gym_programs_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_programs_insert ON public.gym_programs FOR INSERT WITH CHECK ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_programs gym_programs_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_programs_select ON public.gym_programs FOR SELECT USING ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_programs gym_programs_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_programs_update ON public.gym_programs FOR UPDATE USING ((gym_id = ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: gym_saas_invoices; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_saas_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: gym_saas_subscriptions gym_saas_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gym_saas_select ON public.gym_saas_subscriptions FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: gym_saas_subscriptions; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gym_saas_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: gyms; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

--
-- Name: gyms gyms_anon_read_active; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gyms_anon_read_active ON public.gyms FOR SELECT TO anon USING ((is_active = true));


--
-- Name: gyms gyms_member_read_own; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gyms_member_read_own ON public.gyms FOR SELECT TO authenticated USING (((id IN ( SELECT profiles.gym_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (id IN ( SELECT gym_members.gym_id
   FROM public.gym_members
  WHERE ((gym_members.user_id = auth.uid()) AND (gym_members.deleted_at IS NULL)))) OR (id IN ( SELECT staff_members.gym_id
   FROM public.staff_members
  WHERE ((staff_members.user_id = auth.uid()) AND (staff_members.deleted_at IS NULL)))) OR (auth.uid() = owner_id)));


--
-- Name: gyms gyms_no_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gyms_no_delete ON public.gyms FOR DELETE TO authenticated USING (false);


--
-- Name: gyms gyms_no_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gyms_no_insert ON public.gyms FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: gyms gyms_owner_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY gyms_owner_update ON public.gyms FOR UPDATE TO authenticated USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));


--
-- Name: landing_sections; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.landing_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: member_invitations member_insert_invitations; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_insert_invitations ON public.member_invitations FOR INSERT WITH CHECK ((inviter_member_id IN ( SELECT gym_members.id
   FROM public.gym_members
  WHERE (gym_members.user_id = auth.uid()))));


--
-- Name: attendance_logs member_insert_own_attendance; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_insert_own_attendance ON public.attendance_logs FOR INSERT WITH CHECK ((gym_member_id IN ( SELECT gym_members.id
   FROM public.gym_members
  WHERE (gym_members.user_id = auth.uid()))));


--
-- Name: member_invitations; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: session_bookings member_manage_session_bookings; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_manage_session_bookings ON public.session_bookings USING ((gym_member_id IN ( SELECT gym_members.id
   FROM public.gym_members
  WHERE (gym_members.user_id = auth.uid())))) WITH CHECK ((gym_member_id IN ( SELECT gym_members.id
   FROM public.gym_members
  WHERE (gym_members.user_id = auth.uid()))));


--
-- Name: member_memberships; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.member_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: member_memberships member_memberships_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_memberships_delete ON public.member_memberships FOR DELETE USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: member_memberships member_memberships_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_memberships_insert ON public.member_memberships FOR INSERT WITH CHECK (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: member_memberships member_memberships_member_read; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_memberships_member_read ON public.member_memberships FOR SELECT USING (((gym_member_id IN ( SELECT gym_members.id
   FROM public.gym_members
  WHERE (gym_members.user_id = auth.uid()))) OR (public.my_role() = ANY (ARRAY['gym_admin'::text, 'superadmin'::text]))));


--
-- Name: member_memberships member_memberships_policy; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_memberships_policy ON public.member_memberships USING (true);


--
-- Name: member_memberships member_memberships_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_memberships_select ON public.member_memberships FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: member_memberships member_memberships_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_memberships_update ON public.member_memberships FOR UPDATE USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: member_notes; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: member_notes member_notes_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_notes_all ON public.member_notes USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: member_invitations member_read_own_invitations; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_read_own_invitations ON public.member_invitations FOR SELECT USING ((inviter_member_id IN ( SELECT gym_members.id
   FROM public.gym_members
  WHERE (gym_members.user_id = auth.uid()))));


--
-- Name: member_service_assignments; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.member_service_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_logs member_view_own_attendance; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY member_view_own_attendance ON public.attendance_logs FOR SELECT USING ((gym_member_id IN ( SELECT gym_members.id
   FROM public.gym_members
  WHERE (gym_members.user_id = auth.uid()))));


--
-- Name: membership_freeze_logs members_insert_own_freeze_logs; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY members_insert_own_freeze_logs ON public.membership_freeze_logs FOR INSERT TO authenticated WITH CHECK ((membership_id IN ( SELECT mm.id
   FROM (public.member_memberships mm
     JOIN public.gym_members gm ON ((gm.id = mm.gym_member_id)))
  WHERE (gm.user_id = auth.uid()))));


--
-- Name: membership_freeze_logs members_read_own_freeze_logs; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY members_read_own_freeze_logs ON public.membership_freeze_logs FOR SELECT TO authenticated USING ((membership_id IN ( SELECT mm.id
   FROM (public.member_memberships mm
     JOIN public.gym_members gm ON ((gm.id = mm.gym_member_id)))
  WHERE (gm.user_id = auth.uid()))));


--
-- Name: member_service_assignments members_read_own_service_assignments; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY members_read_own_service_assignments ON public.member_service_assignments FOR SELECT TO authenticated USING ((gym_member_id IN ( SELECT gym_members.id
   FROM public.gym_members
  WHERE (gym_members.user_id = auth.uid()))));


--
-- Name: class_types members_select_class_types; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY members_select_class_types ON public.class_types FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.gym_members
  WHERE ((gym_members.user_id = auth.uid()) AND (gym_members.gym_id = class_types.gym_id)))));


--
-- Name: membership_freeze_logs; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.membership_freeze_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_plans; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_plans membership_plans_anon_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY membership_plans_anon_select ON public.membership_plans FOR SELECT TO anon USING ((is_active = true));


--
-- Name: membership_plans membership_plans_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY membership_plans_delete ON public.membership_plans FOR DELETE TO authenticated USING (false);


--
-- Name: membership_plans membership_plans_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY membership_plans_insert ON public.membership_plans FOR INSERT WITH CHECK (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: membership_plans membership_plans_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY membership_plans_select ON public.membership_plans FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: membership_plans membership_plans_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY membership_plans_update ON public.membership_plans FOR UPDATE USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: membership_transfer_logs; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.membership_transfer_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences notif_prefs_own; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY notif_prefs_own ON public.notification_preferences USING ((user_id = auth.uid()));


--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_no_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY notifications_no_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: notifications notifications_own; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY notifications_own ON public.notifications FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: notifications notifications_own_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY notifications_own_delete ON public.notifications FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications notifications_own_read; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY notifications_own_read ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications notifications_own_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payments payments_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY payments_delete ON public.payments FOR DELETE TO authenticated USING (false);


--
-- Name: payments payments_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: payments payments_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING ((gym_id = ANY (public.my_gym_ids())));


--
-- Name: payments payments_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY payments_update ON public.payments FOR UPDATE TO authenticated USING (false);


--
-- Name: plan_branches; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.plan_branches ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_branches plan_branches_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY plan_branches_all ON public.plan_branches USING (true);


--
-- Name: plan_promotions; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.plan_promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_promotions plan_promotions_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY plan_promotions_all ON public.plan_promotions USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: gym_popups popups_admin_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY popups_admin_all ON public.gym_popups USING (((public.my_role() = ANY (ARRAY['gym_admin'::text, 'superadmin'::text])) AND (gym_id = public.my_gym_id())));


--
-- Name: gym_popups popups_member_read; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY popups_member_read ON public.gym_popups FOR SELECT USING (((is_active = true) AND (gym_id = public.my_gym_id())));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_no_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY profiles_no_delete ON public.profiles FOR DELETE TO authenticated USING (false);


--
-- Name: profiles profiles_no_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY profiles_no_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: profiles profiles_own_read; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY profiles_own_read ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles profiles_own_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY profiles_own_update ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: promo_code_redemptions; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_code_redemptions promo_code_redemptions_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY promo_code_redemptions_delete ON public.promo_code_redemptions FOR DELETE TO authenticated USING (false);


--
-- Name: promo_code_redemptions promo_code_redemptions_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY promo_code_redemptions_insert ON public.promo_code_redemptions FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: promo_code_redemptions promo_code_redemptions_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY promo_code_redemptions_select ON public.promo_code_redemptions FOR SELECT TO authenticated USING ((member_id = auth.uid()));


--
-- Name: promo_code_redemptions promo_code_redemptions_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY promo_code_redemptions_update ON public.promo_code_redemptions FOR UPDATE TO authenticated USING (false);


--
-- Name: promo_codes; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_codes promo_codes_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY promo_codes_delete ON public.promo_codes FOR DELETE TO authenticated USING (false);


--
-- Name: promo_codes promo_codes_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY promo_codes_insert ON public.promo_codes FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: promo_codes promo_codes_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY promo_codes_select ON public.promo_codes FOR SELECT TO authenticated USING ((gym_id = ANY (public.my_gym_ids())));


--
-- Name: promo_codes promo_codes_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY promo_codes_update ON public.promo_codes FOR UPDATE TO authenticated USING (false);


--
-- Name: password_reset_tokens prt_deny; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY prt_deny ON public.password_reset_tokens USING (false);


--
-- Name: recurring_session_templates; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.recurring_session_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_session_templates recurring_templates_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY recurring_templates_all ON public.recurring_session_templates USING (true);


--
-- Name: refresh_token_blacklist; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.refresh_token_blacklist ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_token_blacklist rtb_deny; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY rtb_deny ON public.refresh_token_blacklist USING (false);


--
-- Name: gym_saas_invoices saas_invoices_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY saas_invoices_select ON public.gym_saas_invoices FOR SELECT USING ((public.my_role() = 'superadmin'::text));


--
-- Name: saas_plans; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: saas_plans saas_plans_read; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY saas_plans_read ON public.saas_plans FOR SELECT USING ((is_active = true));


--
-- Name: saas_plans saas_plans_write; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY saas_plans_write ON public.saas_plans USING ((public.my_role() = 'superadmin'::text));


--
-- Name: saas_tiers; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.saas_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: saas_tiers saas_tiers_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY saas_tiers_select ON public.saas_tiers FOR SELECT USING (true);


--
-- Name: schedule_settings; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.schedule_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_settings schedule_settings_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY schedule_settings_all ON public.schedule_settings USING (true);


--
-- Name: member_service_assignments service_assignments_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY service_assignments_insert ON public.member_service_assignments FOR INSERT WITH CHECK (true);


--
-- Name: member_service_assignments service_assignments_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY service_assignments_select ON public.member_service_assignments FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: member_service_assignments service_assignments_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY service_assignments_update ON public.member_service_assignments FOR UPDATE USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: service_session_packages service_packages_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY service_packages_all ON public.service_session_packages USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: service_session_packages service_packages_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY service_packages_insert ON public.service_session_packages FOR INSERT WITH CHECK (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: service_session_packages service_packages_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY service_packages_select ON public.service_session_packages FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: service_session_packages service_packages_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY service_packages_update ON public.service_session_packages FOR UPDATE USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: service_session_packages; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.service_session_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: session_bookings; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.session_bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: session_ratings; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.session_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_activity_logs; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.staff_activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_activity_logs staff_activity_logs_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_activity_logs_delete ON public.staff_activity_logs FOR DELETE TO authenticated USING (false);


--
-- Name: staff_activity_logs staff_activity_logs_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_activity_logs_insert ON public.staff_activity_logs FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: staff_activity_logs staff_activity_logs_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_activity_logs_select ON public.staff_activity_logs FOR SELECT TO authenticated USING ((gym_id = ANY (public.my_gym_ids())));


--
-- Name: staff_activity_logs staff_activity_logs_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_activity_logs_update ON public.staff_activity_logs FOR UPDATE TO authenticated USING (false);


--
-- Name: staff_activity_logs staff_logs_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_logs_insert ON public.staff_activity_logs FOR INSERT WITH CHECK (true);


--
-- Name: staff_activity_logs staff_logs_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_logs_select ON public.staff_activity_logs FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: staff_member_roles; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.staff_member_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_member_roles staff_member_roles_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_member_roles_all ON public.staff_member_roles USING (true);


--
-- Name: staff_member_roles staff_member_roles_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_member_roles_delete ON public.staff_member_roles FOR DELETE TO authenticated USING (false);


--
-- Name: staff_member_roles staff_member_roles_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_member_roles_insert ON public.staff_member_roles FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: staff_member_roles staff_member_roles_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_member_roles_select ON public.staff_member_roles FOR SELECT TO authenticated USING ((staff_id IN ( SELECT staff_members.id
   FROM public.staff_members
  WHERE (staff_members.gym_id = ANY (public.my_gym_ids())))));


--
-- Name: staff_member_roles staff_member_roles_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_member_roles_update ON public.staff_member_roles FOR UPDATE TO authenticated USING (false);


--
-- Name: staff_members; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_members staff_members_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_members_insert ON public.staff_members FOR INSERT WITH CHECK (true);


--
-- Name: staff_members staff_members_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_members_select ON public.staff_members FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: staff_members staff_members_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_members_update ON public.staff_members FOR UPDATE USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: staff_role_permissions; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.staff_role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_role_permissions staff_role_permissions_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_role_permissions_all ON public.staff_role_permissions USING (true);


--
-- Name: staff_role_permissions staff_role_permissions_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_role_permissions_delete ON public.staff_role_permissions FOR DELETE TO authenticated USING (false);


--
-- Name: staff_role_permissions staff_role_permissions_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_role_permissions_insert ON public.staff_role_permissions FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: staff_role_permissions staff_role_permissions_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_role_permissions_select ON public.staff_role_permissions FOR SELECT TO authenticated USING ((role_id IN ( SELECT staff_roles.id
   FROM public.staff_roles
  WHERE (staff_roles.gym_id = ANY (public.my_gym_ids())))));


--
-- Name: staff_role_permissions staff_role_permissions_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_role_permissions_update ON public.staff_role_permissions FOR UPDATE TO authenticated USING (false);


--
-- Name: staff_roles; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_roles staff_roles_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_roles_delete ON public.staff_roles FOR DELETE TO authenticated USING (false);


--
-- Name: staff_roles staff_roles_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_roles_insert ON public.staff_roles FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: staff_roles staff_roles_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_roles_select ON public.staff_roles FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: staff_roles staff_roles_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_roles_update ON public.staff_roles FOR UPDATE TO authenticated USING (false);


--
-- Name: staff_roles staff_roles_write; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_roles_write ON public.staff_roles USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: staff_users staff_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_select ON public.staff_users FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: bookings staff_select_bookings; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_select_bookings ON public.bookings FOR SELECT USING ((public.is_staff_of_gym(gym_id) OR (member_id = auth.uid())));


--
-- Name: bookings staff_update_bookings; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY staff_update_bookings ON public.bookings FOR UPDATE USING (public.is_staff_of_gym(gym_id));


--
-- Name: staff_users; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

--
-- Name: studios; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

--
-- Name: studios studios_all_admins; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY studios_all_admins ON public.studios USING ((gym_id IN ( SELECT p.gym_id
   FROM public.profiles p
  WHERE (p.id = auth.uid()))));


--
-- Name: studios studios_delete; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY studios_delete ON public.studios FOR DELETE TO authenticated USING (false);


--
-- Name: studios studios_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY studios_insert ON public.studios FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: studios studios_select_members; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY studios_select_members ON public.studios FOR SELECT USING ((gym_id IN ( SELECT gm.gym_id
   FROM public.gym_members gm
  WHERE ((gm.user_id = auth.uid()) AND (gm.deleted_at IS NULL)))));


--
-- Name: studios studios_update; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY studios_update ON public.studios FOR UPDATE TO authenticated USING (false);


--
-- Name: super_admins; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

--
-- Name: super_admins super_admins_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY super_admins_select ON public.super_admins FOR SELECT USING ((public.my_role() = 'superadmin'::text));


--
-- Name: gym_feature_toggles toggles_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY toggles_select ON public.gym_feature_toggles FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: trainer_branches; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.trainer_branches ENABLE ROW LEVEL SECURITY;

--
-- Name: trainer_branches trainer_branches_admin_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY trainer_branches_admin_all ON public.trainer_branches USING (((public.my_role() = ANY (ARRAY['gym_admin'::text, 'superadmin'::text])) AND (EXISTS ( SELECT 1
   FROM public.trainer_profiles tp
  WHERE ((tp.id = trainer_branches.trainer_id) AND (tp.gym_id = public.my_gym_id()))))));


--
-- Name: trainer_branches trainer_branches_member_read; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY trainer_branches_member_read ON public.trainer_branches FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.trainer_profiles tp
  WHERE ((tp.id = trainer_branches.trainer_id) AND (tp.gym_id = public.my_gym_id())))));


--
-- Name: trainer_profiles; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: trainer_profiles trainers_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY trainers_select ON public.trainer_profiles FOR SELECT USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- Name: membership_transfer_logs transfer_logs_insert; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY transfer_logs_insert ON public.membership_transfer_logs FOR INSERT WITH CHECK (true);


--
-- Name: membership_transfer_logs transfer_logs_select; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY transfer_logs_select ON public.membership_transfer_logs FOR SELECT USING (true);


--
-- Name: waitlists; Type: ROW SECURITY; Schema: public; Owner: rtg
--

ALTER TABLE public.waitlists ENABLE ROW LEVEL SECURITY;

--
-- Name: waitlists waitlists_all; Type: POLICY; Schema: public; Owner: rtg
--

CREATE POLICY waitlists_all ON public.waitlists USING (((gym_id = public.my_gym_id()) OR (public.my_role() = 'superadmin'::text)));


--
-- PostgreSQL database dump complete
--

\unrestrict zjS9icMtAMYnmguJ7bLubBUp4MrRdB1Hac7D1wWJyh4zMKmKUX8cSJnL53YvyBZ

