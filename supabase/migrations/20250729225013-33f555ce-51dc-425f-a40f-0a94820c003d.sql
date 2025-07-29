-- Delete existing incorrect user records and recreate with correct auth IDs
DELETE FROM users WHERE email IN ('admin@poolcleaning.com', 'tech1@poolcleaning.com', 'client1@poolcleaning.com');

-- Insert users with correct auth IDs
INSERT INTO users (id, email, password, name, role, created_at, updated_at) VALUES
('c0fb1aa4-2fda-473a-a8c9-236ab01fb8ec', 'admin@poolcleaning.com', 'password', 'Admin User', 'admin', now(), now()),
('61777510-ac01-4ac0-b097-3189f3b472ee', 'tech1@poolcleaning.com', 'password', 'Tech User', 'tech', now(), now()),
((SELECT id FROM auth.users WHERE email = 'client1@poolcleaning.com'), 'client1@poolcleaning.com', 'password', 'Client User', 'client', now(), now());