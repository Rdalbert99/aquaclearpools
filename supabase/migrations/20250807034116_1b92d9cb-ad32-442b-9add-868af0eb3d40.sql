-- Update the Randy user's password in Supabase Auth
-- First let's set a known password for testing
UPDATE auth.users 
SET encrypted_password = crypt('password', gen_salt('bf'))
WHERE email = 'rdalbert99@gmail.com';