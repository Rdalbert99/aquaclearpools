-- Adjust RLS policies to ensure admins see all clients; techs only see assigned clients

-- Clients table: replace broad select policy with granular ones
DROP POLICY IF EXISTS "Users can view related clients" ON public.clients;

CREATE POLICY "Admins can view all clients"
ON public.clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Assigned techs can view clients"
ON public.clients
FOR SELECT
USING (
  assigned_technician_id = auth.uid()
);

CREATE POLICY "Clients can view their own client record"
ON public.clients
FOR SELECT
USING (
  user_id = auth.uid()
);

-- Service requests: restrict tech visibility to assigned; keep admins and clients
DROP POLICY IF EXISTS "Techs and admins can view all service requests" ON public.service_requests;

CREATE POLICY "Admins can view all service requests"
ON public.service_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Assigned techs can view service requests"
ON public.service_requests
FOR SELECT
USING (
  assigned_technician_id = auth.uid()
);

CREATE POLICY "Clients can view their own service requests"
ON public.service_requests
FOR SELECT
USING (
  client_id IN (
    SELECT clients.id FROM public.clients
    WHERE clients.user_id = auth.uid()
  )
);
