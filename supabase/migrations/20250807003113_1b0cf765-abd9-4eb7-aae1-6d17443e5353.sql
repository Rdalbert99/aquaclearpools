-- First, clean up service requests that reference demo users as technicians
UPDATE public.service_requests 
SET assigned_technician_id = NULL 
WHERE assigned_technician_id IN (
  SELECT id FROM public.users 
  WHERE email IN ('tech1@poolcleaning.com', 'client1@poolcleaning.com')
);

-- Clean up all dependent records for demo users
DELETE FROM public.chemical_calculations 
WHERE technician_id IN (
  SELECT id FROM public.users 
  WHERE email IN ('tech1@poolcleaning.com', 'client1@poolcleaning.com')
);

DELETE FROM public.services 
WHERE technician_id IN (
  SELECT id FROM public.users 
  WHERE email IN ('tech1@poolcleaning.com', 'client1@poolcleaning.com')
);

DELETE FROM public.client_users 
WHERE user_id IN (
  SELECT id FROM public.users 
  WHERE email IN ('tech1@poolcleaning.com', 'client1@poolcleaning.com')
);

DELETE FROM public.user_logins 
WHERE user_id IN (
  SELECT id FROM public.users 
  WHERE email IN ('tech1@poolcleaning.com', 'client1@poolcleaning.com')
);

DELETE FROM public.clients 
WHERE user_id IN (
  SELECT id FROM public.users 
  WHERE email IN ('tech1@poolcleaning.com', 'client1@poolcleaning.com')
)
OR customer LIKE '%Demo%' 
OR customer LIKE '%Test%' 
OR customer LIKE '%Sample%';

-- Remove demo service requests
DELETE FROM public.service_requests 
WHERE contact_name LIKE '%Demo%' 
   OR contact_name LIKE '%Test%' 
   OR contact_name LIKE '%Sample%';

-- Now remove the demo users
DELETE FROM public.users 
WHERE email IN (
  'tech1@poolcleaning.com',
  'client1@poolcleaning.com'
);

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