import { supabase } from '@/integrations/supabase/client';

export type MessageLogStatus = 'sent' | 'failed' | 'fallback' | 'skipped';

export interface MessageLogEntry {
  clientId?: string | null;
  clientName?: string | null;
  technicianId?: string | null;
  technicianName?: string | null;
  source?: string;
  channel: 'sms' | 'email' | 'none';
  recipient?: string | null;
  message?: string | null;
  status: MessageLogStatus;
  errorDetail?: string | null;
  providerMessageId?: string | null;
  /** Unique code embedded in the message link so opens can be tracked. */
  trackToken?: string | null;
}

/**
 * Records an attempt to send a customer message. Never throws — logging must
 * not break the service flow.
 */
export async function logMessageSend(entry: MessageLogEntry): Promise<void> {
  try {
    await supabase.from('message_send_logs').insert({
      client_id: entry.clientId ?? null,
      client_name: entry.clientName ?? null,
      technician_id: entry.technicianId ?? null,
      technician_name: entry.technicianName ?? null,
      source: entry.source ?? 'review_and_send',
      channel: entry.channel,
      recipient: entry.recipient ?? null,
      message: entry.message ?? null,
      status: entry.status,
      error_detail: entry.errorDetail ?? null,
      provider_message_id: entry.providerMessageId ?? null,
      track_token: entry.trackToken ?? null,
    } as any);
  } catch (err) {
    console.error('Failed to write message send log:', err);
  }
}
