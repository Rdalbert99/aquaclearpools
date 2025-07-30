-- Create client_users junction table for many-to-many relationship
CREATE TABLE public.client_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- References auth.users
  role VARCHAR DEFAULT 'member', -- 'primary', 'member', 'admin'
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);

-- Enable RLS
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Create policies for client_users
CREATE POLICY "Admins and techs can view all client users"
ON public.client_users
FOR SELECT
USING (get_current_user_role() = ANY(ARRAY['admin', 'tech']));

CREATE POLICY "Users can view their own client relationships"
ON public.client_users
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins and techs can insert client users"
ON public.client_users
FOR INSERT
WITH CHECK (get_current_user_role() = ANY(ARRAY['admin', 'tech']));

CREATE POLICY "Admins and techs can update client users"
ON public.client_users
FOR UPDATE
USING (get_current_user_role() = ANY(ARRAY['admin', 'tech']));

CREATE POLICY "Admins can delete client users"
ON public.client_users
FOR DELETE
USING (get_current_user_role() = 'admin');

-- Create indexes for better performance
CREATE INDEX idx_client_users_client_id ON public.client_users(client_id);
CREATE INDEX idx_client_users_user_id ON public.client_users(user_id);

-- Create or replace the update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_client_users_updated_at
BEFORE UPDATE ON public.client_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();