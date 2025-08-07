-- Ensure we have a working admin user
-- First, make sure our admin user exists in the users table
INSERT INTO public.users (
  id, 
  email, 
  name, 
  password, 
  role, 
  first_name, 
  last_name,
  needs_auth_migration
) VALUES (
  '0f1043ff-55e7-48a1-bb54-fb2028c76cce'::uuid,
  'admin@poolcleaning.com',
  'Pool Admin',
  'hashed_password_placeholder',
  'admin',
  'Pool',
  'Admin',
  false
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  needs_auth_migration = false;

-- Also create the rdalbert99@gmail.com user properly
INSERT INTO public.users (
  id, 
  email, 
  name, 
  password, 
  role, 
  first_name, 
  last_name,
  needs_auth_migration
) VALUES (
  gen_random_uuid(),
  'rdalbert99@gmail.com',
  'Admin User',
  'hashed_password_placeholder',
  'admin',
  'Admin',
  'User',
  true
) ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  needs_auth_migration = true;