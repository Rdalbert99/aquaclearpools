import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BrandLogo } from "@/components/layout/BrandLogo";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const value = identifier.trim();
    if (!value) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('request-password-reset', {
        body: { identifier: value, origin: window.location.origin },
      });

      if (error) {
        let message = "We couldn't send the reset email. Please try again in a minute.";
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) message = body.error;
        } catch { /* keep default */ }
        setProblem(message);
        return;
      }

      if (!data?.found) {
        setProblem("We couldn't find an account with that username or email. Check the spelling, or call (601) 447-0399.");
        return;
      }
      if (!data.sent) {
        setProblem("We found your account, but there's no email address on file for it. Please call (601) 447-0399 so we can reset it for you.");
        return;
      }

      setHints(Array.isArray(data.hints) ? data.hints : []);
      setIsSubmitted(true);
    } catch (err) {
      console.error('Unexpected password reset error:', err);
      toast({
        title: "Something went wrong",
        description: "Please try again in a minute.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center bg-green-100 rounded-full">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
            <CardDescription>
              We've sent password reset instructions to your email address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>Click the link in the email to reset your password.</p>
              <p>Didn't receive the email? Check your spam folder.</p>
            </div>
            
            <div className="pt-4">
              <Button variant="outline" asChild className="w-full">
                <Link to="/auth/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Link>
              </Button>
            </div>

            <div className="text-center">
              <button 
                onClick={() => setIsSubmitted(false)}
                className="text-sm text-primary hover:underline"
              >
                Try a different email/username
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center">
            <BrandLogo 
                            alt="Aqua Clear Pools Logo" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription>
            Enter the username for the account you want to reset
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Username</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Enter your username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Staff and customer accounts use separate usernames, even when they share contact details.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Email'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/auth/login" className="text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="mr-1 h-3 w-3 inline" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}