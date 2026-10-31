CREATE POLICY analytics_server_only ON public.website_analytics_daily TO service_role USING(true) WITH CHECK(true);
CREATE POLICY analytics_server_only ON public.website_analytics_metadata TO service_role USING(true) WITH CHECK(true);
CREATE POLICY analytics_server_only ON public.website_analytics_budget TO service_role USING(true) WITH CHECK(true);
DROP FUNCTION public.website_analytics_report(integer);
CREATE FUNCTION public.website_analytics_report(_days integer,_actor uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,extensions AS $$
DECLARE d date:=(now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR _actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=_actor AND role='admin' AND status='active') THEN RAISE EXCEPTION 'active_admin_only' USING ERRCODE='42501'; END IF;
 IF _days IS NULL OR _days NOT IN (7,30,90) THEN RAISE EXCEPTION 'invalid_range'; END IF;
 RETURN jsonb_build_object('trackingStartedAt',(SELECT tracking_started_at FROM public.website_analytics_metadata WHERE singleton),'asOf',now(),'days',_days,'today',d,'rows',(SELECT coalesce(jsonb_agg(jsonb_build_object('day',day,'event',event,'referral',referral,'count',count) ORDER BY day,event,referral),'[]'::jsonb) FROM public.website_analytics_daily WHERE day BETWEEN d-(_days-1) AND d));
END $$;
REVOKE ALL ON FUNCTION public.website_analytics_report(integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.website_analytics_report(integer,uuid) TO service_role;
DO $$ DECLARE a uuid; BEGIN
 BEGIN
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 BEGIN PERFORM public.website_analytics_report(7,'00000000-0000-0000-0000-000000000000'); RAISE EXCEPTION 'nonadmin_allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT id INTO a FROM public.users WHERE role='admin' AND status='active' LIMIT 1;
 IF public.website_analytics_report(7,a)->>'trackingStartedAt' IS NULL THEN RAISE EXCEPTION 'admin_failed'; END IF;
 RAISE EXCEPTION 'qa_rollback';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'qa_rollback' THEN RAISE; END IF; END;
 IF has_function_privilege('authenticated','public.website_analytics_report(integer,uuid)','execute') OR has_function_privilege('anon','public.website_analytics_report(integer,uuid)','execute') THEN RAISE EXCEPTION 'report_acl_failed'; END IF;
END $$;