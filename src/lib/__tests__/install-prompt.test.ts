import { describe, it, expect } from 'vitest';
import { shouldOfferInstall } from '@/components/pwa/InstallPrompt';

describe('install prompt rules', () => {
  it('never shows inside the installed app', () => {
    expect(shouldOfferInstall({ standalone: true, dismissed: false, pathname: '/' })).toBe(false);
  });
  it('never shows on sign-in or sign-up screens', () => {
    expect(shouldOfferInstall({ standalone: false, dismissed: false, pathname: '/auth/login' })).toBe(false);
    expect(shouldOfferInstall({ standalone: false, dismissed: false, pathname: '/auth/signup' })).toBe(false);
  });
  it('stays hidden once dismissed', () => {
    expect(shouldOfferInstall({ standalone: false, dismissed: true, pathname: '/' })).toBe(false);
  });
  it('may show on public pages for browsers', () => {
    expect(shouldOfferInstall({ standalone: false, dismissed: false, pathname: '/services' })).toBe(true);
  });
});
