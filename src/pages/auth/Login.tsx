import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Droplets } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { initializeDemoUsers } from '@/lib/demo-users';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { signIn, isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  if (isAuthenticated) {
    if (user?.role === 'client') {
      return <Navigate to="/client" replace />;
    } else {
      return <Navigate to="/admin" replace />;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await signIn(email, password);

    if (result.error) {
      toast({
        title: "Login Failed",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
    }

    setIsLoading(false);
  };

  const handleDemoLogin = (demoEmail: string, demoPassword: string = 'password') => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  const handleInitializeDemoUsers = async () => {
    setIsInitializing(true);
    try {
      await initializeDemoUsers();
      toast({
        title: "Demo users created!",
        description: "You can now login with admin@poolcleaning.com / password",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create demo users",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <Droplets className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Pool Management</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Demo Accounts</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDemoLogin('admin@poolcleaning.com')}
            >
              👨‍💼 Admin Demo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDemoLogin('tech1@poolcleaning.com')}
            >
              🔧 Technician Demo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDemoLogin('client1@poolcleaning.com')}
            >
              🏊‍♀️ Client Demo
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleInitializeDemoUsers}
              disabled={isInitializing}
            >
              {isInitializing ? 'Creating...' : '🔧 Initialize Demo Users'}
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Demo password: "password"</p>
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