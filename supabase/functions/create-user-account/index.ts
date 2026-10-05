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
    const reject = (reason: string, status = 400) => {
      console.warn(`create-user-account rejected [${status}]: ${reason}`, {
        role: userData?.role, loginLength: userData?.login?.length ?? 0,
        hasEmail: !!userData?.email, passwordLength: userData?.password?.length ?? 0,
        phoneLength: userData?.phone?.length ?? 0,
      });
      return new Response(JSON.stringify({ error: reason }), {
        status, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    };
    
    // Enhanced input validation
    if (!userData.firstName?.trim() || userData.firstName.trim().length < 1 || userData.firstName.trim().length > 50) {
      return reject('Invalid first name');
    }
    
    if (!userData.lastName?.trim() || userData.lastName.trim().length < 1 || userData.lastName.trim().length > 50) {
      return reject('Invalid last name');
    }
    
    if (!userData.login?.trim() || userData.login.trim().length < 3 || userData.login.trim().length > 30 || !/^[a-zA-Z0-9_-]+$/.test(userData.login.trim())) {
      return reject('Invalid login (3-30 chars, alphanumeric, underscore, dash only)');
    }
    
    if (!userData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email.trim())) {
      return reject('Invalid email address');
    }
    
    if (!userData.password || userData.password.length < 8 || userData.password.length > 128) {
      return reject('Password must be 8-128 characters');
    }
    
    if (!['admin', 'tech', 'client'].includes(userData.role)) {
      return reject('Invalid role');
    }
    
    if (userData.phone && (userData.phone.length > 20 || !/^[\d\s\-\+\(\)\.]+$/.test(userData.phone))) {
      return reject('Invalid phone number format');
    }
    
    // Enhanced role validation - only admins can assign privileged roles
    const authHeader = req.headers.get('Authorization') || '';
    let userRole = null;
    let currentUser: { id: string } | null = null;
    
    if (authHeader.startsWith('Bearer ')) {
      try {
        const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: { user } } = await userClient.auth.getUser();
        currentUser = user;
        const { data: roleData } = await userClient.rpc('get_current_user_role');
        userRole = roleData;
      } catch (e) {
        console.log('No valid auth token provided');
      }
    }
    
    // Only admins can assign tech or admin roles
    if (['tech', 'admin'].includes(userData.role) && userRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only administrators can assign tech or admin roles' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    
    // Rate limiting: stricter for unauthenticated, higher for admins
    const identifier = userRole === 'admin' && currentUser?.id
      ? currentUser.id
      : (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown');
    try {
      const { data: allowed, error: rlError } = await supabaseAdmin.rpc('check_rate_limit', {
        p_identifier: identifier,
        p_endpoint: 'create-user-account',
        p_max_requests: userRole === 'admin' ? 60 : 5,
        p_window_minutes: 15
      });
      if (rlError) console.warn('check_rate_limit error:', rlError);
      if (allowed === false) {
        return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    } catch (e) {
      console.warn('Rate limit RPC failed (continuing):', e);
    }
    
    console.log('Creating user:', userData.login, userData.email, userData.role);

    const fullName = `${userData.firstName.trim()} ${userData.lastName.trim()}`.trim();
    
    // Step 1: Check if login already exists (usernames must be unique)
    const { data: existingUserByLogin, error: checkLoginError } = await supabaseAdmin
      .from('users')
      .select('login')
      .eq('login', userData.login)
      .maybeSingle();

    if (existingUserByLogin) {
      return reject('Username already exists');
    }

    // Step 2: Create a distinct auth identity. Contact email is not account
    // identity: an admin/tech and a client may intentionally share it.
    const { data: existingAuthUsers, error: authCheckError } = await supabaseAdmin.auth.admin.listUsers();
    if (authCheckError) throw authCheckError;
    const normalizedContactEmail = userData.email.toLowerCase().trim();
    const contactEmailInUse = existingAuthUsers?.users?.some(
      (user) => user.email?.toLowerCase() === normalizedContactEmail
    );
    const authEmail = contactEmailInUse
      ? `${crypto.randomUUID()}@accounts.getaquaclear.com`
      : normalizedContactEmail;

    console.log('Creating distinct auth user...');
    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: userData.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          full_name: fullName,
          role: userData.role,
          contact_email: normalizedContactEmail,
        }
    });
    if (authError || !newAuthUser?.user) {
      throw new Error(`Failed to create auth user: ${authError?.message || 'Unknown error'}`);
    }
    const authUser = newAuthUser.user;

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
      email: normalizedContactEmail,
      auth_email: authEmail,
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
      if (authUser?.id) {
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
          <a href="https://getaquaclear.com/auth/login" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Login to Your Account
          </a>
        </div>

        <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br>The Aqua Clear Pools Team</p>
      </div>
    `;

    try {
      const replyToEmail = 'randy@getaquaclear.com';
      const fromDisplay = 'Aqua Clear Pools <randy@getaquaclear.com>';
      const emailResponse = await resend.emails.send({
        from: fromDisplay,
        to: [userData.email],
        reply_to: replyToEmail,
        subject: `Welcome to Aqua Clear Pools - Your ${userData.role} Account`,
        text: `Welcome ${fullName}. Your username is ${userData.login}. If you need help, reply to this email.`,
        headers: { "List-Unsubscribe": replyToEmail ? `<mailto:${replyToEmail}>` : `<mailto:support@getaquaclear.com>` },
        html: welcomeEmailHtml,
      });

      console.log('Welcome email sent:', emailResponse);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the entire operation if email fails
    }

    try {
      await supabaseAdmin.rpc('log_security_event_enhanced', {
        p_event_type: 'create_user_success',
        p_user_id: currentUser?.id ?? null,
        p_session_id: null,
        p_endpoint: 'create-user-account',
        p_payload: { target_email: userData.email, role: userData.role, login: userData.login },
        p_severity: 'info'
      });
    } catch (e) {
      console.warn('log_security_event_enhanced failed (continuing):', e);
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