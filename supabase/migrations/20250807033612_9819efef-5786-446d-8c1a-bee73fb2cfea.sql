-- Allow unauthenticated users to lookup login credentials for authentication
CREATE POLICY "Allow login lookup for authentication" ON public.users
FOR SELECT 
TO public
USING (true);