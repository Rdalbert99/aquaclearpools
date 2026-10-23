REVOKE ALL ON FUNCTION public.is_own_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_own_client(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.client_phone_opted_out(uuid) FROM PUBLIC, anon, authenticated;