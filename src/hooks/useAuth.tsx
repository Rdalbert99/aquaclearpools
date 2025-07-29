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
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setSession(session);
        
        if (session?.user) {
          console.log('User found, fetching profile...');
          // Fetch user details from our users table
          const { data: userData, error } = await supabase
            .from('users')
            .select('role, name')
            .eq('id', session.user.id)
            .single();
          
          if (error) {
            console.error('Error fetching user profile:', error);
          } else {
            console.log('User profile loaded:', userData);
          }
          
          setUser({ ...session.user, ...userData });
        } else {
          console.log('No user, clearing state');
          setUser(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.email);
      setSession(session);
      if (session?.user) {
        supabase
          .from('users')
          .select('role, name')
          .eq('id', session.user.id)
          .single()
          .then(({ data: userData }) => {
            console.log('Initial user profile:', userData);
            setUser({ ...session.user, ...userData });
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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