import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('additive prerequisite migration preserves existing schedules, enforces constraints and blocks public access', async () => {
  // Disposable PostgreSQL WASM instance; never connects to configured Supabase.
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE schedules (schedule_id SERIAL PRIMARY KEY);
      INSERT INTO schedules DEFAULT VALUES;
      ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated;
      ALTER DEFAULT PRIVILEGES GRANT ALL ON SEQUENCES TO anon, authenticated;`);
    const migration = await readFile(new URL('../prisma/migrations/20261026090000_schedule_prerequisites/migration.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    assert.equal((await db.query('SELECT * FROM schedules')).rows.length, 1);
    const insert = `INSERT INTO schedule_attachments (schedule_id, requirement_id, requirement_label, file_name, r2_object_key, file_type, file_size)
      VALUES ($1, $2, 'Birth Certificate', 'evidence.pdf', $3, 'application/pdf', 10)`;
    await db.query(insert, [1, 'birth_cert', 'private-object-1']);
    await assert.rejects(db.query(insert, [1, 'birth_cert', 'different-object']), { code: '23505' });
    await assert.rejects(db.query(insert, [1, 'marriage_cert', 'private-object-1']), { code: '23505' });
    await assert.rejects(db.query(insert, [99, 'birth_cert', 'missing-parent']), { code: '23503' });
    await assert.rejects(db.exec('DELETE FROM schedules WHERE schedule_id = 1'), { code: '23503' });
    const rls = await db.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'schedule_attachments'");
    assert.equal(rls.rows[0].relrowsecurity, true);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('SET ROLE ' + role);
      await assert.rejects(db.exec('SELECT * FROM schedule_attachments'), { code: '42501' });
      await assert.rejects(db.exec("SELECT nextval('schedule_attachments_attachment_id_seq')"), { code: '42501' });
      await db.exec('RESET ROLE');
    }
  } finally { await db.close(); }
});
