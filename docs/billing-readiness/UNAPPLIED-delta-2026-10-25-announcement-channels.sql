-- UNAPPLIED DELTA — owner review required before installation. Do not auto-apply.
-- Apply AFTER UNAPPLIED-source-guards.sql. Replaces qbo_billing_approve_announcement with a
-- channel-aware signature: one exact reviewed text per channel, stored unmodified.
-- SMS keeps the required 'Aqua Clear Pools:' prefix and 'Reply STOP to opt out.' footer;
-- email never carries the SMS wrapper. No anon/authenticated grants; service_role EXECUTE only.
BEGIN;
REVOKE ALL ON FUNCTION public.qbo_billing_approve_announcement(uuid,text,text,uuid,uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION public.qbo_billing_approve_announcement(uuid,text,text,uuid,uuid,uuid,text,jsonb);

CREATE FUNCTION public.qbo_billing_approve_announcement(_business uuid,_environment text,_realm text,_client uuid,_actor uuid,_scope_id uuid,_channel text,_text text,_snapshot jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$ BEGIN
  PERFORM public.qbo_billing_admin(_business,_actor);
  IF _scope_id IS NULL OR _channel IS NULL OR _channel NOT IN ('sms','email') OR _text IS NULL OR length(_text)<1 OR length(_text)>2000 THEN RAISE EXCEPTION 'announcement_review_required'; END IF;
  IF _snapshot IS NULL OR NOT (_snapshot->'channels' ? _channel) THEN RAISE EXCEPTION 'announcement_review_required'; END IF;
  IF _channel='sms' AND (_text NOT LIKE 'Aqua Clear Pools:%' OR _text NOT LIKE '%Reply STOP to opt out.') THEN RAISE EXCEPTION 'announcement_review_required'; END IF;
  IF _channel='email' AND _text LIKE '%Reply STOP to opt out.%' THEN RAISE EXCEPTION 'announcement_review_required'; END IF; -- the SMS wrapper is never stored on email
  PERFORM public.qbo_billing_assert_enrollment(_business,_environment,_realm,_client,_snapshot);
  -- One immutable approved text per customer/channel/send day; any later difference is rejected.
  IF EXISTS(SELECT 1 FROM public.qbo_billing_announcements WHERE business_id=_business AND environment=_environment AND realm_id=_realm AND client_id=_client AND channel=_channel AND send_day=((_snapshot->>'sendAt')::timestamptz AT TIME ZONE 'America/Chicago')::date AND (scope_id IS DISTINCT FROM _scope_id OR snapshot IS DISTINCT FROM _snapshot OR approved_text IS DISTINCT FROM _text)) THEN RAISE EXCEPTION 'immutable_announcement'; END IF;
  INSERT INTO public.qbo_billing_announcements(business_id,environment,realm_id,client_id,send_day,channel,scope_id,snapshot,approved_text,approved_by)
  VALUES(_business,_environment,_realm,_client,((_snapshot->>'sendAt')::timestamptz AT TIME ZONE 'America/Chicago')::date,_channel,_scope_id,_snapshot,_text,_actor)
  ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.qbo_billing_approve_announcement(uuid,text,text,uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qbo_billing_approve_announcement(uuid,text,text,uuid,uuid,uuid,text,text,jsonb) TO service_role;
COMMIT;
-- Restricted changes for review: qbo_billing_approve_announcement signature changes from
-- (uuid,text,text,uuid,uuid,uuid,text,jsonb) to (uuid,text,text,uuid,uuid,uuid,text,text,jsonb)
-- adding _channel. Old signature revoked and dropped; new signature service_role EXECUTE only.
-- No table grants, no public access widening, no schedule/activation change.
