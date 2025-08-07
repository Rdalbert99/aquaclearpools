import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { userId, newPassword }: ResetPasswordRequest = await req.json();
    console.log('Resetting password for user:', userId);

    // Get the user from custom users table to find their email
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('User not found:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Find the auth user by email
    const { data: authUsers, error: authListError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authListError) {
      console.error('Error listing auth users:', authListError);
      return new Response(
        JSON.stringify({ error: 'Failed to find auth user' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    const authUser = authUsers.users.find(user => user.email === userData.email);
    
    if (!authUser) {
      console.error('Auth user not found for email:', userData.email);
      return new Response(
        JSON.stringify({ error: 'Auth user not found' }),
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Update the password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating auth password:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update password: ${updateError.message}` }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Update the users table to set must_change_password flag
    const { error: flagError } = await supabaseAdmin
      .from('users')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (flagError) {
      console.warn('Warning: Failed to update must_change_password flag:', flagError);
      // Don't fail the entire operation for this
    }

    console.log('Password reset successful for user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password reset successfully'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in reset-user-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to reset password' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);