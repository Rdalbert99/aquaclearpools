import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Phone, Send } from 'lucide-react';

export const TechInviteDialog = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);

  const handleSend = async () => {
    const channels: ("email" | "sms")[] = [];
    if (sendEmail) channels.push("email");
    if (sendSms) channels.push("sms");

    if (channels.length === 0) {
      toast({ title: "Error", description: "Select at least one delivery method.", variant: "destructive" });
      return;
    }
    if (sendEmail && !email.trim()) {
      toast({ title: "Error", description: "Email is required for email delivery.", variant: "destructive" });
      return;
    }
    if (sendSms && !phone.trim()) {
      toast({ title: "Error", description: "Phone number is required for SMS delivery.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-tech-invite', {
        body: {
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          channels,
          baseUrl: window.location.origin,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: "Invite Sent!", description: "The technician invite has been sent successfully." });
      setOpen(false);
      setEmail('');
      setPhone('');
      setSendEmail(true);
      setSendSms(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send invite.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-16 flex-col">
          <UserPlus className="h-5 w-5 mb-1" />
          <span className="text-sm">Invite Tech</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite a Technician
          </DialogTitle>
          <DialogDescription>
            Send an invite link so a new tech can create their own account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox id="sendEmail" checked={sendEmail} onCheckedChange={(v) => setSendEmail(!!v)} />
              <Label htmlFor="sendEmail" className="flex items-center gap-1.5 cursor-pointer">
                <Mail className="h-4 w-4" /> Send via Email
              </Label>
            </div>
            {sendEmail && (
              <Input
                type="email"
                placeholder="tech@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox id="sendSms" checked={sendSms} onCheckedChange={(v) => setSendSms(!!v)} />
              <Label htmlFor="sendSms" className="flex items-center gap-1.5 cursor-pointer">
                <Phone className="h-4 w-4" /> Send via SMS
              </Label>
            </div>
            {sendSms && (
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}
          </div>

          <Button onClick={handleSend} disabled={isLoading} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            {isLoading ? 'Sending...' : 'Send Invite'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
