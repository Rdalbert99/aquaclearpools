-- Add permission columns to users table for technician access control
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS can_create_clients BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_services BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_reports BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.users.can_create_clients IS 'Allows technician to create new client records';
COMMENT ON COLUMN public.users.can_manage_services IS 'Allows technician to manage all services, not just assigned ones';
COMMENT ON COLUMN public.users.can_view_reports IS 'Allows technician to view reports and analytics';