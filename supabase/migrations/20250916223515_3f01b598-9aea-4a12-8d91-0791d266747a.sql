-- Add RLS policy to allow admins and techs to view user profiles associated with clients they can access
CREATE POLICY "Admins and techs can view client-associated users"
ON public.users
FOR SELECT
TO authenticated
USING (
  -- Allow if user is admin or tech
  (get_current_user_role() IN ('admin', 'tech'))
  -- Or if this user is associated with a client that the current user can access
  OR (
    id IN (
      SELECT c.user_id 
      FROM clients c 
      WHERE c.user_id = users.id
      AND (
        -- Admins can see all clients
        get_current_user_role() = 'admin'
        -- Techs can see their assigned clients
        OR (get_current_user_role() = 'tech' AND c.assigned_technician_id = auth.uid())
        -- Users can see their own client profile
        OR c.user_id = auth.uid()
      )
    )
  )
);