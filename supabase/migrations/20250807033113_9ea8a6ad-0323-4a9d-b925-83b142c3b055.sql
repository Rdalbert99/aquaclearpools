-- Drop problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can insert profiles" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile during registration" ON public.users; 
DROP POLICY IF EXISTS "Admins can insert new users simple" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile or admins can read all" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile or admins can update" ON public.users;

-- Create simple, non-recursive INSERT policies
CREATE POLICY "Allow authenticated users to insert" ON public.users
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create simple SELECT policy for admins and techs
CREATE POLICY "Admins and techs can read all users" ON public.users
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM auth.users 
  WHERE auth.users.id = auth.uid() 
  AND auth.users.email IN ('admin@poolcleaning.com')
) OR auth.uid() = id);

-- Create simple UPDATE policy  
CREATE POLICY "Admins and users can update profiles" ON public.users
FOR UPDATE
TO authenticated  
USING (EXISTS (
  SELECT 1 FROM auth.users 
  WHERE auth.users.id = auth.uid() 
  AND auth.users.email IN ('admin@poolcleaning.com')
) OR auth.uid() = id);