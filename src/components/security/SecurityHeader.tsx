import { useEffect } from 'react';

interface SecurityHeaderProps {
  children: React.ReactNode;
}

export const SecurityHeader = ({ children }: SecurityHeaderProps) => {
  useEffect(() => {
    // Set security headers via meta tags for client-side security
    const setSecurityMeta = () => {
      // Content Security Policy
      const cspMeta = document.createElement('meta');
      cspMeta.httpEquiv = 'Content-Security-Policy';
      cspMeta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://tbqqigqkbogibwumjyol.supabase.co https://api.resend.com;";
      
      // Referrer Policy
      const referrerMeta = document.createElement('meta');
      referrerMeta.name = 'referrer';
      referrerMeta.content = 'strict-origin-when-cross-origin';
      
      // X-Content-Type-Options
      const contentTypeMeta = document.createElement('meta');
      contentTypeMeta.httpEquiv = 'X-Content-Type-Options';
      contentTypeMeta.content = 'nosniff';
      
      // Check if already exists before adding
      if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        document.head.appendChild(cspMeta);
      }
      if (!document.querySelector('meta[name="referrer"]')) {
        document.head.appendChild(referrerMeta);
      }
      if (!document.querySelector('meta[http-equiv="X-Content-Type-Options"]')) {
        document.head.appendChild(contentTypeMeta);
      }
    };

    setSecurityMeta();
  }, []);

  return <>{children}</>;
};