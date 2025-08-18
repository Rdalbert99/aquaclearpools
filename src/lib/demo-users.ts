// SECURITY NOTICE: Demo functionality has been removed for production security.
// This file previously contained hardcoded credentials which posed a security risk.
// 
// For development/testing purposes, create users through the proper signup flow
// or use the admin interface to create new users with secure, randomly generated passwords.

console.warn('Demo user functionality has been disabled for security reasons. Use proper signup flow or admin interface for user creation.');

export const createDemoUser = async (email: string, password: string, name: string, role: string) => {
  throw new Error('Demo user creation has been disabled for security reasons. Use proper signup flow or admin interface.');
};

export const initializeDemoUsers = async () => {
  console.warn('Demo initialization has been disabled for security reasons.');
  return [];
};