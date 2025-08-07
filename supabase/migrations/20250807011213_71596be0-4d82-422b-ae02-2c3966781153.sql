-- Enable RLS on the user_migration_status table
ALTER TABLE user_migration_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user_migration_status table (admin only access)
CREATE POLICY "Only admins can access migration status" ON user_migration_status
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );