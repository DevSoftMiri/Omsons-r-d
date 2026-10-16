import test from 'node:test';
import assert from 'node:assert/strict';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Benchmarking } from '../models/Benchmarking.js';
import { requireProjectEditor, createProject, updateProject } from './projectController.js';
import { authorize } from '../middleware/authMiddleware.js';

function response() { return { code: 200, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; } }; }
async function run(handler, req, res) {
  let error;
  let passed = false;
  await handler(req, res, err => { error = err; passed = !err; });
  return { error, passed };
}

test('project edit access accepts assigned staff and admins, rejects unassigned staff', async t => {
  t.mock.method(Project, 'findOne', async () => ({ teamMembers: ['staff-1'] }));
  for (const [role, id, allowed] of [['Staff', 'staff-1', true], ['Staff', 'other', false], ['Admin', 'admin', true]]) {
    const res = response();
    const result = await run(requireProjectEditor, { params: { id: 'GLW-0101' }, user: { role, _id: id } }, res);
    assert.equal(result.passed, allowed);
    if (!allowed) assert.equal(res.code, 403);
  }
});

test('staff creation adds the creator to the team even when no members were chosen', async t => {
  let saved;
  t.mock.method(User, 'findOne', async () => ({ _id: 'admin-1' }));
  t.mock.method(Project, 'countDocuments', async () => 0);
  t.mock.method(Project, 'create', async payload => { saved = payload; return { ...payload, _id: 'new-project' }; });
  t.mock.method(Benchmarking, 'create', async () => ({}));
  const res = response();
  const result = await run(createProject, { user: { role: 'Staff', _id: 'staff-1' }, body: {
    name: 'New project', startDate: '2099-01-01', targetDate: '2099-12-31', teamMemberIds: [],
  } }, res);
  assert.equal(result.error, undefined);
  assert.equal(res.code, 201);
  assert.deepEqual(saved.teamMembers, ['staff-1']);
  assert.equal(saved.reportTo, 'admin-1');
});

test('editing rejects reversed dates without saving', async t => {
  let saved = false;
  t.mock.method(Project, 'findOne', async () => ({ startDate: '2099-01-01', targetDate: '2099-12-31', save() { saved = true; } }));
  const res = response();
  const result = await run(updateProject, { params: { id: 'GLW-0101' }, body: { startDate: '2099-12-31', targetDate: '2099-01-01' } }, res);
  assert.ok(result.error);
  assert.equal(res.code, 400);
  assert.equal(saved, false);
});

test('staff cannot use admin-only deletion permissions', () => {
  const res = response();
  assert.throws(() => authorize('Admin')({ user: { role: 'Staff' } }, res, () => {}), /Insufficient permissions/);
  assert.equal(res.code, 403);
});
