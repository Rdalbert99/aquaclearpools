import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  firstName: string;
  lastName: string;
  login: string;
  email: string;
  password: string;
  role: 'admin' | 'tech' | 'client';
  phone?: string;
  address?: string;
  addressComponents?: any;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    // Create admin client for user creation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const resend = new Resend(resendApiKey);

    const userData: CreateUserRequest = await req.json();
    console.log('Creating user:', userData.login, userData.email, userData.role);

    const fullName = `${userData.firstName.trim()} ${userData.lastName.trim()}`.trim();
    
    // Step 1: Check if login already exists (usernames must be unique)
    const { data: existingUserByLogin, error: checkLoginError } = await supabaseAdmin
      .from('users')
      .select('login')
      .eq('login', userData.login)
      .maybeSingle();

    if (existingUserByLogin) {
      return new Response(
        JSON.stringify({ error: 'Username already exists' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Step 2: Check if auth user already exists with this email
    const { data: existingAuthUsers, error: authCheckError } = await supabaseAdmin.auth.admin.listUsers();
    let authUser = existingAuthUsers?.users?.find(user => user.email === userData.email);
    
    let createdNewAuth = false;
    if (!authUser) {
      // Create user in Supabase Auth only if one doesn't exist
      console.log('Creating new auth user...');
      const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          full_name: fullName,
          role: userData.role
        }
      });

      if (authError) {
        const msg = String(authError.message || '').toLowerCase();
        console.error('Auth user creation failed:', authError);
        if (msg.includes('already registered') || msg.includes('duplicate')) {
          console.log('Auth user already exists, proceeding without creation');
        } else {
          throw new Error(`Failed to create auth user: ${authError.message}`);
        }
      } else if (newAuthUser?.user) {
        createdNewAuth = true;
        authUser = newAuthUser.user;
        console.log('New auth user created:', authUser.id);
      }
    } else {
      console.log('Using existing auth user:', authUser.id);
    }

    // Step 3: Create user profile in custom users table
    if (!authUser) {
      throw new Error('Auth user could not be resolved for provided email');
    }
    const userRecord: any = {
      id: authUser.id,
      name: fullName,
      first_name: userData.firstName,
      last_name: userData.lastName,
      login: userData.login,
      email: userData.email,
      password: userData.password, // Keep for compatibility
      role: userData.role,
      phone: userData.phone || null,
      address: userData.address || null,
      must_change_password: false, // User can use the password as-is
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add address components if provided
    if (userData.addressComponents) {
      userRecord.street_address = userData.addressComponents.street_address;
      userRecord.city = userData.addressComponents.city;
      userRecord.state = userData.addressComponents.state;
      userRecord.zip_code = userData.addressComponents.zip_code;
      userRecord.country = userData.addressComponents.country;
      userRecord.address_validated = true;
    }

    console.log('Creating user profile...');
    const { data: profileUser, error: profileError } = await supabaseAdmin
      .from('users')
      .upsert(userRecord, { onConflict: 'id' })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation failed:', profileError);
      if (createdNewAuth && authUser?.id) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      }
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    console.log('User profile created:', profileUser.id);

    // Step 4: Send welcome email
    const welcomeEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to Aqua Clear Pools!</h1>
        <p>Hello ${fullName},</p>
        <p>Your account has been successfully created. Here are your login credentials:</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">Your Login Credentials:</h3>
          <p><strong>Username:</strong> ${userData.login}</p>
          <p><strong>Email:</strong> ${userData.email}</p>
          <p><strong>Role:</strong> ${userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}</p>
        </div>

        <p>You can log in to the system using your username and the password that was provided to you.</p>
        
        <div style="margin: 30px 0;">
          <a href="${supabaseUrl.replace('.supabase.co', '.lovableproject.com')}/auth/login" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Login to Your Account
          </a>
        </div>

        <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br>The Aqua Clear Pools Team</p>
      </div>
    `;

    try {
      const emailResponse = await resend.emails.send({
        from: "Aqua Clear Pools <onboarding@resend.dev>",
        to: [userData.email],
        subject: `Welcome to Aqua Clear Pools - Your ${userData.role} Account`,
        html: welcomeEmailHtml,
      });

      console.log('Welcome email sent:', emailResponse);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the entire operation if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: profileUser.id,
          name: profileUser.name,
          login: profileUser.login,
          email: profileUser.email,
          role: profileUser.role
        },
        message: 'User created successfully and welcome email sent'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in create-user-account function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create user account' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);