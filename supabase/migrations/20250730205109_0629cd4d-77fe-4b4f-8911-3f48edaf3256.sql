-- Update numeric field precisions to allow larger values for chemistry readings
ALTER TABLE public.services 
ALTER COLUMN ph_level TYPE NUMERIC(5,2),
ALTER COLUMN chlorine_level TYPE NUMERIC(6,2);