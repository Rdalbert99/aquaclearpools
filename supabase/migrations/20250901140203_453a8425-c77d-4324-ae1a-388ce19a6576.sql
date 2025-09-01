-- Add notification preferences to clients table
ALTER TABLE public.clients 
ADD COLUMN notify_on_confirmation boolean DEFAULT true,
ADD COLUMN notify_on_assignment boolean DEFAULT true,
ADD COLUMN notification_method text DEFAULT 'email' CHECK (notification_method IN ('email', 'sms', 'both'));