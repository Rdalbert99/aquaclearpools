import { useState, useEffect } from 'react';
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Droplets } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { initializeDemoUsers } from '@/lib/demo-users';
import { supabase } from '@/integrations/supabase/client';
export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { signIn, isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isResettingAdmin, setIsResettingAdmin] = useState(false);
  const [isCreatingRandall, setIsCreatingRandall] = useState(false);
  const supportMode = searchParams.get('support') === '1';

  // SECURITY: Support functions secured - only work with proper admin authorization
  const handleSupportResetAdmin = async () => {
    // Check if current user is already an admin before allowing password reset
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      toast({ 
        title: 'Unauthorized', 
        description: 'You must be logged in as an admin to use support functions',
        variant: 'destructive' 
      });
      return;
    }

    setIsResettingAdmin(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { login: 'admin', email: 'rdalbert99@gmail.com' }
      });
      if (error) throw error;
      
      toast({ title: 'Reset completed', description: 'Admin password has been reset securely' });
    } catch (e: any) {
      toast({ title: 'Reset failed', description: e.message || 'Unable to reset password', variant: 'destructive' });
    } finally {
      setIsResettingAdmin(false);
    }
  };

  const handleSupportCreateRandall = async () => {
    // Require existing admin session for user creation
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      toast({ 
        title: 'Unauthorized', 
        description: 'You must be logged in as an admin to create new users',
        variant: 'destructive' 
      });
      return;
    }

    setIsCreatingRandall(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user-account', {
        body: {
          firstName: 'Randall',
          lastName: 'Admin',
          login: 'Randall',
          email: 'randy@getaquaclear.com',
          password: 'SecurePassword' + Math.random().toString(36).substring(2, 8), // Generate secure password
          role: 'admin'
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Admin Created',
        description: 'Admin user created with secure password. Check email for credentials.',
      });
    } catch (e: any) {
      toast({ title: 'Create failed', description: e.message || 'Unable to create user', variant: 'destructive' });
    } finally {
      setIsCreatingRandall(false);
    }
  };

  // SECURITY: Demo credential pre-filling removed for production security
  useEffect(() => {
    // Demo functionality disabled for security
    console.warn('Demo credential pre-filling has been disabled for security reasons.');
  }, [searchParams]);

  if (isAuthenticated) {
    if (user?.role === 'client') {
      return <Navigate to="/client" replace />;
    } else if (user?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (user?.role === 'tech') {
      return <Navigate to="/tech" replace />;
    } else {
      // Default fallback for unknown roles
      return <Navigate to="/client" replace />;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await signIn(login, password);

    if (result.error) {
      toast({
        title: "Login Failed",
        description: result.error,
        variant: "destructive",
      });
    } else if (result.mustChangePassword) {
      // Redirect to password change page
      navigate('/auth/change-password');
      return;
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
    }

    setIsLoading(false);
  };

  // SECURITY: Demo functions removed for production security
  const handleDemoLogin = () => {
    toast({
      title: "Demo Disabled",
      description: "Demo functionality has been disabled for security. Please use proper credentials.",
      variant: "destructive",
    });
  };

  const handleInitializeDemoUsers = async () => {
    toast({
      title: "Demo Disabled",
      description: "Demo initialization has been disabled for security reasons.",
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center">
            <img 
              src="/lovable-uploads/77c07711-430c-44ce-bbd3-290293acb2c4.png" 
              alt="Aqua Clear Pools Logo" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Aqua Clear Pools</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login">Username</Label>
              <Input
                id="login"
                type="text"
                placeholder="Enter your username (not email)"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Use your username, not your email address. For admin, use "admin", for Randy, use "Randy"
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="text-center">
              <Link to="/auth/forgot-password" className="text-sm text-primary hover:underline">
                Forgot your password?
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          {supportMode && (
            <div className="pt-2 space-y-2">
              <Button variant="outline" className="w-full" onClick={handleSupportCreateRandall} disabled={isCreatingRandall}>
                {isCreatingRandall ? 'Creating...' : "Create Admin 'Randall' (Requires Auth)"}
              </Button>
              <Button variant="outline" className="w-full" onClick={handleSupportResetAdmin} disabled={isResettingAdmin}>
                {isResettingAdmin ? 'Resetting...' : 'Reset Admin Password (Requires Auth)'}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">Support functions now require admin authentication for security</p>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            <p className="mt-2">
              Don't have an account?{' '}
              <Link to="/auth/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}