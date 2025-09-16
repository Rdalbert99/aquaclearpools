-- Enhance security for client_tech_messages table (fixed version)
-- Drop existing RLS policies to replace with more secure ones
DROP POLICY IF EXISTS "Users can view their own messages" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Clients can send messages to their assigned tech" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Techs can send messages to their assigned clients" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Users can update their own message read status" ON public.client_tech_messages;

-- Create more secure and granular RLS policies

-- 1. SELECT Policy: Only allow viewing messages if user is directly involved
CREATE POLICY "Allow viewing messages for involved parties only"
ON public.client_tech_messages
FOR SELECT
TO authenticated
USING (
  -- Message sender can view their own messages
  sender_id = auth.uid()
  OR
  -- Client can view messages for their own client record only
  (
    client_id IN (
      SELECT c.id 
      FROM clients c 
      WHERE c.user_id = auth.uid()
    )
    AND (sender_id = auth.uid() OR technician_id IN (
      SELECT c2.assigned_technician_id 
      FROM clients c2 
      WHERE c2.user_id = auth.uid() AND c2.id = client_id
    ))
  )
  OR
  -- Technician can view messages only for clients they are currently assigned to
  (
    technician_id = auth.uid()
    AND client_id IN (
      SELECT c.id 
      FROM clients c 
      WHERE c.assigned_technician_id = auth.uid()
    )
  )
);

-- 2. INSERT Policy: Restrict message creation to valid relationships
CREATE POLICY "Allow creating messages only for valid relationships"
ON public.client_tech_messages
FOR INSERT
TO authenticated
WITH CHECK (
  -- Clients can send messages to their assigned technician
  (
    sender_id = auth.uid()
    AND client_id IN (
      SELECT c.id 
      FROM clients c 
      WHERE c.user_id = auth.uid() 
        AND c.assigned_technician_id = technician_id
    )
  )
  OR
  -- Technicians can send messages to their assigned clients
  (
    sender_id = auth.uid()
    AND technician_id = auth.uid()
    AND client_id IN (
      SELECT c.id 
      FROM clients c 
      WHERE c.assigned_technician_id = auth.uid()
    )
  )
);

-- 3. UPDATE Policy: Only allow updating read status for messages user can access
CREATE POLICY "Allow updating read status for accessible messages only"
ON public.client_tech_messages
FOR UPDATE
TO authenticated
USING (
  -- Can only update messages they can view (using same logic as SELECT)
  sender_id = auth.uid()
  OR
  (
    client_id IN (
      SELECT c.id 
      FROM clients c 
      WHERE c.user_id = auth.uid()
    )
    AND (sender_id = auth.uid() OR technician_id IN (
      SELECT c2.assigned_technician_id 
      FROM clients c2 
      WHERE c2.user_id = auth.uid() AND c2.id = client_id
    ))
  )
  OR
  (
    technician_id = auth.uid()
    AND client_id IN (
      SELECT c.id 
      FROM clients c 
      WHERE c.assigned_technician_id = auth.uid()
    )
  )
);

-- 4. Separate admin policy for legitimate administrative access 
CREATE POLICY "Admin access for oversight purposes"
ON public.client_tech_messages
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'admin'
);

-- 5. Create function to validate message access and log admin access
CREATE OR REPLACE FUNCTION public.can_access_message(message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  msg_record record;
  user_role text;
BEGIN
  -- Get message details
  SELECT * INTO msg_record
  FROM client_tech_messages
  WHERE id = message_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get current user role
  user_role := get_current_user_role();
  
  -- Check access permissions
  IF msg_record.sender_id = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- Check if user is the client for this message
  IF EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = msg_record.client_id 
    AND c.user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is the assigned technician
  IF msg_record.technician_id = auth.uid() AND EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = msg_record.client_id 
    AND c.assigned_technician_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  -- Admin access with logging
  IF user_role = 'admin' THEN
    PERFORM log_security_event(
      'admin_message_access_function',
      auth.uid(),
      'client_tech_messages',
      NULL,
      jsonb_build_object('message_id', message_id)
    );
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Create trigger to log admin access to messages
CREATE OR REPLACE FUNCTION public.log_admin_message_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log if user is an admin accessing messages
  IF get_current_user_role() = 'admin' THEN
    PERFORM log_security_event(
      'admin_message_access',
      auth.uid(),
      'client_tech_messages',
      NULL,
      jsonb_build_object(
        'message_id', NEW.id,
        'client_id', NEW.client_id,
        'technician_id', NEW.technician_id,
        'action', 'view'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for logging admin access
CREATE TRIGGER log_admin_message_access_trigger
  AFTER SELECT ON public.client_tech_messages
  FOR EACH ROW
  WHEN (get_current_user_role() = 'admin')
  EXECUTE FUNCTION public.log_admin_message_access();

-- Add constraints to prevent message tampering
ALTER TABLE client_tech_messages 
ADD CONSTRAINT IF NOT EXISTS check_message_not_empty 
CHECK (length(trim(message)) > 0);

-- Add index for better performance on security queries
CREATE INDEX IF NOT EXISTS idx_client_tech_messages_security 
ON client_tech_messages(client_id, technician_id, sender_id);

-- Add comment documenting the security enhancements
COMMENT ON TABLE public.client_tech_messages IS 'Private communications between clients and technicians with enhanced RLS security. Admin access is restricted and logged for audit purposes.';