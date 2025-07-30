-- Add service configuration fields to clients table
ALTER TABLE public.clients 
ADD COLUMN service_rate DECIMAL(10,2) DEFAULT 0,
ADD COLUMN service_frequency VARCHAR(50) DEFAULT 'weekly',
ADD COLUMN next_service_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN included_services TEXT[] DEFAULT '{}',
ADD COLUMN service_notes TEXT;