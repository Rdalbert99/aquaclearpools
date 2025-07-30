-- Add company/organization field to clients table
ALTER TABLE public.clients 
ADD COLUMN company_name VARCHAR(255),
ADD COLUMN is_multi_property BOOLEAN DEFAULT false;