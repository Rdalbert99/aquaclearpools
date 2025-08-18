// Deletes specified users (by id) and any related client records using service role
// CORS enabled and detailed logging

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Payload = {
  userIds?: string[];
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error('Missing Supabase envs');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Enhanced authentication verification for critical operations
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Invalid authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const { data: roleData, error: roleError } = await userClient.rpc('get_current_user_role');
    
    if (userError || roleError || !userData?.user || roleData !== 'admin') {
      console.error('Authorization failed:', { userError, roleError, hasUser: !!userData?.user, role: roleData });
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    
    // Log critical operation
    console.log(`Admin ${userData.user.email} attempting user deletion operation`);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = (await req.json().catch(() => ({}))) as Payload;
    console.log('Delete users request body:', body);

    const ids = (body.userIds || []).filter((id) => typeof id === 'string' && isUuid(id));
    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid userIds provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const results: Record<string, any> = {};

    for (const userId of ids) {
      console.log(`Processing cleanup for user ${userId}`);
      results[userId] = { steps: [] };

      // 1) Remove client relationships
      const { error: cuErr } = await supabase.from('client_users').delete().eq('user_id', userId);
      if (cuErr) {
        console.error('client_users delete error', cuErr);
        results[userId].steps.push({ step: 'client_users', ok: false, error: cuErr.message });
      } else {
        results[userId].steps.push({ step: 'client_users', ok: true });
      }

      // 2) Delete clients tied to this user
      const { error: clientsErr } = await supabase.from('clients').delete().eq('user_id', userId);
      if (clientsErr) {
        console.error('clients delete error', clientsErr);
        results[userId].steps.push({ step: 'clients', ok: false, error: clientsErr.message });
      } else {
        results[userId].steps.push({ step: 'clients', ok: true });
      }

      // 3) Finally delete the user
      const { error: usersErr } = await supabase.from('users').delete().eq('id', userId);
      if (usersErr) {
        console.error('users delete error', usersErr);
        results[userId].steps.push({ step: 'users', ok: false, error: usersErr.message });
      } else {
        results[userId].steps.push({ step: 'users', ok: true });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err: any) {
    console.error('Unhandled error in delete-users-and-clients:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
