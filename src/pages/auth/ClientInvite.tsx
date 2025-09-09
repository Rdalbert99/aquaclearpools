import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";


interface InvitePayload {
  token: string;
  client_id: string;
  customer: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  expires_at: string;
}

export default function ClientInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      
      try {
        // Get client IP and user agent for security logging
        const clientIP = await fetch('https://api.ipify.org?format=json')
          .then(r => r.json())
          .then(data => data.ip)
          .catch(() => 'unknown');

        const userAgent = navigator.userAgent;

        // Use the secure function with audit logging
        const { data, error } = await supabase.rpc("get_client_invite_payload_secure", { 
          invite_token: token,
          accessor_ip: clientIP,
          accessor_user_agent: userAgent
        });
        
        if (error || !data) {
          setInvite(null);
        } else {
          setInvite(data as any);
          setName((data as any).customer || "");
          setEmail(((data as any).email as string) || "");
          setPhone(((data as any).phone as string) || "");
          setAddress(((data as any).address as string) || "");
        }
      } catch (error) {
        console.error('Error loading invite:', error);
        setInvite(null);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleSubmit = async () => {
    if (!token) return;
    if (!email || !invite) {
      toast({ title: "Email required", description: "Please enter a valid email.", variant: "destructive" });
      return;
    }
    if (!password || password !== confirm) {
      toast({ title: "Password mismatch", description: "Passwords must match.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("complete-client-invite", {
        body: {
          token,
          name,
          email,
          phone: phone || undefined,
          address: address || undefined,
          password,
        },
      });
      if (error) throw error;
      toast({ title: "Account created", description: "You can now log in.", variant: "default" });
      navigate("/auth/login");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to complete invite.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6"><div className="flex items-center justify-center min-h-[300px]"><LoadingSpinner /></div></div>
    );
  }

  if (!invite) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Invitation Invalid or Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">This invitation link is not valid or has expired. Please contact support.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <img 
              src="/lovable-uploads/ac1a09a4-823e-491c-bf59-fb76c8abb196.png" 
              alt="Aqua Clear Pools" 
              className="h-16 w-auto"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Create Your Account</CardTitle>
          <p className="text-muted-foreground">Complete your registration to get started</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email" 
                value={email} 
                disabled 
                className="bg-muted text-muted-foreground cursor-not-allowed" 
              />
              <p className="text-xs text-muted-foreground">Email is locked to the invitation</p>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
