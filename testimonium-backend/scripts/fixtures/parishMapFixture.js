// Isolated persistence fixture: no Firebase, database, storage, or audit writes.
import express from 'express';
import router from '../../routes/parishRoutes.js';
import { prisma } from '../../config/db.js';
import { AuditLogService } from '../../services/AuditLogService.js';

export function createParishMapFixture(mock) {
  const restorers = [];
  const replace = (target, key, value) => {
    const original = target[key];
    target[key] = value;
    restorers.push(() => { target[key] = original; });
  };
  const rows = [1, 2].map((id) => ({
    id, parishName: `Map Fixture ${id}`, type: 'PARISH', isActive: true, users: [],
    latitude: 10.4 + id / 100, longitude: 123.25 + id / 100, mapZoom: 13,
    pinColor: '#7B1C2A', showLabel: true, directoryDescription: `Original description ${id}`,
    contactNumber: '09123456789', email: `fixture${id}@example.test`,
    locationUpdatedAt: new Date('2026-10-01T00:00:00Z'), locationUpdatedBy: 10,
    documentSettings: '{}', eventSettings: '{}', officeHours: '{}',
  }));
  const writes = [];
  const audits = [];
  const requests = [];
  const failDirectories = new Set();
  const findUnique = async ({ where }) => structuredClone(rows.find((row) => row.id === where.id) ?? null);
  const update = async ({ where, data }) => {
    const row = rows.find((item) => item.id === where.id);
    if (!row) throw Object.assign(new Error('Not found'), { statusCode: 404 });
    writes.push({ id: where.id, data: structuredClone(data) });
    Object.assign(row, data);
    return structuredClone(row);
  };
  replace(prisma.parish, 'findUnique', findUnique);
  replace(prisma.parish, 'findMany', async () => structuredClone(rows));
  replace(prisma.parish, 'update', update);
  replace(prisma, '$transaction', async (callback) => {
    const before = structuredClone(rows);
    try { return await callback({ parish: { findUnique, update } }); }
    catch (error) { rows.splice(0, rows.length, ...before); throw error; }
  });
  mock.method(AuditLogService, 'log', async (...args) => { audits.push(args); });

  // Replace only the fixture router's authentication layer. Production role,
  // validator, controller, tenant guard and service code still execute.
  const auth = router.stack.find((layer) => layer.handle.name === 'authenticateFirebaseToken');
  if (!auth) throw new Error('Expected authentication layer missing');
  mock.method(auth, 'handle', (req, res, next) => {
    if (req.get('x-fixture-role') === 'ANONYMOUS') return res.status(401).json({ success: false });
    req.user = { id: 10, role: req.get('x-fixture-role') || 'DIOCESE_COORDINATOR', parish: { id: 1 } };
    next();
  });
  const app = express();
  app.use(express.json());
  app.use('/parishes', (req, res, next) => {
    requests.push({ method: req.method, path: req.path, body: structuredClone(req.body) });
    const id = /^\/(\d+)\/directory-settings$/.exec(req.path)?.[1];
    if (req.method === 'PATCH' && failDirectories.has(id)) {
      return res.status(503).json({ success: false, message: 'Fixture directory failure' });
    }
    next();
  }, router);
  app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  });
  return { app, rows, writes, audits, requests, failDirectories, restore: () => restorers.reverse().forEach((restore) => restore()) };
}
