-- Link existing auth users to our users table
INSERT INTO users (id, email, password, name, role, created_at, updated_at) 
VALUES 
  ('c0fb1aa4-2fda-473a-a8c9-236ab01fb8ec', 'admin@poolcleaning.com', 'password', 'Admin User', 'admin', now(), now())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  updated_at = now();

-- Get the other auth user IDs and create their profiles
WITH auth_users AS (
  SELECT id, email FROM auth.users 
  WHERE email IN ('tech1@poolcleaning.com', 'client1@poolcleaning.com')
)
INSERT INTO users (id, email, password, name, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  'password',
  CASE 
    WHEN au.email = 'tech1@poolcleaning.com' THEN 'Tech User'
    WHEN au.email = 'client1@poolcleaning.com' THEN 'Client User'
  END as name,
  CASE 
    WHEN au.email = 'tech1@poolcleaning.com' THEN 'tech'
    WHEN au.email = 'client1@poolcleaning.com' THEN 'client'
  END as role,
  now(),
  now()
FROM auth_users au
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  updated_at = now();