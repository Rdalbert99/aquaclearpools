-- Confirm the demo user emails by updating their email_confirmed_at timestamp
UPDATE auth.users 
SET email_confirmed_at = now(),
    updated_at = now()
WHERE email IN ('admin@poolcleaning.com', 'tech1@poolcleaning.com', 'client1@poolcleaning.com')
  AND email_confirmed_at IS NULL;