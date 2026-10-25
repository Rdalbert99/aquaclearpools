-- Synthetic schema ONLY for isolated local database, never remote.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA extensions;
CREATE TABLE businesses(id uuid PRIMARY KEY,billing_mode text);
CREATE TABLE users(id uuid PRIMARY KEY,role text,status text);
CREATE TABLE business_members(id uuid DEFAULT gen_random_uuid(),business_id uuid,user_id uuid,role text,created_at timestamptz DEFAULT now(),UNIQUE(business_id,user_id));
CREATE TABLE clients(id uuid PRIMARY KEY,customer text,status text,service_rate numeric,contact_phone text,contact_email text,notification_method text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE client_billing_preferences(client_id uuid PRIMARY KEY,invoice_channel text,sms_consent_at timestamptz,sms_consent_source text,set_by text,override_reason text,updated_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE sms_opt_outs(phone text PRIMARY KEY,client_id uuid,source text,keyword text,note text,created_by uuid,created_at timestamptz DEFAULT now());
CREATE TABLE client_qbo_links(id uuid DEFAULT gen_random_uuid(),client_id uuid,environment text,qbo_customer_id text,qbo_display_name text,linked_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(client_id,environment),UNIQUE(environment,qbo_customer_id));
