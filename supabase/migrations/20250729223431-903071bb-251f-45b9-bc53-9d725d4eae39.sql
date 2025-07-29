-- Set up proper RLS policies for all tables

-- Create policies for users table (already has some policies)
CREATE POLICY "Users can update own profile" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON public.users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create policies for clients table (already has view policy)
CREATE POLICY "Admins and techs can insert clients" 
ON public.clients 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role IN ('admin', 'tech')
));

CREATE POLICY "Admins and techs can update clients" 
ON public.clients 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role IN ('admin', 'tech')
));

CREATE POLICY "Admins can delete clients" 
ON public.clients 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'admin'
));

-- Create policies for services table
CREATE POLICY "Users can view related services" 
ON public.services 
FOR SELECT 
USING (
  client_id IN (
    SELECT id FROM clients 
    WHERE user_id = auth.uid()
  ) OR 
  technician_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'tech')
  )
);

CREATE POLICY "Techs and admins can insert services" 
ON public.services 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role IN ('admin', 'tech')
));

CREATE POLICY "Techs and admins can update services" 
ON public.services 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role IN ('admin', 'tech')
));

CREATE POLICY "Admins can delete services" 
ON public.services 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'admin'
));

-- Create policies for service_requests table
CREATE POLICY "Users can view related service requests" 
ON public.service_requests 
FOR SELECT 
USING (
  client_id IN (
    SELECT id FROM clients 
    WHERE user_id = auth.uid()
  ) OR 
  assigned_technician_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'tech')
  )
);

CREATE POLICY "Clients can create service requests" 
ON public.service_requests 
FOR INSERT 
WITH CHECK (
  client_id IN (
    SELECT id FROM clients 
    WHERE user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'tech')
  )
);

CREATE POLICY "Techs and admins can update service requests" 
ON public.service_requests 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role IN ('admin', 'tech')
));

-- Create policies for chemical_calculations table
CREATE POLICY "Users can view related chemical calculations" 
ON public.chemical_calculations 
FOR SELECT 
USING (
  client_id IN (
    SELECT id FROM clients 
    WHERE user_id = auth.uid()
  ) OR 
  technician_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'tech')
  )
);

CREATE POLICY "Techs and admins can insert chemical calculations" 
ON public.chemical_calculations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role IN ('admin', 'tech')
));

CREATE POLICY "Techs and admins can update chemical calculations" 
ON public.chemical_calculations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role IN ('admin', 'tech')
));

-- Create sample users for testing
INSERT INTO users (id, email, password, name, role, phone, address) VALUES
('11111111-1111-1111-1111-111111111111', 'admin@poolcleaning.com', 'password', 'System Administrator', 'admin', '555-0000', '123 Admin St'),
('22222222-2222-2222-2222-222222222222', 'tech1@poolcleaning.com', 'password', 'John Technician', 'tech', '555-0001', '456 Tech Ave'),
('33333333-3333-3333-3333-333333333333', 'client1@example.com', 'password', 'Jane Client', 'client', '555-0002', '789 Client Rd')
ON CONFLICT (email) DO NOTHING;

-- Create sample clients
INSERT INTO clients (id, user_id, customer, pool_size, pool_type, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Jane Client Pool', 25000, 'Chlorine', 'Active')
ON CONFLICT (id) DO NOTHING;