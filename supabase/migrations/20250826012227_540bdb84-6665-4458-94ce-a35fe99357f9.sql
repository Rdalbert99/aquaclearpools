-- Harden invite payload to minimize sensitive data exposure
-- 1) Stop leaking phone and user profile email/address via SECURITY DEFINER
-- 2) Only return the email the invite was sent to (inv.email)
-- 3) Do not touch existing RLS (already admin-only on client_invitations)

create or replace function public.get_client_invite_payload(invite_token text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv record;
  cli record;
begin
  -- Validate invitation by token (unused and not expired)
  select * into inv
  from public.client_invitations
  where token = invite_token
    and used_at is null
    and expires_at > now()
  limit 1;

  if not found then
    return null;
  end if;

  -- Load client (no user profile lookup to avoid exposing additional PII)
  select * into cli
  from public.clients
  where id = inv.client_id
  limit 1;

  return json_build_object(
    'token', inv.token,
    'client_id', cli.id,
    'customer', cli.customer,
    -- Only return address stored on the client record, never from user profile
    'address', cli.contact_address,
    -- Do not expose phone via public function
    'phone', null,
    -- Only return the email address the invitation was sent to; may be null
    'email', inv.email,
    'expires_at', inv.expires_at
  );
end;
$$;

-- Restrict function execution explicitly (keep invite flow working anonymously)
revoke all on function public.get_client_invite_payload(text) from public;
grant execute on function public.get_client_invite_payload(text) to anon, authenticated;