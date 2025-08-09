-- Add title field to service_requests table
ALTER TABLE public.service_requests 
ADD COLUMN contact_title text;