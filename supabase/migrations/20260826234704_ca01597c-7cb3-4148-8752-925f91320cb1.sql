REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.commercial_can_view_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.commercial_can_view_facility(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.commercial_can_view_client(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_equipment_issue_change() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commercial_can_view_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commercial_can_view_facility(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commercial_can_view_client(uuid) TO authenticated, service_role;