/** RBAC tests — official 2-group matrix (§12). Run: `node --test`. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, isPlatformWide, readScope, type Actor } from './rbac.ts';

const ceo: Actor = { userId: 'u1', roles: ['CLUSTER_CEO'], departmentId: null };
const grc: Actor = { userId: 'u2', roles: ['GRC_DIRECTOR'], departmentId: null };
const erm: Actor = { userId: 'u3', roles: ['ERM_MANAGER'], departmentId: null };
const deptMgr: Actor = { userId: 'u4', roles: ['DEPARTMENT_MANAGER'], departmentId: 'd1' };
const deputy: Actor = { userId: 'u5', roles: ['DEPUTY'], departmentId: 'd1' };
const owner: Actor = { userId: 'u6', roles: ['RISK_OWNER'], departmentId: 'd1' };
const champion: Actor = { userId: 'u7', roles: ['RISK_CHAMPION'], departmentId: 'd2' };

test('Group 1 roles have full platform permissions', () => {
  for (const a of [ceo, grc, erm]) {
    assert.equal(isPlatformWide(a), true);
    assert.equal(can(a, 'user:create'), true);
    assert.equal(can(a, 'methodology:edit'), true);
    assert.equal(can(a, 'audit:read'), true);
    assert.equal(can(a, 'risk:approve', 'any-dept'), true);
    assert.equal(readScope(a).scope, 'all');
  }
});

test('Group 2 is confined to its own department', () => {
  assert.equal(isPlatformWide(deptMgr), false);
  assert.equal(readScope(deptMgr).scope, 'department');
  assert.equal(readScope(deptMgr).departmentId, 'd1');

  // full CRUD within own department
  assert.equal(can(owner, 'risk:create', 'd1'), true);
  assert.equal(can(owner, 'risk:update', 'd1'), true);
  assert.equal(can(owner, 'risk:delete', 'd1'), true);
  // but nothing in another department
  assert.equal(can(owner, 'risk:read', 'd2'), false);
  assert.equal(can(owner, 'risk:update', 'd2'), false);
  // and no platform-level powers
  assert.equal(can(owner, 'user:create'), false);
  assert.equal(can(owner, 'methodology:edit'), false);
  assert.equal(can(owner, 'audit:read'), false);
});

test('new-risk approval is the management level only (manager/deputy)', () => {
  assert.equal(can(deptMgr, 'risk:approve', 'd1'), true);
  assert.equal(can(deputy, 'risk:approve', 'd1'), true);
  assert.equal(can(owner, 'risk:approve', 'd1'), false);
  assert.equal(can(champion, 'risk:approve', 'd2'), false);
  // managers cannot approve in another department
  assert.equal(can(deptMgr, 'risk:approve', 'd2'), false);
});

test('Group 2 may export only their own department', () => {
  assert.equal(can(deptMgr, 'export:run', 'd1'), true);
  assert.equal(can(deptMgr, 'export:run', 'd2'), false);
  assert.equal(can(ceo, 'export:run', 'any'), true); // Group 1 exports anything
});
