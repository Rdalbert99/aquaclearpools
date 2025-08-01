-- Add contact information fields to service_requests table
ALTER TABLE public.service_requests 
ADD COLUMN contact_name TEXT,
ADD COLUMN contact_email TEXT,
ADD COLUMN contact_phone TEXT,
ADD COLUMN contact_address TEXT,
ADD COLUMN pool_type TEXT,
ADD COLUMN pool_size TEXT,
ADD COLUMN preferred_date TIMESTAMP WITH TIME ZONE;