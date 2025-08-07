-- Insert admin user into users table to match Supabase Auth user
-- First, let's create the admin user entry
INSERT INTO users (id, email, name, role, password) 
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@poolcleaning.com'),
  'admin@poolcleaning.com',
  'Admin User',
  'admin',
  'hashed_password_placeholder'
) 
ON CONFLICT (id) DO UPDATE SET 
  role = 'admin',
  name = 'Admin User';