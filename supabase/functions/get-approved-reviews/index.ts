import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for secure access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching approved reviews for public display');

    // SECURITY: Only return approved reviews with explicit consent
    // This replaces direct RLS access to prevent customer data harvesting
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('id, customer_name, review_text, rating, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching approved reviews:', error);
      throw error;
    }

    console.log(`Successfully fetched ${reviews?.length || 0} approved reviews`);

    return new Response(
      JSON.stringify({ reviews: reviews || [] }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in get-approved-reviews function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch reviews',
        details: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});