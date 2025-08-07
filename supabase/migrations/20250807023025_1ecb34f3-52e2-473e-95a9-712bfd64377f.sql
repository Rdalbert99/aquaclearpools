-- Fix infinite recursion in users table RLS policies
-- Drop all existing policies on users table that might be causing recursion
DROP POLICY IF EXISTS "Allow users to view their own data" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own data" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to view basic user data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own user data" ON public.users;

-- Create simple, non-recursive policies for users table
CREATE POLICY "Enable read access for all users" ON public.users
FOR SELECT USING (true);

CREATE POLICY "Enable users to update own profile" ON public.users
FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY "Enable insert for authenticated users only" ON public.users
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);