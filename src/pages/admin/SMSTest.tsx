import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Send, Phone } from 'lucide-react';

export default function SMSTest() {
  const { toast } = useToast();
  const [customerPhone, setCustomerPhone] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendSMS = async () => {
    console.log('Starting SMS send process...');
    console.log('Customer Phone:', customerPhone);
    console.log('Message Text:', messageText);
    
    if (!customerPhone.trim()) {
      toast({
        title: "Error",
        description: "Please enter a customer phone number",
        variant: "destructive",
      });
      return;
    }

    if (!messageText.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message to send",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      console.log('Calling Telnyx function with payload:', {
        to: customerPhone,
        message: messageText
      });

      const { data, error } = await supabase.functions.invoke('send-sms-via-telnyx', {
        body: {
          to: customerPhone,
          message: messageText
        }
      });

      console.log('Telnyx function response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data && data.success) {
        toast({
          title: "Message sent ✅",
          description: `SMS successfully sent to ${customerPhone}`,
        });

        // Clear form after successful send
        setCustomerPhone('');
        setMessageText('');
      } else {
        throw new Error(data?.error || 'Unknown error from Telnyx API');
      }

    } catch (error: any) {
      console.error('SMS sending error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send SMS",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <MessageSquare className="h-8 w-8" />
            <span>SMS Test</span>
          </h1>
          <p className="text-muted-foreground">Test the Telnyx SMS functionality</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Send className="h-5 w-5" />
            <span>Send Test SMS</span>
          </CardTitle>
          <CardDescription>
            Send a test SMS message to verify the Telnyx integration is working correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="customerPhone" className="flex items-center space-x-2">
              <Phone className="h-4 w-4" />
              <span>Customer Phone</span>
            </Label>
            <Input
              id="customerPhone"
              type="tel"
              placeholder="Enter phone number (e.g., +1234567890)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              disabled={sending}
            />
            <p className="text-xs text-muted-foreground">
              Enter phone number in international format (+1 for US numbers)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="messageText">Message</Label>
            <Textarea
              id="messageText"
              placeholder="Enter your test message here..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              disabled={sending}
            />
            <p className="text-xs text-muted-foreground">
              {messageText.length}/160 characters
            </p>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSendSMS} 
              disabled={sending || !customerPhone.trim() || !messageText.trim()}
              className="min-w-[120px]"
            >
              <Send className="mr-2 h-4 w-4" />
              {sending ? 'Sending...' : 'Send SMS'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start space-x-2">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono">1</span>
              <p>Enter a valid phone number in international format (e.g., +16015551234)</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono">2</span>
              <p>Type your test message in the textarea</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono">3</span>
              <p>Click "Send SMS" to test the Telnyx integration</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono">4</span>
              <p>Check your phone for the message and verify successful delivery</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}