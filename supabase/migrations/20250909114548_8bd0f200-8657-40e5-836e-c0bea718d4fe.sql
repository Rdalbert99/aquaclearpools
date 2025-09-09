-- Add profile image support and messaging functionality for clients

-- Add profile_image_url to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Create client_tech_messages table for communication
CREATE TABLE IF NOT EXISTS public.client_tech_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  technician_id UUID NOT NULL,
  sender_id UUID NOT NULL, -- can be client or technician
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'general' CHECK (message_type IN ('general', 'service_request', 'special_instruction')),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_tech_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for messages
CREATE POLICY "Users can view their own messages" 
ON public.client_tech_messages 
FOR SELECT 
USING (
  sender_id = auth.uid() OR 
  (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())) OR
  technician_id = auth.uid() OR
  get_current_user_role() = 'admin'
);

CREATE POLICY "Clients can send messages to their assigned tech" 
ON public.client_tech_messages 
FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() AND 
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()) AND
  technician_id IN (SELECT assigned_technician_id FROM clients WHERE user_id = auth.uid())
);

CREATE POLICY "Techs can send messages to their assigned clients" 
ON public.client_tech_messages 
FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() AND 
  (technician_id = auth.uid() OR get_current_user_role() = 'admin') AND
  client_id IN (SELECT id FROM clients WHERE assigned_technician_id = auth.uid() OR get_current_user_role() = 'admin')
);

CREATE POLICY "Users can update their own message read status" 
ON public.client_tech_messages 
FOR UPDATE 
USING (
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()) OR
  technician_id = auth.uid() OR
  get_current_user_role() = 'admin'
);

-- Add trigger for updated_at
CREATE TRIGGER update_client_tech_messages_updated_at
BEFORE UPDATE ON public.client_tech_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();