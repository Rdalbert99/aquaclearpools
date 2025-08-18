import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, MessageSquare, Send, Check } from 'lucide-react';

interface ClientInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: {
    id: string;
    customer: string;
    email?: string;
    phone?: string;
  };
}

export function ClientInviteDialog({ open, onOpenChange, client }: ClientInviteDialogProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formData, setFormData] = useState({
    email: client.email || '',
    phone: client.phone || '',
    channels: [] as ('email' | 'sms')[]
  });

  const handleChannelChange = (channel: 'email' | 'sms', checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      channels: checked 
        ? [...prev.channels, channel]
        : prev.channels.filter(c => c !== channel)
    }));
  };

  const handleSendInvite = async () => {
    if (!formData.channels.length) {
      toast({
        title: "Error",
        description: "Please select at least one delivery method",
        variant: "destructive"
      });
      return;
    }

    if (formData.channels.includes('email') && !formData.email) {
      toast({
        title: "Error", 
        description: "Email address is required for email delivery",
        variant: "destructive"
      });
      return;
    }

    if (formData.channels.includes('sms') && !formData.phone) {
      toast({
        title: "Error",
        description: "Phone number is required for SMS delivery", 
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-client-invite', {
        body: {
          clientId: client.id,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          channels: formData.channels,
          baseUrl: window.location.origin
        }
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: "Invitation Sent",
        description: `Login invitation sent successfully to ${client.customer}`,
      });

    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setFormData({
      email: client.email || '',
      phone: client.phone || '',
      channels: []
    });
    setSent(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Send className="h-5 w-5" />
            <span>Send Client Login Invitation</span>
          </DialogTitle>
        </DialogHeader>

        {!sent ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Client Information</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  <strong>Client:</strong> {client.customer}
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-phone">Phone Number</Label>
                <Input
                  id="invite-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="space-y-3">
                <Label>Delivery Method</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="email-channel"
                      checked={formData.channels.includes('email')}
                      onCheckedChange={(checked) => handleChannelChange('email', checked as boolean)}
                      disabled={!formData.email}
                    />
                    <Mail className="h-4 w-4" />
                    <Label htmlFor="email-channel" className="text-sm">
                      Send via Email
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sms-channel"
                      checked={formData.channels.includes('sms')}
                      onCheckedChange={(checked) => handleChannelChange('sms', checked as boolean)}
                      disabled={!formData.phone}
                    />
                    <MessageSquare className="h-4 w-4" />
                    <Label htmlFor="sms-channel" className="text-sm">
                      Send via SMS
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSendInvite} 
                disabled={sending || !formData.channels.length}
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4 py-6">
            <div className="flex justify-center">
              <Check className="h-12 w-12 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Invitation Sent!</h3>
              <p className="text-sm text-muted-foreground">
                The client will receive instructions to create their account and login.
              </p>
            </div>
            <Button onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}