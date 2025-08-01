-- Add service_days column to clients table to store days of the week for regular service
ALTER TABLE public.clients 
ADD COLUMN service_days TEXT[] DEFAULT '{}';

-- Add a comment to document the column
COMMENT ON COLUMN public.clients.service_days IS 'Array of days of the week when client receives regular service (monday, tuesday, etc.)';