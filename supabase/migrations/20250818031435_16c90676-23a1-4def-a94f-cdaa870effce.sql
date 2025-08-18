-- Add DELETE policy for admins on users table
CREATE POLICY "Admins can delete users"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (get_current_user_role() = 'admin');