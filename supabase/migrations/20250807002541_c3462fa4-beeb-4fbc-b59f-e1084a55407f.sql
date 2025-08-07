-- Create admin user with credentials that require password change
INSERT INTO public.users (email, name, role, password, must_change_password, created_at, updated_at)
VALUES (
  'admin@poolcleaning.com',
  'Admin',
  'admin',
  'Password',
  true,
  now(),
  now()
);

-- Remove all demo/test users except the new admin
DELETE FROM public.users 
WHERE email IN (
  'tech1@poolcleaning.com',
  'client1@poolcleaning.com'
) OR (email = 'admin@poolcleaning.com' AND must_change_password = false);

-- Clean up test data from other tables
-- Remove demo clients
DELETE FROM public.clients 
WHERE customer LIKE '%Demo%' 
   OR customer LIKE '%Test%' 
   OR customer LIKE '%Sample%'
   OR user_id NOT IN (SELECT id FROM public.users);

-- Remove demo services
DELETE FROM public.services 
WHERE client_id NOT IN (SELECT id FROM public.clients)
   OR technician_id NOT IN (SELECT id FROM public.users);

-- Remove demo service requests  
DELETE FROM public.service_requests 
WHERE contact_name LIKE '%Demo%' 
   OR contact_name LIKE '%Test%' 
   OR contact_name LIKE '%Sample%'
   OR client_id NOT IN (SELECT id FROM public.clients);

-- Remove demo chemical calculations
DELETE FROM public.chemical_calculations 
WHERE client_id NOT IN (SELECT id FROM public.clients)
   OR technician_id NOT IN (SELECT id FROM public.users);

-- Remove demo client_users relationships
DELETE FROM public.client_users 
WHERE client_id NOT IN (SELECT id FROM public.clients)
   OR user_id NOT IN (SELECT id FROM public.users);

-- Remove demo user logins
DELETE FROM public.user_logins 
WHERE user_id NOT IN (SELECT id FROM public.users);