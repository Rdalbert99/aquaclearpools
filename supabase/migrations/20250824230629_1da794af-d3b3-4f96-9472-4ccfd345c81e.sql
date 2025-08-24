
-- Fix get_client_invite_payload to use contact_* fields on clients
create or replace function public.get_client_invite_payload(invite_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  cli record;
  usr record;
begin
  -- Find a valid, unused, non-expired invitation
  select *
    into inv
  from public.client_invitations
  where token = invite_token
    and used_at is null
    and expires_at > now()
  limit 1;

  if not found then
    return null;
  end if;

  -- Load client
  select *
    into cli
  from public.clients
  where id = inv.client_id
  limit 1;

  -- Try to load associated user profile if linked
  if cli.user_id is not null then
    select u.id, u.name, u.email, u.phone, u.address
      into usr
    from public.users u
    where u.id = cli.user_id
    limit 1;
  end if;

  -- Build payload using updated contact fields
  return json_build_object(
    'token', inv.token,
    'client_id', cli.id,
    'customer', cli.customer,
    'address', coalesce(cli.contact_address, usr.address),
    'phone', coalesce(cli.contact_phone, usr.phone),
    'email', coalesce(inv.email, usr.email),
    'expires_at', inv.expires_at
  );
end;
$$;
