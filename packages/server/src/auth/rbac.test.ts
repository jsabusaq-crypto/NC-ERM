/** RBAC capability tests (§12). Run: `node --test`. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, type Actor } from './rbac.ts';

const ermManager: Actor = { userId: 'u1', roles: ['ERM_MANAGER'], departmentId: null };
const deptUser: Actor = { userId: 'u2', roles: ['DEPARTMENT_USER'], departmentId: 'd1' };
const deptMgr: Actor = { userId: 'u3', roles: ['DEPARTMENT_MANAGER'], departmentId: 'd1' };
const viewer: Actor = { userId: 'u4', roles: ['VIEWER'], departmentId: 'd2' };

test('ERM manager can create users and edit methodology', () => {
  assert.equal(can(ermManager, 'user:create'), true);
  assert.equal(can(ermManager, 'methodology:edit'), true);
  assert.equal(can(ermManager, 'risk:approve'), true);
});

test('department user edits within own department only, cannot approve', () => {
  assert.equal(can(deptUser, 'risk:update', 'd1'), true);
  assert.equal(can(deptUser, 'risk:update', 'd2'), false); // other department
  assert.equal(can(deptUser, 'risk:approve', 'd1'), false); // §13: approval not granted
});

test('department manager approves new risks in own department', () => {
  assert.equal(can(deptMgr, 'risk:approve', 'd1'), true);
  assert.equal(can(deptMgr, 'risk:approve', 'd2'), false);
});

test('viewer is read-only', () => {
  assert.equal(can(viewer, 'risk:read'), true);
  assert.equal(can(viewer, 'risk:update', 'd2'), false);
  assert.equal(can(viewer, 'risk:delete', 'd2'), false);
});
