import { supabase } from '@/integrations/supabase/client';

// Helper function to create demo users
export const createDemoUser = async (email: string, password: string, name: string, role: string) => {
  console.log(`Creating demo user: ${email} with role: ${role}`);
  
  try {
    // First try to sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    console.log('Signup result:', { data, error });

    if (error && !error.message.includes('User already registered')) {
      console.error('Signup error:', error);
      throw error;
    }

    // Get the user ID (either from signup or existing user)
    let userId = data.user?.id;
    
    if (!userId && error?.message.includes('User already registered')) {
      console.log('User already exists, attempting to get ID...');
      // User exists, try to get their ID by signing in briefly
      const { data: existingUser, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      console.log('SignIn result:', { existingUser, signInError });
      
      if (existingUser.user) {
        userId = existingUser.user.id;
        await supabase.auth.signOut(); // Sign out immediately
      }
    }

    console.log('Final userId:', userId);

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

      console.log('User profile upsert result:', { userError });

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
  console.log('Starting demo user initialization...');
  
  const demoUsers = [
    { email: 'admin@poolcleaning.com', password: 'password', name: 'Admin User', role: 'admin' },
    { email: 'tech1@poolcleaning.com', password: 'password', name: 'Tech User', role: 'tech' },
    { email: 'client1@poolcleaning.com', password: 'password', name: 'Client User', role: 'client' },
  ];

  const results = [];
  for (const user of demoUsers) {
    const result = await createDemoUser(user.email, user.password, user.name, user.role);
    results.push({ ...user, ...result });
  }
  
  console.log('Demo user initialization complete:', results);
  return results;
};