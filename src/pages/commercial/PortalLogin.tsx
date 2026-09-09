import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function CommercialPortalLogin() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/commercial/portal" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) return;
    setIsLoading(true);
    const result = await signIn(login.trim(), password);
    setIsLoading(false);

    if (result?.error) {
      toast({
        title: 'Sign in failed',
        description: result.error,
        variant: 'destructive',
      });
      return;
    }

    if (result?.mustChangePassword) {
      navigate('/auth/change-password');
      return;
    }

    navigate('/commercial/portal');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background px-4 py-10">
      <Helmet>
        <title>Commercial Portal Login | Aqua Clear Pools</title>
        <meta
          name="description"
          content="Sign in to the Aqua Clear Pools Commercial Portal to review service visits, water chemistry, equipment status and scheduled follow-ups for your facility."
        />
        <link rel="canonical" href="https://getaquaclear.com/commercial/login" />
      </Helmet>

      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo className="h-14 w-auto" />
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            <Building2 className="h-4 w-4" /> Commercial Portal
          </div>
        </div>

        <Card className="border-2">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">Facility management sign in</CardTitle>
            <CardDescription>
              Review visits, water chemistry, equipment and follow-ups for your property.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login">Email or username</Label>
                <Input
                  id="login"
                  autoComplete="username"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="you@yourfacility.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in to portal
              </Button>
            </form>

            <div className="mt-4 space-y-2 text-center text-sm">
              <Link to="/auth/forgot-password" className="text-primary underline-offset-2 hover:underline">
                Forgot your password?
              </Link>
              <p className="text-muted-foreground">
                Need portal access for your team?{' '}
                <Link to="/contact" className="text-primary underline-offset-2 hover:underline">
                  Contact Aqua Clear Pools
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Residential customer?{' '}
          <Link to="/auth/login" className="underline underline-offset-2">
            Use the customer login
          </Link>
        </p>
      </div>
    </div>
  );
}
