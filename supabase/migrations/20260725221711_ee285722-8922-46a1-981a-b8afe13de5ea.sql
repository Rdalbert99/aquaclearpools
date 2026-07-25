CREATE OR REPLACE FUNCTION public.enforce_insert_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- service_role / trusted server-side contexts have no auth.uid()
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_caller_role := public.get_current_user_role();

  IF COALESCE(NEW.role, 'client') <> 'client' AND COALESCE(v_caller_role, '') <> 'admin' THEN
    PERFORM public.log_security_event_enhanced(
      'role_escalation_blocked_on_insert',
      auth.uid(),
      NULL,
      'database/users',
      jsonb_build_object('attempted_role', NEW.role, 'caller_role', v_caller_role, 'target_id', NEW.id),
      'critical'
    );
    NEW.role := 'client';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_enforce_insert_role ON public.users;
CREATE TRIGGER users_enforce_insert_role
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_role_assignment();