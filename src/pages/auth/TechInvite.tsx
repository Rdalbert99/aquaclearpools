import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';

export default function TechInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    login: '',
    email: '',
    password: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    if (!token) return;
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase.rpc('validate_tech_invitation_token', { token_input: token });
      const result = data as Record<string, any> | null;
      if (error || !result || result.error) {
        setValid(false);
      } else {
        setValid(true);
        if (result.email) setForm(prev => ({ ...prev, email: result.email }));
        if (result.phone) setForm(prev => ({ ...prev, phone: result.phone }));
      }
    } catch {
      setValid(false);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.login || !form.email || !form.password) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('complete-tech-invite', {
        body: { token, ...form },
      });

      if (error) {
        // supabase.functions.invoke wraps non-2xx as FunctionsHttpError
        const errorBody = typeof error === 'object' && 'context' in error
          ? await (error as any).context?.json?.().catch(() => null)
          : null;
        throw new Error(errorBody?.error || data?.error || error.message || 'Failed to create account');
      }
      if (data?.error) throw new Error(data.error);

      toast({ title: "Account Created!", description: "You can now log in with your credentials." });
      navigate('/auth/login');
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create account.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (validating) return <LoadingSpinner />;

  if (!valid) {
    return (
      <>
        <PublicNavbar />
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Invalid Invitation</CardTitle>
              <CardDescription>This invitation link is invalid or has expired.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/')}>Go Home</Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PublicNavbar />
      <div className="min-h-screen flex items-center justify-center p-4 pt-20">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create Your Technician Account
            </CardTitle>
            <CardDescription>Fill in your details to join the Aqua Clear team.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" value={form.firstName} onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" value={form.lastName} onChange={(e) => setForm(p => ({ ...p, lastName: e.target.value }))} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login">Username *</Label>
                <Input id="login" value={form.login} onChange={(e) => setForm(p => ({ ...p, login: e.target.value }))} placeholder="Choose a unique username" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                    required
                  />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Min 12 characters with uppercase, lowercase, and numbers.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Main St, City, State, ZIP" />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
