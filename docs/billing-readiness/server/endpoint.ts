import { z } from 'zod';
import type { enrollmentService } from './enrollment';
import type { executeInvoice } from './workflow';
// Prepared Request/Response binding only. No Deno.serve, entrypoint, credentials or default deps.
// Host must supply exact allowed origin(s), verified service bindings and deployed-name mapping.
export function billingEndpoint(deps: {
  enabled: boolean; allowedOrigins: string[];
  enrollment: ReturnType<typeof enrollmentService>;
  execute: (credential: string, approvalId: string) => ReturnType<typeof executeInvoice>;
}) {
  return async (request: Request) => {
    const origin = request.headers.get('origin');
    const headers = new Headers({ 'Content-Type': 'application/json', 'Vary': 'Origin' });
    if (origin) {
      if (!deps.allowedOrigins.includes(origin)) return new Response(JSON.stringify({ error: 'origin_rejected' }), { status: 403, headers });
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Headers', 'authorization, content-type, apikey');
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });
    if (!deps.enabled) return reply({ error: 'backend_setup_pending' }, 503);
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    const credential = request.headers.get('authorization');
    if (!credential) return reply({ error: 'unauthorized' }, 401);
    try {
      const body = z.discriminatedUnion('action', [
        z.object({ action: z.literal('read_enrollment'), clientId: z.string().uuid() }).strict(),
        z.object({ action: z.literal('save_enrollment'), clientId: z.string().uuid(), enabled: z.boolean(), firstServicePeriod: z.string().nullable(), expectedRevision: z.number().int().nonnegative() }).strict(),
        z.object({ action: z.literal('execute'), approvalId: z.string().uuid() }).strict(),
      ]).parse(await request.json());
      if (body.action === 'execute') return reply(await deps.execute(credential, body.approvalId), 200);
      if (body.action === 'read_enrollment') return reply({ enrollment: await deps.enrollment.read(credential, body.clientId) }, 200);
      const { action, ...input } = body;
      return reply({ enrollment: await deps.enrollment.save(credential, input) }, 200);
    } catch (error) {
      const code = error instanceof z.ZodError ? 'invalid_request' : error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'request_failed';
      return reply({ error: code }, code === 'unauthorized' ? 401 : code === 'cross_business' ? 403 : code === 'request_failed' ? 503 : 400);
    }
  };
}
