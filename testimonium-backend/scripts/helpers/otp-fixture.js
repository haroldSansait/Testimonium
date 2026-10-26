// In-memory transaction fixture: exercises service behavior and rollback, not
// PostgreSQL lock semantics. No network, production database or real identities.
export function fixture(OtpService) {
  const rows = [];
  const writes = [];
  const mails = [];
  const users = new Map([['uid-1', { uid: 'uid-1', email: 'owner@example.invalid', emailVerified: false,
    providerData: [{ providerId: 'password' }] }]]);
  const calls = { passwords: [], revocations: [], verifications: [] };
  const match = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(part => match(row, part));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return (!value.in || value.in.includes(row[key])) && (!value.gte || row[key] >= value.gte) && (!value.gt || row[key] > value.gt);
    }
    return row[key] === value;
  });
  const patch = (row, data) => {
    for (const [key, value] of Object.entries(data)) row[key] = value?.increment ? row[key] + value.increment : value;
    row.updatedAt = new Date();
  };
  const prisma = {
    rows, writes, failStage: null,
    otpChallenge: {
      async create({ data }) {
        const row = { id: rows.length + 1, attempts: 0, maxAttempts: 5, createdAt: new Date(), lastSentAt: new Date(),
          resetTokenExpiresAt: null, resetTokenConsumedAt: null, operationHash: null, operationStage: null, operationStartedAt: null, ...data };
        rows.push(row); return structuredClone(row);
      },
      async findMany({ where, orderBy } = {}) {
        const found = rows.filter(row => match(row, where));
        if (orderBy) found.sort((a, b) => b.id - a.id);
        return structuredClone(found);
      },
      async findFirst(args) { return (await this.findMany(args))[0] || null; },
      async update({ where, data }) {
        if (prisma.failStage && data.operationStage === prisma.failStage) { prisma.failStage = null; throw new Error('injected database write failure'); }
        const row = rows.find(row => match(row, where));
        if (!row) throw new Error('Not found');
        patch(row, data); return structuredClone(row);
      },
      async updateMany({ where, data }) {
        const found = rows.filter(row => match(row, where));
        found.forEach(row => patch(row, data)); return { count: found.length };
      },
    },
    user: { async findUnique() { return { id: 1 }; }, async updateMany(args) { writes.push(args); return { count: 1 }; } },
    async $queryRaw(strings, key) { if (!strings.join('').includes('pg_advisory_xact_lock')) throw new Error('Missing database lock'); writes.push({ lock: key }); return []; },
  };
  let queue = Promise.resolve();
  prisma.$transaction = work => {
    const task = queue.then(async () => {
      const snapshot = structuredClone(rows);
      const touched = new Set();
      const tx = { ...prisma, otpChallenge: {
        ...prisma.otpChallenge,
        async create(args) { const row = await prisma.otpChallenge.create(args); touched.add(row.id); return row; },
        async update(args) { touched.add(args.where.id); return prisma.otpChallenge.update(args); },
        async updateMany(args) { rows.filter(row => match(row, args.where)).forEach(row => touched.add(row.id)); return prisma.otpChallenge.updateMany(args); },
      } };
      try { return await work(tx); }
      catch (error) {
        for (const id of touched) {
          const index = rows.findIndex(row => row.id === id);
          const prior = snapshot.find(row => row.id === id);
          if (prior) rows.splice(index, 1, prior);
          else if (index >= 0) rows.splice(index, 1);
        }
        throw error;
      }
    });
    queue = task.catch(() => {});
    return task;
  };
  const firebase = {
    async getUser(uid) { return structuredClone(users.get(uid)); },
    async getUserByEmail(email) { return structuredClone([...users.values()].find(u => u.email.toLowerCase() === email) || null); },
    async setEmailVerified(uid, verified, email) { calls.verifications.push(uid); Object.assign(users.get(uid), { emailVerified: verified, email }); },
    async updatePassword(uid, password) { calls.passwords.push({ uid, password }); },
    async revokeRefreshTokens(uid) { calls.revocations.push(uid); },
  };
  const delivery = { async send(mail) { mails.push(mail); return { messageId: 'fixture' }; } };
  const service = new OtpService(prisma, delivery, firebase, { async log() {} });
  const identity = { email: 'owner@example.invalid', firebaseUid: 'uid-1' };
  const code = () => mails.at(-1)?.subject.match(/\d{6}/)[0];
  const request = () => service.requestEmailVerificationOtp(identity);
  const confirm = value => service.confirmEmailVerificationOtp({ ...identity, code: value ?? code() });
  const requestReset = async () => {
    const result = await service.requestPasswordResetOtp(identity);
    await Promise.all([...service.dispatches]); return result;
  };
  const grant = async () => { await requestReset(); return service.verifyPasswordResetOtp({ email: identity.email, code: code() }); };
  const reset = token => service.completePasswordReset({ email: identity.email, resetToken: token, newPassword: 'SafePassword123!' });
  const age = () => { rows.forEach(row => { row.lastSentAt = new Date(Date.now() - 61_000); row.createdAt = new Date(Date.now() - 61_000); }); };
  const releaseLease = () => { rows.forEach(row => { row.operationStartedAt = new Date(Date.now() - 121_000); }); };
  return { prisma, rows, writes, mails, users, calls, firebase, delivery, service, identity, code, request, confirm, requestReset, grant, reset, age, releaseLease };
}
