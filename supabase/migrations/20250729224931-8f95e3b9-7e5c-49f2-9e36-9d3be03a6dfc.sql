-- Update existing user records to use the correct auth IDs
UPDATE users 
SET id = 'c0fb1aa4-2fda-473a-a8c9-236ab01fb8ec'
WHERE email = 'admin@poolcleaning.com';

-- Update other users with their correct auth IDs
UPDATE users 
SET id = (SELECT id FROM auth.users WHERE email = users.email)
WHERE email IN ('tech1@poolcleaning.com', 'client1@poolcleaning.com')
  AND EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = users.email);