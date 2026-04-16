-- Migration: rbac_and_logging_indexes
-- Purpose: Add performance indexes for permission lookups and activity log queries.

-- Fast permission lookups for CheckPermission middleware
CREATE INDEX IF NOT EXISTS idx_staff_role_permissions_role_module_action
  ON staff_role_permissions (role_id, module, action);

-- Fast gym-scoped activity log queries (staff overview, activity page)
CREATE INDEX IF NOT EXISTS idx_staff_activity_logs_gym_created
  ON staff_activity_logs (gym_id, created_at DESC);

-- Fast staff member lookup by user_id (used in logging and permission checks)
CREATE INDEX IF NOT EXISTS idx_staff_members_user_gym
  ON staff_members (user_id, gym_id) WHERE deleted_at IS NULL;
