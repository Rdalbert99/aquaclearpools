import { supabase } from '@/integrations/supabase/client';
import { extractSendError } from '@/lib/send-error';
import { logMessageSend, type MessageLogEntry } from '@/lib/message-log';

export type SendChannel = 'sms' | 'email';

export interface ChannelResult {
  channel: SendChannel;
  recipient: string;
  status: 'sent' | 'failed';
  error?: string;
  providerMessageId?: string | null;
}

interface SendClientMessageArgs {
  channels: SendChannel[];
  phone?: string | null;
  email?: string | null;
  message: string;
  subject?: string;
  /** Base log info (client/tech identity, source). */
  log: Omit<MessageLogEntry, 'channel' | 'status' | 'recipient' | 'message'>;
}

function toHtml(message: string) {
  return message
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;color:#0f172a">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/**
 * Sends a technician message to a client over SMS and/or email.
 * Every attempt is written to message_send_logs so delivery status is trackable.
 */
export async function sendClientMessage({
  channels,
  phone,
  email,
  message,
  subject = 'Aqua Clear Pools - Service Update',
  log,
}: SendClientMessageArgs): Promise<ChannelResult[]> {
  const results: ChannelResult[] = [];
  const body = message.trim();

  if (channels.includes('sms') && phone) {
    let result: ChannelResult;
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-via-telnyx', {
        body: { to: phone, message: body },
      });
      if (error || (data && (data as any).success === false)) {
        const detail = await extractSendError(error, data);
        result = { channel: 'sms', recipient: phone, status: 'failed', error: detail };
      } else {
        result = {
          channel: 'sms',
          recipient: phone,
          status: 'sent',
          providerMessageId: (data as any)?.messageId ?? null,
        };
      }
    } catch (e: any) {
      result = { channel: 'sms', recipient: phone, status: 'failed', error: e?.message || 'Network/function error' };
    }
    results.push(result);
    await logMessageSend({
      ...log,
      channel: 'sms',
      recipient: phone,
      message: body,
      status: result.status,
      errorDetail: result.error ?? null,
      providerMessageId: result.providerMessageId ?? null,
    });
  }

  if (channels.includes('email') && email) {
    let result: ChannelResult;
    try {
      const { data, error } = await supabase.functions.invoke('mailjet-test-email', {
        body: { to: email, subject, text: body, html: toHtml(body) },
      });
      if (error || (data && (data as any).success === false)) {
        const detail = await extractSendError(error, data);
        result = { channel: 'email', recipient: email, status: 'failed', error: detail };
      } else {
        const mjId = (data as any)?.response?.Messages?.[0]?.To?.[0]?.MessageID ?? null;
        result = { channel: 'email', recipient: email, status: 'sent', providerMessageId: mjId ? String(mjId) : null };
      }
    } catch (e: any) {
      result = { channel: 'email', recipient: email, status: 'failed', error: e?.message || 'Network/function error' };
    }
    results.push(result);
    await logMessageSend({
      ...log,
      channel: 'email',
      recipient: email,
      message: body,
      status: result.status,
      errorDetail: result.error ?? null,
      providerMessageId: result.providerMessageId ?? null,
    });
  }

  return results;
}

export function summarizeResults(results: ChannelResult[]) {
  const sent = results.filter((r) => r.status === 'sent');
  const failed = results.filter((r) => r.status === 'failed');
  const label = (r: ChannelResult) => (r.channel === 'sms' ? 'Text' : 'Email');
  return {
    sent,
    failed,
    allSent: failed.length === 0 && sent.length > 0,
    text: [
      sent.length ? `${sent.map(label).join(' + ')} delivered` : '',
      failed.length ? `${failed.map((r) => `${label(r)} failed: ${r.error}`).join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('. '),
  };
}
