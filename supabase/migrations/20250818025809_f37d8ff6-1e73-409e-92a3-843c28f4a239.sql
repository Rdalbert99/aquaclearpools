-- Add contact fields to clients table for service request integration
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS contact_address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.clients.contact_email IS 'Contact email for client communications';
COMMENT ON COLUMN public.clients.contact_phone IS 'Contact phone for client communications';
COMMENT ON COLUMN public.clients.contact_address IS 'Full contact address from service request';