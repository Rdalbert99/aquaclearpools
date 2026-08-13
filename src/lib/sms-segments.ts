// GSM-7 / UCS-2 segment math matching what Telnyx bills per message part.

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€';

export type SmsEncoding = 'GSM-7' | 'UCS-2';

export interface SmsSegmentInfo {
  characters: number;
  encoding: SmsEncoding;
  /** Billable units (GSM extended chars count as 2). */
  units: number;
  segments: number;
  perSegment: number;
  remaining: number;
  maxSegments: number;
  overLimit: boolean;
}

export function analyzeSms(text: string, maxSegments = 10): SmsSegmentInfo {
  const chars = Array.from(text);
  const isGsm = chars.every(c => GSM_BASIC.includes(c) || GSM_EXTENDED.includes(c));
  const encoding: SmsEncoding = isGsm ? 'GSM-7' : 'UCS-2';

  const units = isGsm
    ? chars.reduce((n, c) => n + (GSM_EXTENDED.includes(c) ? 2 : 1), 0)
    : chars.reduce((n, c) => n + (c.codePointAt(0)! > 0xffff ? 2 : 1), 0);

  const single = isGsm ? 160 : 70;
  const multi = isGsm ? 153 : 67;
  const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi);
  const perSegment = segments > 1 ? multi : single;
  const capacity = segments > 1 ? multi * segments : single;

  return {
    characters: chars.length,
    encoding,
    units,
    segments,
    perSegment,
    remaining: Math.max(0, capacity - units),
    maxSegments,
    overLimit: segments > maxSegments,
  };
}
