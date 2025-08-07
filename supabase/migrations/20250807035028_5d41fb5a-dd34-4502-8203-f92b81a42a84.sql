-- Reset admin password to ensure it works
UPDATE auth.users 
SET encrypted_password = crypt('password', gen_salt('bf')),
    email_confirmed_at = now(),
    confirmed_at = now()
WHERE email = 'admin@poolcleaning.com';