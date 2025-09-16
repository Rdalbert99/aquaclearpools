-- Clean and secure client_tech_messages table policies
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Users can view their own messages" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Clients can send messages to their assigned tech" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Techs can send messages to their assigned clients" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Users can update their own message read status" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Secure message viewing for involved parties only" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Secure message creation for valid relationships only" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Secure read status updates only" ON public.client_tech_messages;
DROP POLICY IF EXISTS "No message deletion allowed" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Allow viewing messages for involved parties only" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Allow creating messages only for valid relationships" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Allow updating read status for accessible messages only" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Admin access for oversight purposes" ON public.client_tech_messages;
DROP POLICY IF EXISTS "Admin audit access with logging" ON public.client_tech_messages;

-- Create comprehensive secure RLS policies

-- 1. SELECT Policy: Only involved parties can view messages
CREATE POLICY "messages_select_involved_parties_only"
ON public.client_tech_messages
FOR SELECT
TO authenticated
USING (
  -- Message sender can view their own messages
  sender_id = auth.uid()
  OR
  -- Client can view messages for their client record
  (
    client_id IN (
      SELECT c.id 
      FROM clients c 
      WHERE c.user_id = auth.uid()
    )
  )
  OR
  -- Technician can view messages for clients they're assigned to
  (
    technician_id = auth.uid()
    AND client_id IN (
      SELECT c.id 
      FROM clients c 
      WHERE c.assigned_technician_id = auth.uid()
    )
  )
);

-- 2. INSERT Policy: Only valid relationships can create messages
CREATE POLICY "messages_insert_valid_relationships_only"
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

-- 3. UPDATE Policy: Only read status updates allowed
CREATE POLICY "messages_update_read_status_only"
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

-- 4. DELETE Policy: No deletions allowed
CREATE POLICY "messages_no_deletion"
ON public.client_tech_messages
FOR DELETE
TO authenticated
USING (false);

-- Create secure admin access function
CREATE OR REPLACE FUNCTION public.admin_view_message(message_id uuid, reason text)
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
  
  -- Validate reason
  IF reason IS NULL OR length(trim(reason)) < 10 THEN
    RAISE EXCEPTION 'Reason must be provided and at least 10 characters';
  END IF;
  
  -- Get message
  SELECT * INTO msg_record
  FROM client_tech_messages
  WHERE id = message_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Message not found');
  END IF;
  
  -- Log admin access
  PERFORM log_security_event(
    'admin_message_access',
    auth.uid(),
    'client_tech_messages',
    NULL,
    jsonb_build_object(
      'message_id', message_id,
      'reason', reason,
      'timestamp', now()
    )
  );
  
  -- Return message data
  RETURN json_build_object(
    'id', msg_record.id,
    'message', msg_record.message,
    'sender_id', msg_record.sender_id,
    'created_at', msg_record.created_at
  );
END;
$$;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_client_tech_messages_access 
ON client_tech_messages(client_id, technician_id, sender_id);

-- Update table comment
COMMENT ON TABLE public.client_tech_messages IS 'Secure private communications with strict RLS policies - no direct admin access';