import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LinkRequest = {
  email: string;
  role?: 'admin' | 'tech' | 'client';
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create clients
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { email, role }: LinkRequest = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Authenticated user and role
    const { data: userData } = await supabaseUser.auth.getUser();
    const { data: roleData } = await supabaseUser.rpc('get_current_user_role');
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const isAdmin = roleData === 'admin';
    const isSelf = (userData.user.email || '').toLowerCase() === email.toLowerCase();
    if (!isAdmin && !isSelf) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Rate limit linking attempts per user
    try {
      const { data: allowed, error: rlError } = await supabaseAdmin.rpc('check_rate_limit', {
        p_identifier: userData.user.id,
        p_endpoint: 'link-auth-user',
        p_max_requests: 30,
        p_window_minutes: 15
      });
      if (rlError) console.warn('check_rate_limit error:', rlError);
      if (allowed === false) {
        return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    } catch (e) {
      console.warn('Rate limit RPC failed (continuing):', e);
    }

    let authUser: { id: string; email?: string | null; user_metadata?: any } | null = null;
    if (isSelf) {
      authUser = { id: userData.user.id, email: userData.user.email, user_metadata: userData.user.user_metadata };
    } else {
      // Admin path: lookup by email
      const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) throw new Error(listErr.message);
      const found = usersList?.users?.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
      if (!found) {
        return new Response(JSON.stringify({ error: 'No auth user found for email' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      authUser = { id: found.id, email: found.email, user_metadata: found.user_metadata };
    }

    // Fetch an existing profile row by email (if any)
    const { data: existingProfile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .maybeSingle();

    let upsertRecord: any = {
      id: authUser.id,
      email,
      role: role || existingProfile?.role || 'client',
      name: existingProfile?.name || authUser.user_metadata?.full_name || email.split('@')[0],
      login: existingProfile?.login || (email.split('@')[0]),
      password: existingProfile?.password || 'password', // legacy non-null field
      updated_at: new Date().toISOString(),
    };

    if (!existingProfile) {
      upsertRecord.created_at = new Date().toISOString();
    }

    const { data: upserted, error: upsertErr } = await supabaseAdmin
      .from('users')
      .upsert(upsertRecord, { onConflict: 'id' })
      .select()
      .single();

    if (upsertErr) throw upsertErr;

    // Optionally clean up duplicate rows with same email but different id
    const { data: dupes } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email);

    if (dupes && dupes.length > 1) {
      const idsToDelete = dupes
        .map((r) => r.id)
        .filter((id) => id !== authUser.id);
      if (idsToDelete.length > 0) {
        await supabaseAdmin
          .from('users')
          .delete()
          .in('id', idsToDelete);
      }
    }

    return new Response(
      JSON.stringify({ success: true, id: upserted.id, role: upserted.role }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e: any) {
    console.error('link-auth-user error:', e);
    return new Response(JSON.stringify({ error: e.message || 'failed to link user' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
