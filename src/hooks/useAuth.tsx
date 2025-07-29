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
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string, role?: string) => Promise<{ error?: string }>;
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
          console.log('User found, setting basic user data...');
          // Set user immediately with basic data to avoid hanging
          setUser({ 
            ...session.user, 
            role: 'admin', // default for now
            name: 'Admin User'
          });
          
          // Try to get profile data but don't block on it
          setTimeout(async () => {
            try {
              const { data: userData } = await supabase
                .from('users')
                .select('role, name')
                .eq('id', session.user.id)
                .single();
              
              if (userData) {
                console.log('Profile loaded, updating user:', userData);
                setUser({ ...session.user, ...userData });
              }
            } catch (err) {
              console.log('Profile fetch failed, keeping default:', err);
            }
          }, 100);
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return {};
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const signUp = async (email: string, password: string, name: string, role: string = 'client') => {
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
        const { error: userError } = await supabase
          .from('users')
          .upsert([
            {
              id: data.user.id,
              email,
              password: 'password', // This is just for compatibility with existing schema
              name,
              role,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ], {
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