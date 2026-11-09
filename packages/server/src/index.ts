/**
 * NH-ERM API server (skeleton).
 *
 * Runnable with zero external services: uses an in-memory risk store and the
 * in-memory audit store so `npm run dev -w @nh-erm/server` boots immediately.
 * Swap `InMemoryRiskStore` for a Prisma-backed store (see prisma/schema.prisma)
 * for production. Uses Node's built-in http — no web framework dependency.
 */

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  assessRisk,
  syncTopRisk,
  IMPACT_DOMAINS,
  NAJRAN_ORG_STRUCTURE,
  normalizeOrgName,
  departmentKpis,
  DEFAULT_INDICATORS,
  type RiskAssessmentInput,
} from '@nh-erm/core';
import { InMemoryAuditStore } from './audit/audit.ts';
import { can, scopeRecords, ROLE_LABELS, ROLE_CAPABILITIES, type Actor, type RoleKey } from './auth/rbac.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

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
  // Display fields (populated when migrated from the official file).
  title?: string | null;
  department?: string | null;
  sector?: string | null;
  owner?: string | null;
  residualLevel?: number | null;
  inherentBand?: string | null;
  inherentLabel?: string | null;
  updateDate?: string | null; // register "تاريخ التحديث" (col51) — drives KPI adherence
}

const risks = new Map<string, StoredRisk>();
let migrationReport: unknown = null;

/** Load risks migrated from the official Excel file (scripts/extract_risks.py), if present. */
async function loadCurrentRisks(): Promise<void> {
  try {
    const raw = await readFile(join(__dirname, '..', 'data', 'current-risks.json'), 'utf8');
    const data = JSON.parse(raw) as {
      register: Record<string, unknown>[];
      newRisks: Record<string, unknown>[];
      report: unknown;
    };
    migrationReport = data.report;
    const add = (r: Record<string, unknown>, status: 'ACTIVE' | 'PENDING_APPROVAL') => {
      // Prefix by status so a pending "new risk" sharing a code with a register
      // risk does not overwrite it (both are kept, as in the real two sheets).
      const id = (status === 'ACTIVE' ? 'r_' : 'rn_') + String(r.code);
      risks.set(id, {
        id,
        code: String(r.code),
        departmentId: (r.department as string) ?? 'unknown',
        status,
        input: {
          likelihood: (r.likelihood as 1) ?? 1,
          impacts: (r.impacts as Record<string, number>) ?? {},
          controlAnswers: [r.controlActivated, r.controlShared, r.controlComplied, r.controlEffective].map(Boolean),
        },
        residualPriority: (r.residualPriority as number) ?? 25,
        isTopRisk: status === 'ACTIVE' && Boolean(r.isTopRisk),
        deletedAt: null,
        updatedAt: (r.lastUpdate as string) ?? new Date().toISOString(),
        title: (r.title as string) ?? null,
        department: (r.department as string) ?? null,
        sector: (r.sector as string) ?? null,
        owner: (r.owner as string) ?? null,
        residualLevel: (r.residualLevel as number) ?? null,
        inherentBand: (r.inherentBand as string) ?? null,
        inherentLabel: (r.inherentLabel as string) ?? null,
        updateDate: (r.updateDate as string) ?? null,
      });
    };
    for (const r of data.register ?? []) add(r, 'ACTIVE');
    for (const r of data.newRisks ?? []) add(r, 'PENDING_APPROVAL');
    // eslint-disable-next-line no-console
    console.log(`Loaded ${risks.size} risks migrated from the official file.`);
  } catch {
    // No migration file yet — start empty.
  }
}

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

// Serve the self-contained demo UI (no build step, no npm deps).
route('GET', '/', async (_req, res) => {
  try {
    const html = await readFile(join(PUBLIC_DIR, 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch {
    json(res, 404, { error: 'demo UI not found' });
  }
});

// Static assets (logo, watermark) from public/assets.
route('GET', '/assets/:file', async (_req, res, ctx) => {
  const file = ctx.params.file.replace(/[^a-zA-Z0-9._-]/g, ''); // no path traversal
  try {
    const buf = await readFile(join(PUBLIC_DIR, 'assets', file));
    const ext = file.split('.').pop();
    const type = ext === 'png' ? 'image/png' : ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=3600' });
    res.end(buf);
  } catch {
    json(res, 404, { error: 'asset not found' });
  }
});

// Live assessment (no persistence) — lets the UI show the real engine output.
route('POST', '/api/assess', (_req, res, ctx) => {
  const b = ctx.body as { assessment?: RiskAssessmentInput };
  if (!b?.assessment) return json(res, 400, { error: 'assessment required' });
  json(res, 200, assessRisk(b.assessment));
});

// The 24 impact domains (for building the UI form).
route('GET', '/api/domains', (_req, res) => json(res, 200, { domains: IMPACT_DOMAINS }));

// List the official register — ACTIVE risks, soft-deleted excluded (§6).
// Group 2 sees only their own department (§12 "dashboard/lists = own dept").
route('GET', '/api/risks', (_req, res, ctx) => {
  if (!can(ctx.actor, 'risk:read')) return json(res, 403, { error: 'forbidden' });
  const active = scopeRecords(ctx.actor, [...risks.values()].filter((r) => !r.deletedAt && r.status === 'ACTIVE'), (r) => r.departmentId);
  json(res, 200, { count: active.length, risks: active });
});

// List top risks — §4
route('GET', '/api/top-risks', (_req, res, ctx) => {
  if (!can(ctx.actor, 'risk:read')) return json(res, 403, { error: 'forbidden' });
  const top = scopeRecords(ctx.actor, [...risks.values()].filter((r) => !r.deletedAt && r.isTopRisk), (r) => r.departmentId);
  json(res, 200, { count: top.length, risks: top });
});

// List new/pending risks — §13 staging area
route('GET', '/api/new-risks', (_req, res, ctx) => {
  if (!can(ctx.actor, 'risk:read')) return json(res, 403, { error: 'forbidden' });
  const pending = scopeRecords(ctx.actor, [...risks.values()].filter((r) => !r.deletedAt && r.status === 'PENDING_APPROVAL'), (r) => r.departmentId);
  json(res, 200, { count: pending.length, risks: pending });
});

// Migration report from the official-file import (§3)
route('GET', '/api/migration-report', (_req, res) => json(res, 200, migrationReport ?? { note: 'no migration loaded' }));

// Official organizational structure (§12, signed org chart)
route('GET', '/api/org-structure', (_req, res) => json(res, 200, NAJRAN_ORG_STRUCTURE));

// KPI — department adherence to the quarterly update cycle (§9), from the register.
route('GET', '/api/kpi', (_req, res, ctx) => {
  if (!can(ctx.actor, 'risk:read')) return json(res, 403, { error: 'forbidden' });
  const active = scopeRecords(ctx.actor, [...risks.values()].filter((r) => !r.deletedAt && r.status === 'ACTIVE'), (r) => r.departmentId);
  const kpis = departmentKpis(
    active.map((r) => ({
      department: r.department ? normalizeOrgName(r.department) : '—',
      updateDate: r.updateDate ? new Date(r.updateDate) : null,
    })),
  );
  json(res, 200, { config: DEFAULT_INDICATORS, kpis });
});

// Indicators configuration (§9 — confirmed thresholds, configurable)
route('GET', '/api/indicators-config', (_req, res) => json(res, 200, DEFAULT_INDICATORS));

// RBAC roles & capabilities reference (§12 official matrix)
route('GET', '/api/roles', (_req, res) => {
  const roles = (Object.keys(ROLE_LABELS) as RoleKey[]).map((key) => ({
    key,
    ...ROLE_LABELS[key],
    capabilities: ROLE_CAPABILITIES[key],
  }));
  json(res, 200, { roles });
});

// Risk distribution by sector and department, computed from the register (§10)
route('GET', '/api/by-sector', (_req, res, ctx) => {
  if (!can(ctx.actor, 'risk:read')) return json(res, 403, { error: 'forbidden' });
  const active = [...risks.values()].filter((r) => !r.deletedAt && r.status === 'ACTIVE');
  const bySector = new Map<string, { count: number; top: number }>();
  const byDept = new Map<string, number>();
  for (const r of active) {
    const sec = r.sector ? normalizeOrgName(r.sector) : '—';
    const dep = r.department ? normalizeOrgName(r.department) : '—';
    const s = bySector.get(sec) ?? { count: 0, top: 0 };
    s.count++;
    if (r.isTopRisk) s.top++;
    bySector.set(sec, s);
    byDept.set(dep, (byDept.get(dep) ?? 0) + 1);
  }
  const sectors = [...bySector.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count);
  const departments = [...byDept.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  json(res, 200, { sectors, departments });
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
  await loadCurrentRisks();
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`NH-ERM API listening on http://localhost:${PORT}`);
  });
}

export { server, risks, audit };
