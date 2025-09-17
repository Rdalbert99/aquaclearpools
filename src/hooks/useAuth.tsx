import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { validatePasswordComplexity } from '@/lib/security';

interface AuthUser extends User {
  role?: string;
  name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (login: string, password: string) => Promise<{ error?: string; mustChangePassword?: boolean }>;
  signUp: (email: string, password: string, name: string, role?: string, additionalData?: any) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTech: boolean;
  isClient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Auth useEffect starting...');
    
    // Force loading to false after 3 seconds to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.log('Auth loading timeout - forcing loading to false');
      setLoading(false);
    }, 3000);
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        clearTimeout(loadingTimeout); // Clear timeout since we got a response
        
        setSession(session);
        
        if (session?.user) {
          console.log('User found, ensuring profile exists (deferred)...');
          // Defer Supabase calls to avoid deadlocks in the callback
          setTimeout(() => {
            ensureProfile(session.user!);
          }, 0);
        } else {
          console.log('No user, clearing state');
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session - simplified
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.email);
      if (!session?.user) {
        clearTimeout(loadingTimeout);
        setLoading(false);
      }
      // Let the auth state change handler deal with the user setup
    }).catch(err => {
      console.error('Session check failed:', err);
      clearTimeout(loadingTimeout);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, []);

  const ensureProfile = async (authUser: User) => {
    try {
      console.log('Ensuring profile for user:', authUser.id, authUser.email);
      
      // First try to get existing profile by auth user ID
      const { data: existingProfile, error: profileError } = await supabase
        .from('users')
        .select('role, name, login')
        .eq('id', authUser.id)
        .single();

      if (existingProfile && !profileError) {
        console.log('Profile found by ID:', existingProfile);
        setUser({ ...authUser, ...existingProfile });
        return;
      }

      // If no profile by ID, look for profile by email (legacy)
      const { data: emailProfile, error: emailError } = await supabase
        .from('users')
        .select('role, name, login')
        .eq('email', authUser.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (emailProfile && !emailError) {
        console.log('Profile found by email, linking via edge function...');
        try {
          const { data: linkData, error: linkError } = await supabase.functions.invoke('link-auth-user', {
            body: { email: authUser.email, role: emailProfile.role }
          });
          if (linkError) {
            console.error('Failed to link auth user:', linkError);
          }
        } catch (linkErr) {
          console.error('Invoke link-auth-user failed:', linkErr);
        }

        // Fetch the now-linked profile by auth ID
        const { data: profileById } = await supabase
          .from('users')
          .select('role, name, login')
          .eq('id', authUser.id)
          .maybeSingle();

        if (profileById) {
          console.log('Linked profile found by ID:', profileById);
          setUser({ ...authUser, ...profileById });
          return;
        }
      }

      // If still no profile, create a minimal one
      console.log('No profile found, creating minimal profile');
      const role = authUser.email === 'admin@poolcleaning.com' ? 'admin' : 'client';
      const name = authUser.email?.split('@')[0] || 'User';
      
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email,
          role,
          name,
          login: name
        });

      if (!insertError) {
        console.log('Profile created successfully');
        setUser({ ...authUser, role, name });
      } else {
        console.error('Failed to create profile:', insertError);
        // Fallback to setting user with basic info
        setUser({ ...authUser, role, name });
      }
    } catch (error) {
      console.error('Error ensuring profile:', error);
      // Fallback to basic user info
      const role = authUser.email === 'admin@poolcleaning.com' ? 'admin' : 'client';
      setUser({ ...authUser, role, name: authUser.email?.split('@')[0] || 'User' });
    }
  };

  const signIn = async (login: string, password: string) => {
    try {
      console.log('SignIn attempt with login:', login);
      
      // Use the secure function to lookup email by login
      const { data: email, error: emailError } = await supabase
        .rpc('get_email_by_login', { login_input: login });

      console.log('Email lookup result:', { email, emailError });

      if (emailError || !email) {
        console.error('Email lookup failed:', emailError);
        
        // Log failed login attempt
        try {
          await supabase.rpc('log_security_event_enhanced', {
            p_event_type: 'login_attempt_failed',
            p_user_id: null,
            p_payload: { login_attempt: login, reason: 'user_not_found' },
            p_severity: 'warning'
          });
        } catch (logError) {
          console.error('Failed to log security event:', logError);
        }
        
        throw new Error('Invalid username or password');
      }

      // Now sign in with the email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password,
      });
      
      console.log('Auth response:', { data: !!data, error });
      if (error) {
        console.error('Authentication failed:', error.message);
        
        // Log authentication failure
        try {
          await supabase.rpc('log_security_event_enhanced', {
            p_event_type: 'authentication_failed',
            p_user_id: null,
            p_payload: { 
              login_attempt: login, 
              email: email,
              error_message: error.message 
            },
            p_severity: 'warning'
          });
        } catch (logError) {
          console.error('Failed to log security event:', logError);
        }
        
        throw error;
      }

      // Ensure the user profile is correctly set up
      if (data.user) {
        await ensureProfile(data.user);
        
        // Log successful login
        try {
          await supabase.rpc('log_security_event_enhanced', {
            p_event_type: 'user_login_success',
            p_user_id: data.user.id,
            p_payload: { 
              login: login,
              email: data.user.email,
              method: 'password'
            },
            p_severity: 'info'
          });
        } catch (logError) {
          console.error('Failed to log security event:', logError);
        }
      }

      console.log('Login successful');

      // Track login
      if (data.user) {
        try {
          await supabase.from('user_logins').insert({
            user_id: data.user.id,
            ip_address: null, // Could be populated with user's IP if needed
            user_agent: navigator.userAgent
          });
        } catch (loginError) {
          console.error('Failed to track login:', loginError);
          // Don't fail the login if tracking fails
        }
      }

      return { error: null, mustChangePassword: false };

      return {};
    } catch (error: any) {
      // Log general login error
      try {
        await supabase.rpc('log_security_event_enhanced', {
          p_event_type: 'login_error',
          p_user_id: null,
          p_payload: { 
            login_attempt: login,
            error: error.message 
          },
          p_severity: 'error'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
      
      return { error: error.message };
    }
  };

  const signUp = async (email: string, password: string, name: string, role: string = 'client', additionalData?: any) => {
    try {
      const { valid, errors } = validatePasswordComplexity(password, email);
      if (!valid) {
        throw new Error(errors.join(' '));
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // Create user profile - use upsert to handle existing records
      if (data.user) {
        const userRecord: any = {
          id: data.user.id,
          email,
          name,
          role,
          login: additionalData?.username || `${name.toLowerCase().replace(/\s+/g, '')}${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Add additional data if provided
        if (additionalData) {
          if (additionalData.firstName) userRecord.first_name = additionalData.firstName;
          if (additionalData.lastName) userRecord.last_name = additionalData.lastName;
          if (additionalData.phone) userRecord.phone = additionalData.phone;
          if (additionalData.address) userRecord.address = additionalData.address;
          if (additionalData.street) userRecord.street_address = additionalData.street;
          if (additionalData.city) userRecord.city = additionalData.city;
          if (additionalData.state) userRecord.state = additionalData.state;
          if (additionalData.zipCode) userRecord.zip_code = additionalData.zipCode;
          if (additionalData.addressComponents) {
            userRecord.street_address = additionalData.addressComponents.street_address;
            userRecord.city = additionalData.addressComponents.city;
            userRecord.state = additionalData.addressComponents.state;
            userRecord.zip_code = additionalData.addressComponents.zip_code;
            userRecord.country = additionalData.addressComponents.country;
            userRecord.address_validated = true;
          }
        }

        const { error: userError } = await supabase
          .from('users')
          .upsert([userRecord], {
            onConflict: 'id'
          });

        if (userError) {
          console.error('User profile creation error:', userError);
          // Don't throw here - the auth user was created successfully
        }
      }

      return {};
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const signOut = async () => {
    // Log logout event before signing out
    if (user?.id) {
      try {
        await supabase.rpc('log_security_event_enhanced', {
          p_event_type: 'user_logout',
          p_user_id: user.id,
          p_payload: { timestamp: new Date().toISOString() },
          p_severity: 'info'
        });
      } catch (logError) {
        console.error('Failed to log logout event:', logError);
      }
    }
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isTech: user?.role === 'tech',
    isClient: user?.role === 'client',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};