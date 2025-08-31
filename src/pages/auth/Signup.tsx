import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Droplets } from 'lucide-react';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { AddressComponents } from '@/lib/address-validation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Signup() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    role: 'client'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const COOLDOWN_KEY = 'signup_cooldown_until';
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  useEffect(() => {
    const untilStr = localStorage.getItem(COOLDOWN_KEY);
    const until = untilStr ? parseInt(untilStr) : 0;
    if (until > Date.now()) {
      setCooldownRemaining(Math.ceil((until - Date.now()) / 1000));
    }
    const interval = setInterval(() => {
      const untilStr2 = localStorage.getItem(COOLDOWN_KEY);
      const until2 = untilStr2 ? parseInt(untilStr2) : 0;
      const remaining = Math.max(0, Math.ceil((until2 - Date.now()) / 1000));
      setCooldownRemaining(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const startCooldown = (ms: number) => {
    const until = Date.now() + ms;
    localStorage.setItem(COOLDOWN_KEY, String(until));
    setCooldownRemaining(Math.ceil(ms / 1000));
  };

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cooldownRemaining > 0) {
      setErrorMessage(`Too many attempts. Please wait ${cooldownRemaining}s before trying again.`);
      toast({
        title: "Please wait",
        description: `You can try again in ${cooldownRemaining}s.`,
      });
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
    const fullAddress = `${formData.street}, ${formData.city}, ${formData.state} ${formData.zipCode}`;
    const result = await signUp(
      formData.email, 
      formData.password, 
      fullName, 
      formData.role,
      {
        firstName: formData.firstName,
        lastName: formData.lastName,
        street: formData.street,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        address: fullAddress
      }
    );

    if (result.error) {
      let friendly = result.error as string;
      const isRateLimited = /rate limit/i.test(friendly) || /too many/i.test(friendly);
      if (isRateLimited) {
        const waitSeconds = 60;
        friendly = `Too many signup attempts. Please wait ${waitSeconds} seconds and try again. If you already created an account, check your email for the verification link or try signing in.`;
        startCooldown(waitSeconds * 1000);
      }
      setErrorMessage(friendly);
      toast({
        title: "Signup failed",
        description: friendly,
        variant: "destructive",
      });
    } else {
      setErrorMessage(null);
      toast({
        title: "Account created!",
        description: "Your account has been created successfully.",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center">
            <img 
              src="/lovable-uploads/77c07711-430c-44ce-bbd3-290293acb2c4.png" 
              alt="Aqua Clear Pools logo for signup page" 
              className="w-16 h-16 object-contain"
              loading="lazy"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Create your Aqua Clear Pools client account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(errorMessage || cooldownRemaining > 0) && (
            <Alert variant={errorMessage ? 'destructive' : 'default'}>
              <AlertTitle>{errorMessage ? 'Signup issue' : 'Please wait'}</AlertTitle>
              <AlertDescription>
                {errorMessage || `Too many attempts. Please wait ${cooldownRemaining}s before trying again.`}
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                inputMode="email"
                autoComplete="email"
              />
            </div>

            <div className="space-y-4">
              <AddressAutocomplete
                onAddressSelect={(components: AddressComponents) => {
                  setFormData(prev => ({
                    ...prev,
                    street: components.street_address,
                    city: components.city,
                    state: components.state,
                    zipCode: components.zip_code
                  }));
                }}
                required
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    type="text"
                    placeholder="City"
                    value={formData.city}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    type="text"
                    placeholder="State"
                    value={formData.state}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    type="text"
                    placeholder="12345"
                    value={formData.zipCode}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* SECURITY: Role selection removed - public signup limited to client role only */}
            {/* Tech and admin roles require invitation or admin approval for security */}
            <input type="hidden" name="role" value="client" />

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || cooldownRemaining > 0}>
              {isLoading ? 'Creating account...' : (cooldownRemaining > 0 ? `Try again in ${cooldownRemaining}s` : 'Create account')}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
          {cooldownRemaining > 0 && (
            <p className="text-center text-xs text-muted-foreground">Rate limit active to prevent abuse. Thanks for your patience.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}