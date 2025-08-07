-- Fix infinite recursion in users table RLS policies with correct type casting
-- Drop all existing policies on users table that might be causing recursion
DROP POLICY IF EXISTS "Allow users to view their own data" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own data" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to view basic user data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user data" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable users to update own profile" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;

-- Create simple, non-recursive policies for users table with correct type casting
CREATE POLICY "Enable read access for all users" ON public.users
FOR SELECT USING (true);

CREATE POLICY "Enable users to update own profile" ON public.users
FOR UPDATE USING (auth.uid() = id::uuid);

CREATE POLICY "Enable insert for authenticated users only" ON public.users
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);