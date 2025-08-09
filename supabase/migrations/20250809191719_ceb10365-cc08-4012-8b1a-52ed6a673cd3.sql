-- Fix Beckama's role and clean up duplicate entries
-- First, update the newer entry (cca1d002-084b-4c12-b12a-fb9e539d5f6b) to ensure it's admin
UPDATE public.users 
SET role = 'admin'
WHERE id = 'cca1d002-084b-4c12-b12a-fb9e539d5f6b';

-- Delete the older duplicate entry that has the wrong role
DELETE FROM public.users 
WHERE id = '0c81d4b3-0162-4604-b053-e241783bb893' 
AND email = 'beckama23@gmail.com' 
AND role = 'client';