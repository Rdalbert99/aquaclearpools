-- Ensure admins (based on role in public.users) have full privileges over users table data
-- Clean up existing conflicting/overly-permissive policies on public.users

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that conflict or are redundant
DROP POLICY IF EXISTS "Admins and techs can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins and users can update profiles" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable users to update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- Recreate clear, role-based policies using the existing helper function get_current_user_role()

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (get_current_user_role() = 'admin');

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id);

-- Admins can update any user
CREATE POLICY "Admins can update all users"
ON public.users
FOR UPDATE
USING (get_current_user_role() = 'admin');

-- Allow inserting user rows by any authenticated user (kept permissive for app flow)
CREATE POLICY "Authenticated can insert users"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
