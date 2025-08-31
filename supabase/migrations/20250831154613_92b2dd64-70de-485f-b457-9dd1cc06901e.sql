-- Enforce active status for self-updates on users table
DROP POLICY IF EXISTS "Users can update own profile (excluding role)" ON public.users;
CREATE POLICY "Users can update own profile (excluding role)"
ON public.users
FOR UPDATE
USING (auth.uid() = id AND status = 'active')
WITH CHECK ((auth.uid() = id AND status = 'active') AND (role = (SELECT u.role FROM public.users AS u WHERE u.id = auth.uid())));

-- Ensure admins can still update all users regardless of status
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can update all users"
ON public.users
FOR UPDATE
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');