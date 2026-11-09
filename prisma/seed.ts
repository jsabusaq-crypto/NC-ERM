/**
 * NH-ERM database seed.
 *
 * Seeds: the 8 RBAC roles (§12), the default methodology config v1 (§8), and a
 * minimal org structure (cluster → sector → department) so the app has data to
 * render. Run after `prisma migrate dev`:  `node --experimental-strip-types prisma/seed.ts`
 * (requires @prisma/client + a reachable DATABASE_URL).
 */

import { PrismaClient } from '@prisma/client';
import { DEFAULT_METHODOLOGY, validateMethodology } from '@nh-erm/core';

const prisma = new PrismaClient();

const ROLES: { key: string; nameAr: string; nameEn: string }[] = [
  { key: 'ERM_MANAGER', nameAr: 'مدير إدارة المخاطر المؤسسية', nameEn: 'ERM Manager' },
  { key: 'CLUSTER_CEO', nameAr: 'الرئيس التنفيذي للتجمع', nameEn: 'Cluster CEO' },
  { key: 'DEPARTMENT_MANAGER', nameAr: 'مدير الإدارة', nameEn: 'Department Manager' },
  { key: 'RISK_OWNER', nameAr: 'مالك الخطر', nameEn: 'Risk Owner' },
  { key: 'DEPARTMENT_USER', nameAr: 'مستخدم الإدارة', nameEn: 'Department User' },
  { key: 'VIEWER', nameAr: 'مطّلع', nameEn: 'Viewer' },
  { key: 'AUDITOR', nameAr: 'مدقّق', nameEn: 'Auditor' },
  { key: 'SYSTEM_ADMIN', nameAr: 'مدير النظام', nameEn: 'System Admin' },
];

async function main() {
  validateMethodology(DEFAULT_METHODOLOGY);

  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { key: r.key as never },
      update: { nameAr: r.nameAr, nameEn: r.nameEn },
      create: { key: r.key as never, nameAr: r.nameAr, nameEn: r.nameEn },
    });
  }

  await prisma.methodologyConfig.upsert({
    where: { version: 1 },
    update: { config: DEFAULT_METHODOLOGY as never, isActive: true },
    create: {
      version: 1,
      config: DEFAULT_METHODOLOGY as never,
      isActive: true,
      note: 'Default methodology — contains ⚠ VERIFY placeholders (see docs/REQUIREMENTS.md §15).',
    },
  });

  const cluster = await prisma.cluster.create({
    data: { nameAr: 'تجمع نجران الصحي', nameEn: 'Najran Health Cluster' },
  });
  const sector = await prisma.sector.create({
    data: { clusterId: cluster.id, nameAr: 'تقديم الرعاية الصحية', nameEn: 'Healthcare Delivery' },
  });
  await prisma.department.create({
    data: { sectorId: sector.id, nameAr: 'تقنية المعلومات', nameEn: 'Information Technology' },
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete: 8 roles, methodology v1, 1 cluster/sector/department.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
