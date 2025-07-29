-- Fix the clients RLS policy to work with joins
DROP POLICY IF EXISTS "Users can view related clients" ON clients;

-- Create a new policy that works better with joins
CREATE POLICY "Users can view related clients" 
ON public.clients 
FOR SELECT 
USING (
  -- Allow if user is admin or tech
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'tech')
  ) 
  OR 
  -- Allow if user owns this client record
  user_id = auth.uid()
);