/**
 * NH-ERM API server (skeleton).
 *
 * Runnable with zero external services: uses an in-memory risk store and the
 * in-memory audit store so `npm run dev -w @nh-erm/server` boots immediately.
 * Swap `InMemoryRiskStore` for a Prisma-backed store (see prisma/schema.prisma)
 * for production. Uses Node's built-in http — no web framework dependency.
 */

import http from 'node:http';
import { assessRisk, syncTopRisk, type RiskAssessmentInput } from '@nh-erm/core';
import { InMemoryAuditStore } from './audit/audit.ts';
import { can, type Actor } from './auth/rbac.ts';

const PORT = Number(process.env.PORT ?? 4000);
const audit = new InMemoryAuditStore();

interface StoredRisk {
  id: string;
  code: string;
  departmentId: string;
  status: 'PENDING_APPROVAL' | 'ACTIVE';
  input: RiskAssessmentInput;
  residualPriority: number;
  isTopRisk: boolean;
  deletedAt: string | null;
  updatedAt: string;
}

const risks = new Map<string, StoredRisk>();

// Dev actor — in production this comes from the authenticated session.
const DEV_ACTOR: Actor = { userId: 'dev', roles: ['ERM_MANAGER'], departmentId: null };

type Handler = (req: http.IncomingMessage, res: http.ServerResponse, ctx: Ctx) => Promise<void> | void;
interface Ctx {
  actor: Actor;
  params: Record<string, string>;
  body: unknown;
}

const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];
function route(method: string, path: string, handler: Handler): void {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' + path.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$',
  );
  routes.push({ method, pattern, keys, handler });
}

// ── Routes ───────────────────────────────────────────────────────────────────

route('GET', '/health', (_req, res) => json(res, 200, { ok: true, service: 'nh-erm', ts: new Date().toISOString() }));

// List active risks (soft-deleted excluded) — §6
route('GET', '/api/risks', (_req, res, ctx) => {
  if (!can(ctx.actor, 'risk:read')) return json(res, 403, { error: 'forbidden' });
  const active = [...risks.values()].filter((r) => !r.deletedAt);
  json(res, 200, { count: active.length, risks: active });
});

// List top risks — §4
route('GET', '/api/top-risks', (_req, res, ctx) => {
  if (!can(ctx.actor, 'risk:read')) return json(res, 403, { error: 'forbidden' });
  const top = [...risks.values()].filter((r) => !r.deletedAt && r.isTopRisk);
  json(res, 200, { count: top.length, risks: top });
});

// Create a risk (enters PENDING_APPROVAL staging — §13)
route('POST', '/api/risks', async (_req, res, ctx) => {
  const b = ctx.body as { code?: string; departmentId?: string; assessment?: RiskAssessmentInput };
  if (!b?.code || !b.departmentId || !b.assessment) return json(res, 400, { error: 'code, departmentId, assessment required' });
  if (!can(ctx.actor, 'risk:create', b.departmentId)) return json(res, 403, { error: 'forbidden' });

  const result = assessRisk(b.assessment);
  const id = cryptoId();
  const risk: StoredRisk = {
    id, code: b.code, departmentId: b.departmentId,
    status: 'PENDING_APPROVAL', // §13: not in official register until approved
    input: b.assessment,
    residualPriority: result.residualPriority,
    isTopRisk: false, // top-risk only computed after approval
    deletedAt: null, updatedAt: new Date().toISOString(),
  };
  risks.set(id, risk);
  await audit.append({ kind: 'RISK_CREATE', userId: ctx.actor.userId, departmentId: b.departmentId, entityType: 'risk', entityId: id });
  json(res, 201, { risk, assessment: result });
});

// Approve a pending new risk — §13 (moves to ACTIVE, computes top-risk)
route('POST', '/api/risks/:id/approve', async (_req, res, ctx) => {
  const risk = risks.get(ctx.params.id);
  if (!risk) return json(res, 404, { error: 'not found' });
  if (!can(ctx.actor, 'risk:approve', risk.departmentId)) return json(res, 403, { error: 'forbidden' });

  const result = assessRisk(risk.input);
  const sync = syncTopRisk(null, result.residualPriority);
  risk.status = 'ACTIVE';
  risk.residualPriority = result.residualPriority;
  risk.isTopRisk = sync.isTopRiskNow;
  risk.updatedAt = new Date().toISOString();
  await audit.append({ kind: 'RISK_UPDATE', userId: ctx.actor.userId, departmentId: risk.departmentId, entityType: 'risk', entityId: risk.id, newValue: 'APPROVED' });
  json(res, 200, { risk, assessment: result, topRisk: sync });
});

// Update a risk's assessment — recomputes level & top-risk sync (§4, §6)
route('PUT', '/api/risks/:id', async (_req, res, ctx) => {
  const risk = risks.get(ctx.params.id);
  if (!risk || risk.deletedAt) return json(res, 404, { error: 'not found' });
  if (!can(ctx.actor, 'risk:update', risk.departmentId)) return json(res, 403, { error: 'forbidden' });
  const b = ctx.body as { assessment?: RiskAssessmentInput };
  if (!b?.assessment) return json(res, 400, { error: 'assessment required' });

  const before = risk.residualPriority;
  const result = assessRisk(b.assessment);
  const sync = syncTopRisk(risk.status === 'ACTIVE' ? before : null, result.residualPriority);
  risk.input = b.assessment;
  risk.residualPriority = result.residualPriority;
  risk.isTopRisk = risk.status === 'ACTIVE' ? sync.isTopRiskNow : false;
  risk.updatedAt = new Date().toISOString();
  await audit.append({ kind: 'RISK_UPDATE', userId: ctx.actor.userId, departmentId: risk.departmentId, entityType: 'risk', entityId: risk.id, oldValue: String(before), newValue: String(result.residualPriority) });
  json(res, 200, { risk, assessment: result, topRisk: sync });
});

// Soft delete — §6
route('DELETE', '/api/risks/:id', async (_req, res, ctx) => {
  const risk = risks.get(ctx.params.id);
  if (!risk || risk.deletedAt) return json(res, 404, { error: 'not found' });
  if (!can(ctx.actor, 'risk:delete', risk.departmentId)) return json(res, 403, { error: 'forbidden' });
  risk.deletedAt = new Date().toISOString();
  risk.isTopRisk = false; // hidden from current export, history retained
  await audit.append({ kind: 'RISK_DELETE', userId: ctx.actor.userId, departmentId: risk.departmentId, entityType: 'risk', entityId: risk.id });
  json(res, 200, { ok: true, softDeleted: true });
});

// Restore — §6
route('POST', '/api/risks/:id/restore', async (_req, res, ctx) => {
  const risk = risks.get(ctx.params.id);
  if (!risk || !risk.deletedAt) return json(res, 404, { error: 'not found or not deleted' });
  if (!can(ctx.actor, 'risk:restore', risk.departmentId)) return json(res, 403, { error: 'forbidden' });
  risk.deletedAt = null;
  const result = assessRisk(risk.input);
  risk.isTopRisk = risk.status === 'ACTIVE' && result.isTopRisk;
  await audit.append({ kind: 'RISK_RESTORE', userId: ctx.actor.userId, departmentId: risk.departmentId, entityType: 'risk', entityId: risk.id });
  json(res, 200, { ok: true, risk });
});

// Audit search (§7)
route('GET', '/api/audit', async (_req, res, ctx) => {
  if (!can(ctx.actor, 'audit:read')) return json(res, 403, { error: 'forbidden' });
  json(res, 200, { entries: await audit.search({}) });
});

// ── Server plumbing ──────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const match = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
    if (!match) return json(res, 404, { error: 'route not found' });
    const m = url.pathname.match(match.pattern)!;
    const params: Record<string, string> = {};
    match.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    const body = await readBody(req);
    await match.handler(req, res, { actor: DEV_ACTOR, params, body });
  } catch (err) {
    json(res, 500, { error: 'internal', detail: String(err) });
  }
});

function json(res: http.ServerResponse, status: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'DELETE') return undefined;
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

function cryptoId(): string {
  return 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Only listen when run directly, not when imported by tests.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`NH-ERM API listening on http://localhost:${PORT}`);
  });
}

export { server, risks, audit };
