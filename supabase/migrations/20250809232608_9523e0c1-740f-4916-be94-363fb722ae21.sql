-- Create table for client invitations
create table if not exists public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token text not null unique,
  email text,
  phone text,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.client_invitations enable row level security;

-- Admins can manage invitations
create policy if not exists "Admins manage client invitations"
  on public.client_invitations
  for all
  to authenticated
  using (public.get_current_user_role() = 'admin')
  with check (public.get_current_user_role() = 'admin');

-- Helpful index on client_id
create index if not exists idx_client_invitations_client_id on public.client_invitations(client_id);
create index if not exists idx_client_invitations_expires_at on public.client_invitations(expires_at);

-- Function to fetch invite payload by token (public access via SECURITY DEFINER)
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
  select * into inv 
  from public.client_invitations 
  where token = invite_token 
    and used_at is null 
    and expires_at > now()
  limit 1;

  if not found then
    return null;
  end if;

  select * into cli from public.clients where id = inv.client_id limit 1;

  -- Try to load associated user profile if linked
  if cli.user_id is not null then
    select u.id, u.name, u.email, u.phone, u.address
      into usr
    from public.users u
    where u.id = cli.user_id
    limit 1;
  end if;

  return json_build_object(
    'token', inv.token,
    'client_id', cli.id,
    'customer', cli.customer,
    'address', coalesce(cli.address, usr.address),
    'phone', coalesce(cli.phone, usr.phone),
    'email', coalesce(inv.email, usr.email),
    'expires_at', inv.expires_at
  );
end;
$$;