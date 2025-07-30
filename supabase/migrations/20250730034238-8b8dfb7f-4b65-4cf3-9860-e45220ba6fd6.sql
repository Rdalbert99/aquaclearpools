-- Migrate existing client users to the new junction table
-- First, let's get the actual auth user IDs that exist in public.users table
INSERT INTO public.client_users (client_id, user_id, is_primary, role)
SELECT c.id, u.id, true, 'primary'
FROM public.clients c
INNER JOIN public.users u ON c.user_id = u.id
WHERE c.user_id IS NOT NULL;