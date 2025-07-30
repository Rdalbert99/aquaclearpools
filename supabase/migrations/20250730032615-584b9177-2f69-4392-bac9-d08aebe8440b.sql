-- Create login tracking table
CREATE TABLE public.user_logins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;

-- Create policies for login tracking
CREATE POLICY "Admins can view all login records"
ON public.user_logins
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE users.id = auth.uid() AND users.role = 'admin'
));

CREATE POLICY "System can insert login records"
ON public.user_logins
FOR INSERT
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_user_logins_user_id ON public.user_logins(user_id);
CREATE INDEX idx_user_logins_login_time ON public.user_logins(login_time);