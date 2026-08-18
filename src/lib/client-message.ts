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
  /**
   * Base tracking code that appears in the message link (see makeTrackingLink).
   * A per-channel suffix is appended so SMS and email opens are counted separately.
   */
  trackToken?: string | null;
}

const TRACK_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-open`;

/** Creates a trackable login link for a client message. */
export function makeTrackingLink(path: string = '/auth/login') {
  const token = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const url = `${TRACK_ENDPOINT}?t=${token}${path === '/auth/login' ? '' : `&p=${encodeURIComponent(path)}`}`;
  return { token, url };
}

/** Swaps the base token in the link for a channel-specific one. */
function channelBody(body: string, baseToken: string | null | undefined, channel: SendChannel) {
  if (!baseToken) return { body, token: null as string | null };
  const token = `${baseToken}${channel === 'sms' ? 's' : 'e'}`;
  return { body: body.replaceAll(`t=${baseToken}`, `t=${token}`), token };
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
  trackToken,
}: SendClientMessageArgs): Promise<ChannelResult[]> {
  const results: ChannelResult[] = [];
  const body = message.trim();

  if (channels.includes('sms') && phone) {
    const { body: smsBody, token: smsToken } = channelBody(body, trackToken, 'sms');
    let result: ChannelResult;
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-via-telnyx', {
        body: { to: phone, message: smsBody },
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
      message: smsBody,
      trackToken: smsToken,
      status: result.status,
      errorDetail: result.error ?? null,
      providerMessageId: result.providerMessageId ?? null,
    });
  }

  if (channels.includes('email') && email) {
    const { body: emailBody, token: emailToken } = channelBody(body, trackToken, 'email');
    let result: ChannelResult;
    try {
      const { data, error } = await supabase.functions.invoke('mailjet-test-email', {
        body: { to: email, subject, text: emailBody, html: toHtml(emailBody) },
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
      message: emailBody,
      trackToken: emailToken,
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
