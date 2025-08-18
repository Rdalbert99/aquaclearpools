-- DEBUG: Check if RLS policies exist and recreate them if missing
-- First check what policies exist on clients table
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'clients';
    
    RAISE NOTICE 'Found % policies on clients table', policy_count;
    
    -- If policies are missing, recreate them
    IF policy_count = 0 THEN
        RAISE NOTICE 'No RLS policies found. Recreating essential policies...';
        
        -- Recreate the essential RLS policies for clients table
        CREATE POLICY "Admins can view all clients" 
        ON public.clients 
        FOR SELECT 
        USING (EXISTS ( 
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() AND users.role = 'admin'
        ));
        
        CREATE POLICY "Assigned techs can view clients" 
        ON public.clients 
        FOR SELECT 
        USING (assigned_technician_id = auth.uid());
        
        CREATE POLICY "Clients can view their own client record" 
        ON public.clients 
        FOR SELECT 
        USING (user_id = auth.uid());
        
        CREATE POLICY "Admins and techs can insert clients" 
        ON public.clients 
        FOR INSERT 
        WITH CHECK (EXISTS ( 
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() AND users.role = ANY(ARRAY['admin', 'tech'])
        ));
        
        CREATE POLICY "Admins and techs can update clients" 
        ON public.clients 
        FOR UPDATE 
        USING (EXISTS ( 
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() AND users.role = ANY(ARRAY['admin', 'tech'])
        ));
        
        CREATE POLICY "Admins can delete clients" 
        ON public.clients 
        FOR DELETE 
        USING (EXISTS ( 
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() AND users.role = 'admin'
        ));
        
        RAISE NOTICE 'RLS policies recreated successfully';
    ELSE
        RAISE NOTICE 'RLS policies already exist - no action needed';
    END IF;
END $$;