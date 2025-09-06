-- Enforce strict Row Level Security (RLS) on sensitive tables
-- This does not change existing policies; it ensures RLS is always applied

-- Users table (PII)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- Clients table (contains contact and address details)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;

-- Service requests (contains contact details and addresses)
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests FORCE ROW LEVEL SECURITY;

-- Reviews (customer names and content)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews FORCE ROW LEVEL SECURITY;

-- Client invitations (tokens and contact info)
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitations FORCE ROW LEVEL SECURITY;

-- Audit logs (not publicly readable; keep strict)
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log FORCE ROW LEVEL SECURITY;

-- Invitation access logs (audit-only table)
ALTER TABLE public.invitation_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_access_log FORCE ROW LEVEL SECURITY;

-- User login records (audit-only table)
ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_logins FORCE ROW LEVEL SECURITY;