-- Fix critical role escalation vulnerability
-- Remove the existing "Users can update own profile" policy and replace with restricted version

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Create new policy that excludes role column from user self-updates
CREATE POLICY "Users can update own profile (excluding role)"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    -- Prevent users from updating their own role
    (NEW.role = OLD.role OR NEW.role IS NULL)
  );

-- Create separate admin-only policy for role updates
CREATE POLICY "Admins can update user roles"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');