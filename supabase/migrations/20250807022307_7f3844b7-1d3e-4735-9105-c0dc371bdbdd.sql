-- Remove existing admin user entries that may be causing conflicts
DELETE FROM users WHERE email = 'admin@poolcleaning.com';