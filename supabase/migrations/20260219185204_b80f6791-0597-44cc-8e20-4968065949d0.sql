
-- Drop the problematic policy
DROP POLICY IF EXISTS "clients_select_04_servicing_tech_history" ON public.clients;

-- Create a helper function that bypasses RLS to check service history
CREATE OR REPLACE FUNCTION public.tech_has_serviced_client(p_client_id uuid, p_tech_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM services
    WHERE client_id = p_client_id AND technician_id = p_tech_id
  );
$$;

-- Recreate the policy using the helper function (no recursion)
CREATE POLICY "clients_select_04_servicing_tech_history"
ON public.clients
FOR SELECT
USING (
  (get_current_user_role() = 'tech'::text)
  AND tech_has_serviced_client(id, auth.uid())
);
