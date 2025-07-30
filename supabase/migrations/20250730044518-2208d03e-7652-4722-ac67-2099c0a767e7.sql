-- Drop the existing restrictive policy
DROP POLICY "Users can insert own profile" ON public.users;

-- Create a new policy that allows both users to insert their own profile AND admins to insert any user
CREATE POLICY "Users can insert profiles" 
ON public.users 
FOR INSERT 
WITH CHECK (
  (auth.uid() = id) OR 
  (get_current_user_role() = 'admin'::text)
);

-- Also drop the duplicate admin policy we just created
DROP POLICY "Admins can insert new users" ON public.users;