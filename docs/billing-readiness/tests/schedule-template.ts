// Isolated capability fixture: cron/net functions are synthetic; never send a request.
import {execFileSync} from 'node:child_process';
const root='postgresql://nobody@127.0.0.1:55439/postgres';const url='postgresql://nobody@127.0.0.1:55439/billing_schedule_contract';
execFileSync('psql',[root,'-X','-v','ON_ERROR_STOP=1','-c','DROP DATABASE IF EXISTS billing_schedule_contract WITH (FORCE)','-c','CREATE DATABASE billing_schedule_contract'],{stdio:'pipe'});
const run=(args:string[])=>execFileSync('psql',[url,'-X','-v','ON_ERROR_STOP=1',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
run(['-c',`CREATE SCHEMA cron;CREATE SCHEMA net;CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
CREATE TABLE cron.job(jobid bigint GENERATED ALWAYS AS IDENTITY,jobname text UNIQUE,schedule text,command text,active boolean DEFAULT true);
CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$INSERT INTO cron.job(jobname,schedule,command) VALUES($1,$2,$3) ON CONFLICT(jobname) DO UPDATE SET schedule=$2,command=$3 RETURNING jobid$$;
CREATE FUNCTION cron.alter_job(job_id bigint,active boolean) RETURNS void LANGUAGE sql AS $$UPDATE cron.job SET active=$2 WHERE jobid=$1$$;
CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb) RETURNS bigint LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'network_forbidden_in_fixture';END$$;`]);
run(['-f','docs/billing-readiness/UNAPPLIED-schedule.sql']);
if(run(['-At','-c','SELECT count(*) FROM cron.job']).trim()!=='0')throw new Error('missing approval registered');
run(['-v','registration_reviewed=true','-v','endpoint_reviewed=true','-v','privilege_reviewed=true','-v','billing_endpoint=https://synthetic.supabase.co/functions/v1/billing-orchestrator','-v','scheduler_vault_name=reviewed_fixture_reference','-f','docs/billing-readiness/UNAPPLIED-schedule.sql']);
if(run(['-At','-c',`SELECT count(*) FROM cron.job WHERE active=false AND command LIKE '%vault.decrypted_secrets%' AND command LIKE '%billing-orchestrator%'`]).trim()!=='2')throw new Error('registration not inactive');
console.log('2 executable schedule template contracts passed: no approval=no registration; approved fixture registers two INACTIVE jobs without secret values or network.');
