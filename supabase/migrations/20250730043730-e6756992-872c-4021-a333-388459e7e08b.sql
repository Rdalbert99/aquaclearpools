-- Add policy to allow admins to insert new users
CREATE POLICY "Admins can insert new users" 
ON public.users 
FOR INSERT 
WITH CHECK (get_current_user_role() = 'admin'::text);