-- EXACT frozen owner-provided cohort at 2026-10-25 12:32:45 UTC. NOT APPLIED.
-- Requires schema/source guards first. Set reviewed actor explicitly; no invented identity.
BEGIN;
DO $$ BEGIN IF current_setting('billing.reviewed_actor',true) IS NULL THEN RAISE EXCEPTION 'reviewed_actor_required'; END IF; END $$;
CREATE TEMP TABLE frozen_billing_cohort(client_id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO frozen_billing_cohort VALUES
('031f318d-5df5-4295-aba2-415089197496'::uuid),
('067f0f4b-99ef-44bd-b94b-0a594da7c484'::uuid),
('1445fb68-640b-48fa-bdc1-e951f4c677e2'::uuid),
('15d8a7d0-769c-4b46-954a-e23f3f07c5d8'::uuid),
('1db5a625-bef6-40d5-bf01-7ba1c0ccd979'::uuid),
('208cdcbc-375c-495f-8838-0e1f2003038c'::uuid),
('3e938a8a-74c2-4ba2-a163-ce2e870b85a7'::uuid),
('472db2d2-1095-421c-a13c-bc8d57880da9'::uuid),
('48b93a78-2b8e-465e-8026-b1482295c3e7'::uuid),
('48cc0b91-a675-48df-89c1-8a12c9550efb'::uuid),
('4927c927-8011-48f1-b703-db2e0e9e86ae'::uuid),
('5cc2d5fc-7cac-438a-bd70-5c3fd2a1b1ac'::uuid),
('6305a08e-8804-4d83-bfcc-a5d2d00a353c'::uuid),
('66aacb7e-8b5a-4039-9032-17bb3967bffc'::uuid),
('6d228b42-7306-467f-9a9d-89f31ad4f599'::uuid),
('763a94b0-a4c7-4f57-90ca-0145abad7fe3'::uuid),
('88fed2de-b36a-479b-ae46-a790832236cd'::uuid),
('89a51663-dba0-4e32-b93f-1a138c1b123a'::uuid),
('9617d397-e235-4e58-b6d3-81e7caeb7763'::uuid),
('9a8f6dce-bd90-4995-aa91-50664e45d81b'::uuid),
('9f72bc8d-abc7-4b93-8d92-d747688fdadd'::uuid),
('a434582f-342f-442f-959c-b9225b9acac4'::uuid),
('a44de5db-11fc-43b6-8e73-5d50ae32eb87'::uuid),
('ae37e824-514d-4af3-beed-47c66428e838'::uuid),
('b5bbd703-cc0c-436e-85a7-0dba88891347'::uuid),
('b9e01be9-9b5c-40bf-ad56-31b481aa298c'::uuid),
('cc6853a2-9707-4b5c-ba28-c580d250eb80'::uuid),
('d53635f4-29b1-401a-b27a-4807a5bd0f69'::uuid),
('da381bf3-d136-4431-9170-50d3884fea50'::uuid),
('db4d0008-fa65-4bbe-8bba-99c1d32fd08e'::uuid),
('dcee3013-3d67-4ae3-a3ec-61b94e98fb84'::uuid),
('dcfb296f-84e1-4af7-a849-0f33f3437ebe'::uuid),
('ece13793-1be9-462d-a613-a339ba51f1ba'::uuid);
DO $$ BEGIN IF (SELECT count(*) FROM frozen_billing_cohort)<>33 THEN RAISE EXCEPTION 'invalid_cohort'; END IF; END $$;
SELECT public.qbo_billing_admin('a34bd007-c8b1-455c-8063-2ff0236e5181',current_setting('billing.reviewed_actor')::uuid);
INSERT INTO public.qbo_billing_client_scope(business_id,environment,realm_id,client_id,owner_hold,cohort_as_of)
SELECT 'a34bd007-c8b1-455c-8063-2ff0236e5181','production','9341452568721903',f.client_id,
f.client_id='15d8a7d0-769c-4b46-954a-e23f3f07c5d8','2026-10-25T12:32:45Z' FROM frozen_billing_cohort f JOIN public.clients c ON c.id=f.client_id
WHERE c.created_at<='2026-10-25T12:32:45Z' AND lower(trim(c.status))='active'
ON CONFLICT DO NOTHING;
INSERT INTO public.qbo_billing_enrollment(business_id,environment,realm_id,client_id,enabled,first_service_period,updated_by)
SELECT s.business_id,s.environment,s.realm_id,s.client_id,NOT s.owner_hold,'2026-11',current_setting('billing.reviewed_actor')::uuid
FROM public.qbo_billing_client_scope s JOIN frozen_billing_cohort f ON f.client_id=s.client_id
WHERE s.business_id='a34bd007-c8b1-455c-8063-2ff0236e5181' AND s.environment='production' AND s.realm_id='9341452568721903'
ON CONFLICT DO NOTHING;
INSERT INTO public.qbo_billing_enrollment_audit(business_id,environment,realm_id,client_id,actor,new_value)
SELECT e.business_id,e.environment,e.realm_id,e.client_id,current_setting('billing.reviewed_actor')::uuid,
public.qbo_billing_read_enrollment(e.business_id,e.environment,e.realm_id,e.client_id)
FROM public.qbo_billing_enrollment e JOIN frozen_billing_cohort f ON f.client_id=e.client_id
WHERE e.business_id='a34bd007-c8b1-455c-8063-2ff0236e5181' AND e.environment='production' AND e.realm_id='9341452568721903'
AND NOT EXISTS(SELECT 1 FROM public.qbo_billing_enrollment_audit a WHERE a.business_id=e.business_id AND a.environment=e.environment AND a.realm_id=e.realm_id AND a.client_id=e.client_id);
INSERT INTO public.qbo_billing_annual_config VALUES
('a34bd007-c8b1-455c-8063-2ff0236e5181','production','9341452568721903','6d228b42-7306-467f-9a9d-89f31ad4f599','{"frequency":"annual","renewalMonth":11,"renewalConfirmed":true,"amountCents":300000,"amountConfirmed":true,"channel":"sms","revision":"owner-2026-10-25-1209-confirmed"}'),
('a34bd007-c8b1-455c-8063-2ff0236e5181','production','9341452568721903','208cdcbc-375c-495f-8838-0e1f2003038c','{"frequency":"annual","renewalMonth":null,"renewalConfirmed":false,"amountCents":null,"amountConfirmed":false,"revision":"prepaid-unreconciled"}'),
('a34bd007-c8b1-455c-8063-2ff0236e5181','production','9341452568721903','9a8f6dce-bd90-4995-aa91-50664e45d81b','{"frequency":"annual","renewalMonth":null,"renewalConfirmed":false,"amountCents":null,"amountConfirmed":false,"revision":"prepaid-unreconciled"}')
ON CONFLICT DO NOTHING;
COMMIT;
-- No mapping/item guesses, customer rate changes, billing-mode changes, or enabled flags.
