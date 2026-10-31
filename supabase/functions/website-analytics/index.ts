import { createClient } from 'npm:@supabase/supabase-js@2.53.0';
import { validEvent, validReport } from './validation.ts';

// 2.53.0 has no /cors export. Match collector fetch and SDK invoke headers.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Gateway JWT verification remains enabled. Public anon JWT is not visitor proof.
Deno.serve(async req => {
  const reply = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply(400, { error: 'JSON required' });
  const reader = req.body?.getReader();
  if (!reader) return reply(400, { error: 'Body required' });
  let text = ''; let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256) { await reader.cancel(); return reply(413, { error: 'Body too large' }); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const body: unknown = JSON.parse(text);
    if (!validReport(body) && !validEvent(body)) return reply(400, { error: 'Invalid fields' });
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return reply(503, { error: 'Analytics unavailable' });
    const server = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    if (validReport(body)) {
      const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
      if (!token) return reply(401, { error: 'Sign in required' });
      const { data, error } = await server.auth.getUser(token);
      if (error || !data.user) return reply(401, { error: 'Sign in required' });
      // SQL independently checks current users.role AND status; actor comes only from verified auth.
      const result = await server.rpc('website_analytics_report', { _days: body.days, _actor: data.user.id });
      if (result.error) return reply(result.error.code === '42501' ? 403 : 503, { error: 'Analytics unavailable' });
      return reply(200, result.data);
    }
    if (req.headers.get('Origin') !== 'https://getaquaclear.com') return reply(403, { error: 'Origin not allowed' });
    const { data, error } = await server.rpc('website_analytics_ingest', { _event: body.event, _referral: body.referral, _page: body.page });
    if (error) return reply(503, { error: 'Analytics unavailable' });
    return reply(data ? 202 : 429, { accepted: data === true });
  } catch { return reply(400, { error: 'Invalid request' }); }
});