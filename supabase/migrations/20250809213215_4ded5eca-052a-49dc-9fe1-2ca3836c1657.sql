-- Create a security definer function to return all technicians for admins
create or replace function public.get_all_technicians()
returns table (
  id uuid,
  name text,
  email text,
  login text,
  phone text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.name, u.email, u.login, u.phone, u.created_at
  from public.users u
  where u.role = 'tech' and public.get_current_user_role() = 'admin';
$$;