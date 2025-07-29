import { supabase } from '@/integrations/supabase/client';

// Helper function to create demo users
export const createDemoUser = async (email: string, password: string, name: string, role: string) => {
  try {
    // First try to sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error && !error.message.includes('User already registered')) {
      throw error;
    }

    // Get the user ID (either from signup or existing user)
    let userId = data.user?.id;
    
    if (!userId && error?.message.includes('User already registered')) {
      // User exists, try to get their ID
      const { data: existingUser } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      userId = existingUser.user?.id;
      await supabase.auth.signOut(); // Sign out immediately
    }

    if (userId) {
      // Create or update user profile
      const { error: userError } = await supabase
        .from('users')
        .upsert([
          {
            id: userId,
            email,
            password: 'password',
            name,
            role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ], {
          onConflict: 'id'
        });

      if (userError) {
        console.error('User profile error:', userError);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Demo user creation error:', error);
    return { success: false, error: error.message };
  }
};

export const initializeDemoUsers = async () => {
  const demoUsers = [
    { email: 'admin@poolcleaning.com', password: 'password', name: 'Admin User', role: 'admin' },
    { email: 'tech1@poolcleaning.com', password: 'password', name: 'Tech User', role: 'tech' },
    { email: 'client1@poolcleaning.com', password: 'password', name: 'Client User', role: 'client' },
  ];

  for (const user of demoUsers) {
    await createDemoUser(user.email, user.password, user.name, user.role);
  }
};