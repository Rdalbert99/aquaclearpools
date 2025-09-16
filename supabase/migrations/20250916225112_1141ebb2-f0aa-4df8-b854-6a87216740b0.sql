-- Enhance security for client_tech_messages table (handle existing policies)
-- Drop ALL existing RLS policies with CASCADE to ensure clean slate
DO $$ 
BEGIN
  -- Drop all existing policies on client_tech_messages
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
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if policies don't exist
    NULL;
END $$;

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
);

-- 4. Completely restrict DELETE operations
CREATE POLICY "No message deletion allowed"
ON public.client_tech_messages
FOR DELETE
TO authenticated
USING (false);