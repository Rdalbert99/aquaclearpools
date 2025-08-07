-- Create a function to help migrate existing users to Supabase Auth
-- This will be used to create auth users for existing database users

-- First, let's create a temporary table to track migration status
CREATE TABLE IF NOT EXISTS user_migration_status (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  migrated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  auth_user_id UUID
);

-- Add a comment explaining this is temporary
COMMENT ON TABLE user_migration_status IS 'Temporary table to track migration of existing users to Supabase Auth';

-- For now, let's update existing users to be ready for manual migration
-- Add a column to track if they need auth migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_auth_migration BOOLEAN DEFAULT FALSE;

-- Mark existing users (those without a corresponding auth user) as needing migration
UPDATE users 
SET needs_auth_migration = TRUE 
WHERE id NOT IN (
  SELECT id FROM auth.users WHERE id IN (SELECT id FROM users)
);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_users_needs_migration ON users(needs_auth_migration) WHERE needs_auth_migration = TRUE;