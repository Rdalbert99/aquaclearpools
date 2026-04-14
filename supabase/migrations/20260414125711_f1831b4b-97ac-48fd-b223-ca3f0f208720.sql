
-- Table for tech-submitted pool chemical needs messages
CREATE TABLE public.pool_needs_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  technician_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  technician_name text NOT NULL,
  pool_size integer,
  pool_type text,
  chemical_needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  test_results jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pool_needs_messages ENABLE ROW LEVEL SECURITY;

-- Admins can view all
CREATE POLICY "pool_needs_select_admin_only"
  ON public.pool_needs_messages FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'admin');

-- Admins can update (mark read)
CREATE POLICY "pool_needs_update_admin_only"
  ON public.pool_needs_messages FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin');

-- Techs and admins can insert
CREATE POLICY "pool_needs_insert_tech_admin"
  ON public.pool_needs_messages FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() IN ('tech', 'admin'));

-- Block anon
CREATE POLICY "pool_needs_deny_anon_select"
  ON public.pool_needs_messages FOR SELECT
  TO anon USING (false);

CREATE POLICY "pool_needs_deny_anon_insert"
  ON public.pool_needs_messages FOR INSERT
  TO anon WITH CHECK (false);
