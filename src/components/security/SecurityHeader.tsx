import { useEffect } from 'react';

interface SecurityHeaderProps {
  children: React.ReactNode;
}

export const SecurityHeader = ({ children }: SecurityHeaderProps) => {
  useEffect(() => {
    // Set enhanced security headers via meta tags for client-side security
    const setSecurityMeta = () => {
      // Enhanced Content Security Policy
      const cspMeta = document.createElement('meta');
      cspMeta.httpEquiv = 'Content-Security-Policy';
      const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
      const scriptSrc = `script-src 'self' ${isLocalhost ? "'unsafe-eval'" : ''} https://cdn.jsdelivr.net`.trim();
      cspMeta.content = [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https://tbqqigqkbogibwumjyol.supabase.co wss://tbqqigqkbogibwumjyol.supabase.co https://api.resend.com",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "upgrade-insecure-requests",
        "block-all-mixed-content"
      ].join('; ');
      
      // Strict Referrer Policy
      const referrerMeta = document.createElement('meta');
      referrerMeta.name = 'referrer';
      referrerMeta.content = 'strict-origin-when-cross-origin';
      
      // X-Content-Type-Options
      const contentTypeMeta = document.createElement('meta');
      contentTypeMeta.httpEquiv = 'X-Content-Type-Options';
      contentTypeMeta.content = 'nosniff';
      
      // X-Frame-Options
      const frameOptionsMeta = document.createElement('meta');
      frameOptionsMeta.httpEquiv = 'X-Frame-Options';
      frameOptionsMeta.content = 'DENY';
      
      // X-XSS-Protection
      const xssProtectionMeta = document.createElement('meta');
      xssProtectionMeta.httpEquiv = 'X-XSS-Protection';
      xssProtectionMeta.content = '1; mode=block';
      
      // Permissions Policy
      const permissionsMeta = document.createElement('meta');
      permissionsMeta.httpEquiv = 'Permissions-Policy';
      permissionsMeta.content = 'camera=(), microphone=(), geolocation=(), payment=()';
      
      // Check if already exists before adding
      const securityHeaders = [
        { meta: cspMeta, selector: 'meta[http-equiv="Content-Security-Policy"]' },
        { meta: referrerMeta, selector: 'meta[name="referrer"]' },
        { meta: contentTypeMeta, selector: 'meta[http-equiv="X-Content-Type-Options"]' },
        { meta: frameOptionsMeta, selector: 'meta[http-equiv="X-Frame-Options"]' },
        { meta: xssProtectionMeta, selector: 'meta[http-equiv="X-XSS-Protection"]' },
        { meta: permissionsMeta, selector: 'meta[http-equiv="Permissions-Policy"]' }
      ];
      
      securityHeaders.forEach(({ meta, selector }) => {
        if (!document.querySelector(selector)) {
          document.head.appendChild(meta);
        }
      });
    };

    // Security monitoring setup
    const setupSecurityMonitoring = () => {
      // Remove production debug override for security
      // Console logging is now properly controlled by build environment
      
      // Add security event listeners
      window.addEventListener('error', (event) => {
        if (event.error && event.error.stack) {
          // Log potential security-related errors
          if (event.error.message.includes('script') || event.error.message.includes('eval')) {
            console.warn('Security: Potential code injection attempt detected');
          }
        }
      });
    };

    setSecurityMeta();
    setupSecurityMonitoring();
  }, []);

  return <>{children}</>;
};