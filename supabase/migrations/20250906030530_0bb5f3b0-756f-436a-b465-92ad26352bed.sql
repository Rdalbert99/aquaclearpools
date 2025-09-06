-- Set all clients as due (but not overdue): last_service_date 8 days ago; keep next_service_date unchanged
UPDATE public.clients
SET last_service_date = (now() - interval '8 days'),
    updated_at = now();