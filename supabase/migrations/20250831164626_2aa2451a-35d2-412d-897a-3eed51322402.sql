-- Lock down clients table from PUBLIC/anon without changing existing RLS behavior
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clients FROM PUBLIC;
REVOKE ALL ON TABLE public.clients FROM anon;