CREATE TYPE public.website_analytics_event AS ENUM ('page_view','call_click','text_click');
CREATE TYPE public.website_analytics_referral AS ENUM ('direct','search','social','referral','internal');
CREATE TABLE public.website_analytics_daily (day date NOT NULL, event public.website_analytics_event NOT NULL, referral public.website_analytics_referral NOT NULL, count integer NOT NULL DEFAULT 0, PRIMARY KEY(day,event,referral));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.website_analytics_daily TO service_role;
ALTER TABLE public.website_analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.website_analytics_metadata (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), tracking_started_at timestamptz NOT NULL DEFAULT clock_timestamp());
GRANT SELECT,INSERT,UPDATE ON public.website_analytics_metadata TO service_role;
ALTER TABLE public.website_analytics_metadata ENABLE ROW LEVEL SECURITY;
INSERT INTO public.website_analytics_metadata(singleton) VALUES(true);
CREATE TABLE public.website_analytics_budget (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), day date NOT NULL, minute timestamptz NOT NULL, daily_count integer NOT NULL, minute_count integer NOT NULL);
GRANT SELECT,INSERT,UPDATE ON public.website_analytics_budget TO service_role;
ALTER TABLE public.website_analytics_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.website_analytics_daily,public.website_analytics_metadata,public.website_analytics_budget FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.website_analytics_ingest(_event public.website_analytics_event,_referral public.website_analytics_referral,_page text) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,extensions AS $$
DECLARE t timestamptz:=clock_timestamp(); d date; m timestamptz; b public.website_analytics_budget;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_only'; END IF;
 IF _page IS DISTINCT FROM '/' OR _event IS NULL OR _referral IS NULL THEN RAISE EXCEPTION 'invalid_event'; END IF;
 d:=(t AT TIME ZONE 'America/Chicago')::date; m:=date_trunc('minute',t);
 INSERT INTO public.website_analytics_budget VALUES(true,d,m,0,0) ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM public.website_analytics_budget WHERE singleton FOR UPDATE;
 t:=clock_timestamp(); d:=(t AT TIME ZONE 'America/Chicago')::date; m:=date_trunc('minute',t);
 IF b.day<>d THEN b.daily_count:=0; END IF;
 IF b.minute<>m THEN b.minute_count:=0; END IF;
 IF b.daily_count>=10000 OR b.minute_count>=120 THEN RETURN false; END IF;
 UPDATE public.website_analytics_budget SET day=d,minute=m,daily_count=b.daily_count+1,minute_count=b.minute_count+1 WHERE singleton;
 INSERT INTO public.website_analytics_daily(day,event,referral,count) VALUES(d,_event,_referral,1)
 ON CONFLICT(day,event,referral) DO UPDATE SET count=public.website_analytics_daily.count+1;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.website_analytics_ingest(public.website_analytics_event,public.website_analytics_referral,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.website_analytics_ingest(public.website_analytics_event,public.website_analytics_referral,text) TO service_role;
CREATE FUNCTION public.website_analytics_report(_days integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE d date:=(now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin' AND status='active') THEN RAISE EXCEPTION 'active_admin_only' USING ERRCODE='42501'; END IF;
 IF _days IS NULL OR _days NOT IN (7,30,90) THEN RAISE EXCEPTION 'invalid_range'; END IF;
 RETURN jsonb_build_object('trackingStartedAt',(SELECT tracking_started_at FROM public.website_analytics_metadata WHERE singleton),'asOf',now(),'days',_days,'today',d,'rows',(SELECT coalesce(jsonb_agg(jsonb_build_object('day',day,'event',event,'referral',referral,'count',count) ORDER BY day,event,referral),'[]'::jsonb) FROM public.website_analytics_daily WHERE day BETWEEN d-(_days-1) AND d));
END $$;
REVOKE ALL ON FUNCTION public.website_analytics_report(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.website_analytics_report(integer) TO authenticated;
-- QA: all counter/budget changes and synthetic claims below roll back in subtransactions.
DO $$ DECLARE i integer; n integer; admin_id uuid; BEGIN
 BEGIN
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  DELETE FROM public.website_analytics_budget WHERE singleton;
  FOR i IN 1..120 LOOP IF NOT public.website_analytics_ingest('page_view','direct','/') THEN RAISE EXCEPTION 'increment_failed'; END IF; END LOOP;
  IF public.website_analytics_ingest('page_view','direct','/') THEN RAISE EXCEPTION 'minute_cap_failed'; END IF;
  SELECT count INTO n FROM public.website_analytics_daily WHERE day=(now() AT TIME ZONE 'America/Chicago')::date AND event='page_view' AND referral='direct';
  IF n<>120 THEN RAISE EXCEPTION 'atomic_increment_failed'; END IF;
  UPDATE public.website_analytics_budget SET minute=minute-interval '1 minute',daily_count=10000 WHERE singleton;
  IF public.website_analytics_ingest('call_click','direct','/') THEN RAISE EXCEPTION 'daily_cap_failed'; END IF;
  BEGIN PERFORM public.website_analytics_ingest('page_view','direct','/invoice'); RAISE EXCEPTION 'invalid_page_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_event' THEN RAISE; END IF; END;
  RAISE EXCEPTION 'qa_rollback';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'qa_rollback' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','public.website_analytics_ingest(public.website_analytics_event,public.website_analytics_referral,text)','execute') OR has_function_privilege('authenticated','public.website_analytics_ingest(public.website_analytics_event,public.website_analytics_referral,text)','execute') THEN RAISE EXCEPTION 'ingest_acl_failed'; END IF;
 IF has_table_privilege('authenticated','public.website_analytics_metadata','select') OR has_table_privilege('anon','public.website_analytics_daily','select') THEN RAISE EXCEPTION 'table_acl_failed'; END IF;
 BEGIN
  PERFORM set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000000"}',true);
  BEGIN PERFORM public.website_analytics_report(7); RAISE EXCEPTION 'nonadmin_allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT id INTO admin_id FROM public.users WHERE role='admin' AND status='active' LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'no_active_admin_for_qa'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',admin_id)::text,true);
  IF public.website_analytics_report(7)->>'trackingStartedAt' IS NULL THEN RAISE EXCEPTION 'admin_metadata_failed'; END IF;
  RAISE EXCEPTION 'qa_rollback';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'qa_rollback' THEN RAISE; END IF; END;
 RAISE NOTICE 'Analytics QA passed: increments, minute/daily caps, page guard, ingest/table ACL, nonadmin denial, active-admin metadata; all synthetic counters rolled back';
END $$;