-- Add services_performed column to services table
ALTER TABLE public.services 
ADD COLUMN services_performed TEXT;