-- Create RLS policies for the users table to allow user registration

-- Allow users to insert their own profile during registration
CREATE POLICY "Users can insert their own profile during registration" 
ON public.users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
CREATE POLICY "Users can read their own profile" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id);

-- Allow admins to read all users
CREATE POLICY "Admins can read all users" 
ON public.users 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to insert new users (for admin creation features)
CREATE POLICY "Admins can insert new users" 
ON public.users 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins and techs to update users (for role management)
CREATE POLICY "Admins and techs can update users" 
ON public.users 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'tech')
  )
);