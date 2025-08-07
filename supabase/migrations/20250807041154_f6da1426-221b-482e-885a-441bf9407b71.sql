-- Add assigned technician field to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES public.users(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_clients_assigned_technician ON public.clients(assigned_technician_id);