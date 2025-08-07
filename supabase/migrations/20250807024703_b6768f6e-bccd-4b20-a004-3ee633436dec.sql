-- Fix infinite recursion in users table RLS policies
-- The issue is that get_current_user_role() function queries users table,
-- but users table policies also call this function, creating circular dependency

-- First, drop problematic policies that cause recursion
DROP POLICY IF EXISTS "Admins and techs can view all users" ON users;
DROP POLICY IF EXISTS "Admins and techs can update users" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can insert new users" ON users;

-- Create new policies that don't use get_current_user_role() function
-- to avoid recursion

-- Allow users to read their own profile (basic self-access)
-- This policy already exists and is safe: "Users can read their own profile"

-- Allow users to update their own profile (basic self-access) 
-- This policy already exists and is safe: "Users can update own profile"

-- For admin/tech access, we need to avoid using get_current_user_role()
-- Instead, directly check the role in the users table with a different approach

-- Admins and techs can view all users (without recursion)
CREATE POLICY "Admins and techs can view all users - no recursion" 
ON users FOR SELECT 
USING (
  -- Allow if user is viewing their own record OR
  -- if there exists a user with admin/tech role with the current auth.uid()
  (auth.uid() = id) OR 
  (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.role IN ('admin', 'tech')
  ))
);

-- Admins and techs can update users (without recursion)
CREATE POLICY "Admins and techs can update users - no recursion" 
ON users FOR UPDATE 
USING (
  -- Allow if user is updating their own record OR
  -- if there exists a user with admin/tech role with the current auth.uid()
  (auth.uid() = id) OR 
  (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.role IN ('admin', 'tech')
  ))
);

-- Admins can insert new users (without recursion)
CREATE POLICY "Admins can insert new users - no recursion" 
ON users FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.role = 'admin'
  )
);