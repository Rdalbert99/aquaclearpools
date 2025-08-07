-- Fix RLS recursion by using a different approach for admin/tech access
-- The issue is the policies are still causing recursion

-- Drop all problematic policies that could cause recursion
DROP POLICY IF EXISTS "Admins and techs can view all users - no recursion" ON users;
DROP POLICY IF EXISTS "Admins and techs can update users - no recursion" ON users;
DROP POLICY IF EXISTS "Admins can insert new users - no recursion" ON users;

-- Create a simple approach: check role directly in a subquery that doesn't cause recursion
-- We'll use a more direct approach without complex EXISTS queries

-- Allow users to read their own profile + admins/techs can read all
CREATE POLICY "Users can read own profile or admins can read all" 
ON users FOR SELECT 
USING (
  -- Users can read their own profile
  auth.uid() = id
  OR
  -- OR the current user has admin/tech role (avoid recursion by limiting to current user's own record)
  (
    SELECT role FROM users WHERE id = auth.uid() LIMIT 1
  ) IN ('admin', 'tech')
);

-- Allow users to update their own profile + admins/techs can update
CREATE POLICY "Users can update own profile or admins can update" 
ON users FOR UPDATE 
USING (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- OR the current user has admin/tech role
  (
    SELECT role FROM users WHERE id = auth.uid() LIMIT 1
  ) IN ('admin', 'tech')
);

-- Allow admins to insert new users
CREATE POLICY "Admins can insert new users simple" 
ON users FOR INSERT 
WITH CHECK (
  (
    SELECT role FROM users WHERE id = auth.uid() LIMIT 1
  ) = 'admin'
);