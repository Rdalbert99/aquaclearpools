import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

interface TechnicianMessageDialogProps {
  clientId: string;
  technicianId: string;
  technicianName: string;
}

export function TechnicianMessageDialog({ 
  clientId, 
  technicianId, 
  technicianName 
}: TechnicianMessageDialogProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<string>('general');
  const [isLoading, setIsLoading] = useState(false);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);

  const loadRecentMessages = async () => {
    if (!clientId || !technicianId) return;

    try {
      const { data, error } = await supabase
        .from('client_tech_messages')
        .select(`
          *,
          sender:users!sender_id(name)
        `)
        .eq('client_id', clientId)
        .eq('technician_id', technicianId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentMessages(data || []);
    } catch (error) {
      console.error('Error loading recent messages:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRecentMessages();
    }
  }, [isOpen, clientId, technicianId]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user?.id) return;

    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('client_tech_messages')
        .insert({
          client_id: clientId,
          technician_id: technicianId,
          sender_id: user.id,
          message: message.trim(),
          message_type: messageType
        });

      if (error) throw error;

      toast.success('Message sent to your technician');
      setMessage('');
      setMessageType('general');
      loadRecentMessages();
      setIsOpen(false);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-16 text-left flex-col items-start p-4">
          <div className="flex items-center space-x-2 mb-1">
            <MessageCircle className="h-5 w-5" />
            <span className="font-semibold">Message Technician</span>
          </div>
          <span className="text-sm opacity-80">Send special instructions to {technicianName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Message Your Technician</DialogTitle>
          <DialogDescription>
            Send a message to {technicianName} about your upcoming service
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Recent Messages */}
          {recentMessages.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Recent Messages</Label>
              <div className="bg-muted p-3 rounded-lg max-h-40 overflow-y-auto">
                {recentMessages.map((msg) => (
                  <div key={msg.id} className="mb-2 last:mb-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{msg.sender?.name || 'Unknown'}</span>
                      <span>{new Date(msg.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Type */}
          <div className="space-y-2">
            <Label htmlFor="messageType">Message Type</Label>
            <Select value={messageType} onValueChange={setMessageType}>
              <SelectTrigger>
                <SelectValue placeholder="Select message type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Message</SelectItem>
                <SelectItem value="service_request">Service Request</SelectItem>
                <SelectItem value="special_instruction">Special Instructions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message Content */}
          <div className="space-y-2">
            <Label htmlFor="message">Your Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Send Button */}
          <Button 
            onClick={handleSendMessage} 
            disabled={!message.trim() || isLoading}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {isLoading ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}