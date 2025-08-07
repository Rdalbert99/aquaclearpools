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
  signIn: (email: string, password: string) => Promise<{ error?: string; mustChangePassword?: boolean }>;
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
          console.log('User found, fetching profile data...');
          
          try {
            // Fetch user profile data before setting user state
            console.log('Attempting to fetch profile for user:', session.user.id);
            const { data: userData, error } = await supabase
              .from('users')
              .select('role, name')
              .eq('id', session.user.id)
              .single();
            
            console.log('Profile fetch result:', { userData, error });
            
            if (userData && !error) {
              console.log('Profile loaded successfully:', userData);
              setUser({ ...session.user, ...userData });
            } else {
              console.log('Profile fetch failed, setting user to session user with email-based role detection');
              // For admin@poolcleaning.com, detect admin role from email
              const role = session.user.email === 'admin@poolcleaning.com' ? 'admin' : 'client';
              setUser({ 
                ...session.user, 
                role,
                name: session.user.email?.split('@')[0] || 'User'
              });
            }
          } catch (err) {
            console.log('Profile fetch error, setting user to session user with email-based role detection:', err);
            // For admin@poolcleaning.com, detect admin role from email
            const role = session.user.email === 'admin@poolcleaning.com' ? 'admin' : 'client';
            setUser({ 
              ...session.user, 
              role,
              name: session.user.email?.split('@')[0] || 'User'
            });
          }
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

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;

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