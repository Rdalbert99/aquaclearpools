import { createBillingApplication } from './production';
// Concrete deployment entrypoint, deliberately outside automatic deployment paths.
// Host configuration is allowlisted, not browser-supplied. No network on import.
export function startBillingHost(host: {
  env: { get(name:string):string|undefined };
  serve(handler:(request:Request)=>Promise<Response>):unknown;
}, fetcher: typeof fetch = fetch) {
  const businessId=host.env.get('BILLING_BUSINESS_ID');
  const environment=host.env.get('QBO_ENVIRONMENT');
  const realmId=host.env.get('BILLING_QBO_REALM_ID');
  if(!businessId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId)||!realmId||!/^\d{1,20}$/.test(realmId)||!['sandbox','production'].includes(environment??''))throw new Error('host_scope_setup_pending');
  const app=createBillingApplication({secret:n=>host.env.get(n),fetch:fetcher,scope:{businessId,environment:environment==='production'?'production':'sandbox',realmId},allowedOrigins:['https://getaquaclear.com','https://aquaclear-pools.lovable.app']});
  return host.serve(app.handler);
}