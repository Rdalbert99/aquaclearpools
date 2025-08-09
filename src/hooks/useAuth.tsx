import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        clearTimeout(loadingTimeout); // Clear timeout since we got a response
        
        setSession(session);
        
        if (session?.user) {
          console.log('User found, ensuring profile exists...');
          
          // Ensure profile exists and is correct
          await ensureProfile(session.user);
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
        console.log('Profile found by email, updating ID:', emailProfile);
        
        // Update the profile to have the correct auth user ID
        const { error: updateError } = await supabase
          .from('users')
          .update({ id: authUser.id })
          .eq('email', authUser.email)
          .eq('role', emailProfile.role)
          .eq('name', emailProfile.name);

        if (!updateError) {
          console.log('Profile ID updated successfully');
          setUser({ ...authUser, ...emailProfile });
          return;
        } else {
          console.error('Failed to update profile ID:', updateError);
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
          login: name,
          password: 'password' // Legacy field
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
      const { data: emailResult, error: lookupError } = await supabase
        .rpc('get_email_by_login', { login_input: login });

      console.log('Email lookup result:', { emailResult, lookupError });

      if (lookupError || !emailResult) {
        console.error('Login lookup failed:', lookupError);
        throw new Error('Invalid username or password');
      }

      console.log('Found email for login:', emailResult);

      // Get the user data for this specific login to determine the correct role
      const { data: loginUserData, error: loginUserError } = await supabase
        .from('users')
        .select('role, name, login')
        .eq('login', login)
        .single();

      console.log('Login user data:', { loginUserData, loginUserError });

      // Now sign in with the email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailResult,
        password,
      });
      
      console.log('Auth response:', { data: !!data, error });
      if (error) {
        console.error('Authentication failed:', error.message);
        throw error;
      }

      // Ensure the user profile is correctly set up
      if (data.user) {
        await ensureProfile(data.user);
        
        // If we have specific login data, make sure the profile matches
        if (loginUserData && !loginUserError) {
          console.log('Updating user profile for auth ID:', data.user.id);
          try {
            const { error: updateError } = await supabase
              .from('users')
              .upsert({
                id: data.user.id,
                email: data.user.email,
                role: loginUserData.role,
                name: loginUserData.name,
                login: loginUserData.login,
                password: 'password' // Legacy field
              }, {
                onConflict: 'id'
              });
            
            if (updateError) {
              console.error('Failed to upsert user profile:', updateError);
            } else {
              console.log('Successfully upserted user profile with correct role:', loginUserData.role);
            }
          } catch (updateErr) {
            console.error('Error upserting user profile:', updateErr);
          }
        }
      }

      // Check if user must change password
      if (data.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('must_change_password')
          .eq('id', data.user.id)
          .single();

        if (!userError && userData?.must_change_password) {
          return { error: null, mustChangePassword: true };
        }
      }

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

      return {};
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const signUp = async (email: string, password: string, name: string, role: string = 'client', additionalData?: any) => {
    try {
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
          password: 'password', // This is just for compatibility with existing schema
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