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

    // Enhanced validation
    const required = ['request_type', 'description'];
    for (const key of required) {
      if (!body[key] || String(body[key]).trim() === '') {
        return new Response(JSON.stringify({ error: `Missing field: ${key}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }
    
    // Validate request_type
    const validRequestTypes = ['service', 'repair', 'maintenance', 'installation', 'consultation', 'emergency'];
    if (!validRequestTypes.includes(body.request_type)) {
      return new Response(JSON.stringify({ error: 'Invalid request type' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Validate description length
    if (body.description.trim().length < 10 || body.description.trim().length > 2000) {
      return new Response(JSON.stringify({ error: 'Description must be 10-2000 characters' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Validate email if provided
    if (body.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contact_email.trim())) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Validate phone if provided
    if (body.contact_phone && (body.contact_phone.length > 20 || !/^[\d\s\-\+\(\)\.]+$/.test(body.contact_phone))) {
      return new Response(JSON.stringify({ error: 'Invalid phone number format' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
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

    // Avoid enumerating existing clients; do not check the clients table here
    // This prevents leaking whether an email/phone exists in our database
    const existingClient = null;

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
    // Intentionally do not reveal or link existing clients in public endpoint

    return new Response(JSON.stringify({ 
      id: data?.id
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
