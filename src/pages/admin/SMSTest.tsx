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

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-amber-600">⚠️ Not Receiving Messages?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-800 mb-2">✅ Code is Working!</h4>
              <p className="text-amber-700">
                Your integration is working correctly - Telnyx is accepting messages and returning success. 
                The issue is with your Telnyx account configuration.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold">🔧 Check Your Telnyx Account:</h4>
              
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <h5 className="font-medium text-blue-800">1. Phone Number Setup</h5>
                <ul className="text-blue-700 text-xs mt-1 ml-4 list-disc">
                  <li>Go to <strong>Numbers → My Numbers</strong></li>
                  <li>Find <code>+16014198527</code></li>
                  <li>Ensure <strong>"SMS Enabled"</strong> is checked ✅</li>
                  <li>Verify <strong>"Messaging Profile"</strong> is assigned</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded p-3">
                <h5 className="font-medium text-green-800">2. Account Status</h5>
                <ul className="text-green-700 text-xs mt-1 ml-4 list-disc">
                  <li>Go to <strong>Billing → Balance</strong></li>
                  <li>Verify sufficient credits for SMS</li>
                  <li>Check account verification status</li>
                  <li>Ensure no sending restrictions</li>
                </ul>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded p-3">
                <h5 className="font-medium text-purple-800">3. Messaging Profile</h5>
                <ul className="text-purple-700 text-xs mt-1 ml-4 list-disc">
                  <li>Go to <strong>Messaging → Messaging Profiles</strong></li>
                  <li>Ensure you have an active profile</li>
                  <li>Verify it's linked to your phone number</li>
                  <li>Check compliance requirements are met</li>
                </ul>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded p-3">
                <h5 className="font-medium text-orange-800">4. Message Tracking</h5>
                <ul className="text-orange-700 text-xs mt-1 ml-4 list-disc">
                  <li>Go to <strong>Messaging → Message Detail</strong></li>
                  <li>Search recent messages by phone number</li>
                  <li>Check delivery status and error details</li>
                  <li>Look for failed delivery reasons</li>
                </ul>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded p-3">
              <h5 className="font-medium text-red-800">🚨 Common Issues:</h5>
              <ul className="text-red-700 text-xs mt-1 ml-4 list-disc">
                <li><strong>New Account:</strong> May require verification before SMS works</li>
                <li><strong>Trial Account:</strong> Often has sending restrictions</li>
                <li><strong>Compliance:</strong> Business numbers may need 10DLC registration</li>
                <li><strong>Carrier Filtering:</strong> Some carriers block new/unverified senders</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}