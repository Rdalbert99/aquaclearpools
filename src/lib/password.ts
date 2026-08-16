// Password helpers shared across admin screens.
// Supabase auth requires lowercase + uppercase + digits; project policy is 12+ chars.

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*';

function pick(set: string, rand: Uint32Array, i: number) {
  return set.charAt(rand[i] % set.length);
}

export function generateStrongPassword(length = 14): string {
  const len = Math.max(12, length);
  const rand = new Uint32Array(len);
  crypto.getRandomValues(rand);

  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars: string[] = [
    pick(LOWER, rand, 0),
    pick(UPPER, rand, 1),
    pick(DIGITS, rand, 2),
    pick(SYMBOLS, rand, 3),
  ];
  for (let i = 4; i < len; i++) chars.push(pick(all, rand, i));

  // Shuffle so the guaranteed characters aren't always in the same positions
  const shuffle = new Uint32Array(chars.length);
  crypto.getRandomValues(shuffle);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffle[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function validatePassword(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters long.';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include a number.';
  return null;
}
