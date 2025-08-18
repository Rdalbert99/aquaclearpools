import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  userId?: string;
  login?: string;
  email?: string;
  newPassword?: string;
}

function generatePassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
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

    const { userId, login, email, newPassword }: ResetPasswordRequest = await req.json();
    console.log('Reset password request received:', { userId, login, emailProvided: Boolean(email) });

    // Resolve target user and email
    let userRecord: { id: string; email: string | null; login?: string } | null = null;
    let emailToUse: string | null = null;

    if (userId) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, email, login')
        .eq('id', userId)
        .single();
      if (error || !data) {
        console.error('User not found by id:', error);
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      userRecord = data;
      emailToUse = data.email;
    } else if (login) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, email, login')
        .eq('login', login)
        .single();
      if (error || !data) {
        console.error('User not found by login:', error);
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      userRecord = data;
      emailToUse = data.email;
    }

    if (email) {
      emailToUse = email; // explicit override
      if (userRecord && userRecord.email !== email) {
        // Keep users table in sync
        const { error: emailUpdateError } = await supabaseAdmin
          .from('users')
          .update({ email, updated_at: new Date().toISOString() })
          .eq('id', userRecord.id);
        if (emailUpdateError) {
          console.warn('Failed to update users.email:', emailUpdateError);
        }
      }
    }

    if (!emailToUse) {
      return new Response(
        JSON.stringify({ error: 'No target email provided or found' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Generate or use provided password
    const passwordToSet = newPassword || generatePassword(12);

    // Find the auth user by email
    const { data: authUsers, error: authListError } = await supabaseAdmin.auth.admin.listUsers();
    if (authListError) {
      console.error('Error listing auth users:', authListError);
      return new Response(
        JSON.stringify({ error: 'Failed to find auth user' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const authUser = authUsers.users.find(u => (u.email || '').toLowerCase() === emailToUse!.toLowerCase());
    if (!authUser) {
      console.error('Auth user not found for email:', emailToUse);
      return new Response(
        JSON.stringify({ error: 'Auth user not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Update the password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: passwordToSet }
    );

    if (updateError) {
      console.error('Error updating auth password:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update password: ${updateError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Update the users table to set must_change_password flag
    if (userRecord?.id) {
      const { error: flagError } = await supabaseAdmin
        .from('users')
        .update({ must_change_password: true, updated_at: new Date().toISOString() })
        .eq('id', userRecord.id);
      if (flagError) console.warn('Warning: Failed to update must_change_password flag:', flagError);
    } else {
      const { error: flagByEmailError } = await supabaseAdmin
        .from('users')
        .update({ must_change_password: true, updated_at: new Date().toISOString() })
        .eq('email', emailToUse);
      if (flagByEmailError) console.warn('Warning: Failed to update must_change_password by email:', flagByEmailError);
    }

    // Send the new password via email if possible
    let emailed = false;
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const emailResponse = await resend.emails.send({
          from: "Aqua Clear Pools <onboarding@resend.dev>",
          to: [emailToUse!],
          subject: "Your password has been reset",
          html: `
            <h2>Password Reset</h2>
            <p>Hello${userRecord?.login ? ' ' + userRecord.login : ''},</p>
            <p>Your password has been reset. Here is your temporary password:</p>
            <p style="font-size:16px"><strong>${passwordToSet}</strong></p>
            <p>Please log in and change it immediately.</p>
          `,
        });
        console.log('Email sent successfully:', emailResponse);
        emailed = true;
      } else {
        console.warn('RESEND_API_KEY not set; skipping email send');
      }
    } catch (e) {
      console.error('Error sending reset email:', e);
    }

    console.log('Password reset successful for:', emailToUse);

    return new Response(
      JSON.stringify({
        success: true,
        emailed,
        email: emailToUse,
        // Only include password if we could not email it
        password: emailed ? undefined : passwordToSet,
        message: emailed ? 'Password reset and emailed' : 'Password reset; no email configured'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error in reset-user-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to reset password' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
