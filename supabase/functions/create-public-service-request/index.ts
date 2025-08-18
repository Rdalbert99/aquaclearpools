// Create public service requests via Edge Function using service role (bypasses RLS)
// Handles CORS and returns the created request id

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    console.log('Received public service request body:', body);

    // Minimal validation
    const required = ['request_type', 'description'];
    for (const key of required) {
      if (!body[key] || String(body[key]).trim() === '') {
        return new Response(JSON.stringify({ error: `Missing field: ${key}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    const insertData = {
      contact_title: body.contact_title ?? null,
      request_type: body.request_type,
      description: body.description,
      priority: body.priority ?? 'medium',
      status: 'pending',
      contact_name: body.contact_name ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
      contact_address: body.contact_address ?? null,
      street_address: body.street_address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip_code: body.zip_code ?? null,
      country: body.country ?? 'US',
      address_validated: body.address_validated ?? false,
      pool_type: body.pool_type ?? null,
      pool_size: body.pool_size ?? null,
      preferred_date: body.preferred_date ? new Date(body.preferred_date).toISOString() : null,
    } as const;

    // First, check if a client with this email/phone already exists
    let existingClient = null;
    if (insertData.contact_email || insertData.contact_phone) {
      const { data: existing } = await supabase
        .from('clients')
        .select('id, customer')
        .or(`contact_email.eq.${insertData.contact_email},contact_phone.eq.${insertData.contact_phone}`)
        .limit(1)
        .single();
      
      existingClient = existing;
    }

    // Create service request
    const { data, error } = await supabase
      .from('service_requests')
      .insert([insertData])
      .select('id')
      .single();

    if (error) {
      console.error('Insert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Create potential client record if one doesn't exist
    let clientId = existingClient?.id;
    if (!existingClient && insertData.contact_name) {
      // Parse pool size to get numeric value
      let poolSizeNumeric = 0;
      if (insertData.pool_size) {
        const sizeMatch = insertData.pool_size.match(/(\d+)/);
        if (sizeMatch) {
          poolSizeNumeric = parseInt(sizeMatch[1]) * 1000; // Convert to gallons
        }
      }

      const clientData = {
        customer: insertData.contact_name,
        pool_size: poolSizeNumeric,
        pool_type: insertData.pool_type || 'Unknown',
        liner_type: 'Liner',
        status: 'Potential', // Mark as potential client
        created_at: new Date().toISOString(),
        contact_email: insertData.contact_email,
        contact_phone: insertData.contact_phone,
        contact_address: insertData.contact_address,
        street_address: insertData.street_address,
        city: insertData.city,
        state: insertData.state,
        zip_code: insertData.zip_code,
        country: insertData.country,
      };

      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert([clientData])
        .select('id')
        .single();

      if (!clientError && newClient) {
        clientId = newClient.id;
        
        // Update the service request with the client_id
        await supabase
          .from('service_requests')
          .update({ client_id: clientId })
          .eq('id', data.id);
      }
    } else if (existingClient) {
      // Update the service request with the existing client_id
      await supabase
        .from('service_requests')
        .update({ client_id: existingClient.id })
        .eq('id', data.id);
    }

    return new Response(JSON.stringify({ 
      id: data?.id, 
      client_id: clientId,
      client_status: existingClient ? 'existing' : 'potential' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err: any) {
    console.error('Unhandled error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
