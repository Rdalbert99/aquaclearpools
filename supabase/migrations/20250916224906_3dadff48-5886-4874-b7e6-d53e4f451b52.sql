-- Enhance security for client_tech_messages table (simplified secure version)
-- Drop existing RLS policies to replace with more secure ones
DROP POLICY IF EXISTS "Users can view their own messages" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Clients can send messages to their assigned tech" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Techs can send messages to their assigned clients" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Users can update their own message read status" ON public.client_tech_messages;

-- 1. SELECT Policy: Strict access control - no broad admin access
CREATE POLICY "Secure message viewing for involved parties only"
ON public.client_tech_messages
FOR SELECT
TO authenticated
USING (
  -- Message sender can view their own messages
  sender_id = auth.uid()
  OR
  -- Client can view messages only for their own client record and only if they're involved
  (
    client_id IN (
      SELECT c.id 
      FROM clients c 
      WHERE c.user_id = auth.uid()
    )
    AND (
      sender_id = auth.uid() 
      OR technician_id IN (
        SELECT c2.assigned_technician_id 
        FROM clients c2 
        WHERE c2.user_id = auth.uid() AND c2.id = client_id
      )
    )
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

-- 2. INSERT Policy: Strict message creation controls
CREATE POLICY "Secure message creation for valid relationships only"
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

-- 3. UPDATE Policy: Restrict to read status updates only
CREATE POLICY "Secure read status updates only"
ON public.client_tech_messages
FOR UPDATE
TO authenticated
USING (
  -- Can only update messages they can view
  sender_id = auth.uid()
  OR
  (
    client_id IN (
      SELECT c.id 
      FROM clients c 
      WHERE c.user_id = auth.uid()
    )
    AND (
      sender_id = auth.uid() 
      OR technician_id IN (
        SELECT c2.assigned_technician_id 
        FROM clients c2 
        WHERE c2.user_id = auth.uid() AND c2.id = client_id
      )
    )
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
)
WITH CHECK (
  -- Prevent modification of core message data - only allow read_at updates
  message = (SELECT message FROM client_tech_messages WHERE id = client_tech_messages.id)
  AND sender_id = (SELECT sender_id FROM client_tech_messages WHERE id = client_tech_messages.id)
  AND client_id = (SELECT client_id FROM client_tech_messages WHERE id = client_tech_messages.id)
  AND technician_id = (SELECT technician_id FROM client_tech_messages WHERE id = client_tech_messages.id)
  AND message_type = (SELECT message_type FROM client_tech_messages WHERE id = client_tech_messages.id)
  AND created_at = (SELECT created_at FROM client_tech_messages WHERE id = client_tech_messages.id)
  AND updated_at >= (SELECT updated_at FROM client_tech_messages WHERE id = client_tech_messages.id)
);

-- 4. Completely restrict DELETE operations
CREATE POLICY "No message deletion allowed"
ON public.client_tech_messages
FOR DELETE
TO authenticated
USING (false);

-- 5. Create secure function for admin oversight (when absolutely necessary)
CREATE OR REPLACE FUNCTION public.admin_access_message(message_id uuid, admin_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  msg_record record;
  user_role text;
BEGIN
  -- Verify admin role
  user_role := get_current_user_role();
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Only administrators can use this function';
  END IF;
  
  -- Validate reason is provided
  IF admin_reason IS NULL OR length(trim(admin_reason)) < 10 THEN
    RAISE EXCEPTION 'Admin reason must be provided and at least 10 characters';
  END IF;
  
  -- Get message details
  SELECT * INTO msg_record
  FROM client_tech_messages
  WHERE id = message_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Message not found');
  END IF;
  
  -- Log admin access
  PERFORM log_security_event(
    'admin_message_override_access',
    auth.uid(),
    'client_tech_messages',
    NULL,
    jsonb_build_object(
      'message_id', message_id,
      'client_id', msg_record.client_id,
      'technician_id', msg_record.technician_id,
      'admin_reason', admin_reason,
      'accessed_at', now()
    )
  );
  
  -- Return sanitized message data
  RETURN json_build_object(
    'id', msg_record.id,
    'client_id', msg_record.client_id,
    'technician_id', msg_record.technician_id,
    'sender_id', msg_record.sender_id,
    'message', msg_record.message,
    'message_type', msg_record.message_type,
    'created_at', msg_record.created_at,
    'read_at', msg_record.read_at
  );
END;
$$;

-- Add constraints to prevent message tampering
ALTER TABLE client_tech_messages 
ADD CONSTRAINT IF NOT EXISTS check_message_not_empty 
CHECK (length(trim(message)) > 0);

-- Add constraint to ensure sender is either client user or technician
ALTER TABLE client_tech_messages 
ADD CONSTRAINT IF NOT EXISTS check_valid_sender
CHECK (
  sender_id IN (
    SELECT user_id FROM clients WHERE id = client_id
    UNION
    SELECT assigned_technician_id FROM clients WHERE id = client_id
  )
);

-- Add index for better performance on security queries
CREATE INDEX IF NOT EXISTS idx_client_tech_messages_security 
ON client_tech_messages(client_id, technician_id, sender_id);

-- Add index for read status queries
CREATE INDEX IF NOT EXISTS idx_client_tech_messages_read_status 
ON client_tech_messages(read_at) WHERE read_at IS NULL;

-- Add comment documenting the security enhancements
COMMENT ON TABLE public.client_tech_messages IS 'Private communications between clients and technicians with strict RLS security. No broad admin access - admin oversight requires explicit function call with justification and full audit logging.';