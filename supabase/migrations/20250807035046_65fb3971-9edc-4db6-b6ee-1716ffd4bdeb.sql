-- Reset admin password only
UPDATE auth.users 
SET encrypted_password = crypt('password', gen_salt('bf'))
WHERE email = 'admin@poolcleaning.com';