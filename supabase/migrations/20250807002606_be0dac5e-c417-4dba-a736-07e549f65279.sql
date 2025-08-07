-- Update existing admin user or create if doesn't exist
INSERT INTO public.users (email, name, role, password, must_change_password, created_at, updated_at)
VALUES (
  'admin@poolcleaning.com',
  'Admin',
  'admin',
  'Password',
  true,
  now(),
  now()
)
ON CONFLICT (email) 
DO UPDATE SET 
  name = 'Admin',
  role = 'admin',
  password = 'Password',
  must_change_password = true,
  updated_at = now();

-- Remove demo/test users (but keep the admin we just created/updated)
DELETE FROM public.users 
WHERE email IN (
  'tech1@poolcleaning.com',
  'client1@poolcleaning.com'
);

-- Clean up test data from other tables
-- Remove demo clients that don't have valid users
DELETE FROM public.clients 
WHERE customer LIKE '%Demo%' 
   OR customer LIKE '%Test%' 
   OR customer LIKE '%Sample%'
   OR user_id NOT IN (SELECT id FROM public.users);

-- Remove services for non-existent clients or technicians
DELETE FROM public.services 
WHERE client_id NOT IN (SELECT id FROM public.clients)
   OR technician_id NOT IN (SELECT id FROM public.users);

-- Remove service requests for non-existent clients or with demo data
DELETE FROM public.service_requests 
WHERE contact_name LIKE '%Demo%' 
   OR contact_name LIKE '%Test%' 
   OR contact_name LIKE '%Sample%'
   OR (client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM public.clients));

-- Remove chemical calculations for non-existent clients or technicians
DELETE FROM public.chemical_calculations 
WHERE client_id NOT IN (SELECT id FROM public.clients)
   OR technician_id NOT IN (SELECT id FROM public.users);

-- Remove client_users relationships for non-existent clients or users
DELETE FROM public.client_users 
WHERE client_id NOT IN (SELECT id FROM public.clients)
   OR user_id NOT IN (SELECT id FROM public.users);

-- Remove user logins for non-existent users
DELETE FROM public.user_logins 
WHERE user_id NOT IN (SELECT id FROM public.users);