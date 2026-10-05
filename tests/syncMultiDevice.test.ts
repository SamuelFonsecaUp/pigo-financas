import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { initDatabase, closeDatabase, SEED_TIMESTAMP } from '../electron/database.cjs';
import { CloudAuth } from '../electron/cloudAuth.cjs';
import { CloudSyncEngine } from '../electron/syncEngine.cjs';
import { FinancialService } from '../electron/services.cjs';

const USER_ID = 'usr_multi_device';

// Minimal in-memory imitation of the Supabase REST + Auth endpoints used by the sync engine
function createFakeSupabase() {
  const tables: Record<string, Map<string, any>> = {};
  const state = {
    validTokens: new Set<string>(['token_valid']),
    refreshTokens: new Map<string, string>([['refresh_ok', 'token_refreshed']]),
    missingColumns: {} as Record<string, string[]>,
    requests: [] as string[],
    // Simulates the server trigger that stamps updated_at with the server clock
    serverClock: false,
    storageEnabled: true,
    files: new Map<string, string>(),
  };
  let serverTick = Date.parse('2030-01-01T00:00:00.000Z');
  const stamp = (row: any) => (state.serverClock ? { ...row, updated_at: new Date(serverTick += 1000).toISOString() } : row);

  const table = (name: string) => {
    if (!tables[name]) tables[name] = new Map();
    return tables[name];
  };

  const json = (status: number, body: any) =>
    new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchImpl = async (input: any, init: any = {}) => {
    const url = new URL(String(input));
    const method = (init.method || 'GET').toUpperCase();
    state.requests.push(`${method} ${url.pathname}`);

    if (url.pathname === '/auth/v1/health') return json(200, { ok: true });

    if (url.pathname === '/auth/v1/token') {
      const body = JSON.parse(init.body);
      const access = state.refreshTokens.get(body.refresh_token);
      if (!access) return json(400, { error_description: 'Invalid Refresh Token' });
      state.validTokens.add(access);
      return json(200, { access_token: access, refresh_token: body.refresh_token, expires_in: 3600 });
    }

    const auth = (init.headers?.Authorization || '').replace('Bearer ', '');
    if (!state.validTokens.has(auth)) return json(401, { message: 'JWT expired' });

    if (url.pathname.startsWith('/storage/v1/')) {
      if (!state.storageEnabled) return json(400, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' });
      const key = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/object\/(authenticated\/)?statements\//, ''));
      if (method === 'POST') {
        state.files.set(key, Buffer.from(init.body).toString('utf8'));
        return json(200, { Key: key });
      }
      return state.files.has(key) ? new Response(state.files.get(key), { status: 200 }) : json(400, { error: 'not_found', message: 'Object not found' });
    }

    const name = url.pathname.replace('/rest/v1/', '');
    const rows = table(name);

    if (method === 'POST') {
      const parsed = JSON.parse(init.body);
      const payload = Array.isArray(parsed) ? parsed : [parsed];
      for (const col of state.missingColumns[name] || []) {
        if (payload.some((r: any) => col in r)) {
          return json(400, { code: 'PGRST204', message: `Could not find the '${col}' column of '${name}' in the schema cache` });
        }
      }
      const keyOf = (r: any) => r.id ?? r.user_id;
      const saved = payload.map((r: any) => {
        const merged = stamp({ ...(rows.get(keyOf(r)) || {}), ...r });
        rows.set(keyOf(r), merged);
        return merged;
      });
      return json(201, saved);
    }

    if (method === 'PATCH') {
      const idsParam = url.searchParams.get('id') || '';
      const ids = idsParam.replace(/^in\.\(/, '').replace(/\)$/, '').split(',').map(s => s.replace(/"/g, ''));
      const patch = JSON.parse(init.body);
      for (const id of ids) if (rows.has(id)) rows.set(id, stamp({ ...rows.get(id), ...patch }));
      return json(204, null);
    }

    // GET with user_id, updated_at=gt., limit, offset filters
    const gt = url.searchParams.get('updated_at')?.replace('gt.', '');
    const limit = Number(url.searchParams.get('limit') || 1000);
    const offset = Number(url.searchParams.get('offset') || 0);
    const result = [...rows.values()]
      .filter(r => r.user_id === USER_ID)
      .filter(r => !gt || Date.parse(r.updated_at) > Date.parse(gt))
      .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at) || a.id.localeCompare(b.id))
      .slice(offset, offset + limit);
    return json(200, result);
  };

  return { tables, table, state, fetchImpl };
}

function createDevice(accessToken = 'token_valid', expiresAt = Date.now() + 3600_000) {
  const db = initDatabase(':memory:');
  const service = new FinancialService(db);
  const auth = new CloudAuth(db);
  auth.saveSession({ userId: USER_ID, email: 'multi@teste.com', accessToken, refreshToken: 'refresh_ok', expiresAt, syncEnabled: true });
  const statementsFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'pigo-stmts-'));
  const engine = new CloudSyncEngine(db, auth, { getStatementsFolder: () => statementsFolder });
  return { db, service, auth, engine, statementsFolder };
}

describe('Multi-device cloud sync', () => {
  let fake: ReturnType<typeof createFakeSupabase>;

  beforeEach(() => {
    fake = createFakeSupabase();
    vi.stubGlobal('fetch', fake.fetchImpl);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    closeDatabase();
  });

  it('marks local edits as pending and records deletions as tombstones', () => {
    const { db, service } = createDevice();
    const acc = service.createAccount({ name: 'Conta', type: 'checking', initialBalance: 0 });
    db.prepare(`UPDATE accounts SET sync_status = 'synced'`).run();

    service.updateAccount(acc.id, { name: 'Conta Editada' });
    expect(db.prepare(`SELECT sync_status FROM accounts WHERE id = ?`).get(acc.id).sync_status).toBe('pending');

    service.deleteAccount(acc.id);
    const tomb = db.prepare(`SELECT * FROM sync_tombstones WHERE table_name = 'accounts' AND row_id = ?`).get(acc.id);
    expect(tomb).toBeDefined();
  });

  it('keeps the seed timestamp of default categories when associating data with the user', () => {
    const { db, auth } = createDevice();
    auth.associateLocalDataWithUser(USER_ID);
    const cat = db.prepare(`SELECT updated_at, sync_status FROM categories WHERE id = 'cat_alimentacao'`).get();
    expect(cat.updated_at).toBe(SEED_TIMESTAMP);
    expect(cat.sync_status).toBe('pending');
  });

  it('refreshes an expired access token instead of silently failing', async () => {
    const { service, engine, auth } = createDevice('token_expired', Date.now() - 1000);
    service.createAccount({ name: 'Nubank', type: 'checking', initialBalance: 1000 });

    const res = await engine.sync();
    expect(res.status).toBe('synced');
    expect(res.pushedCount).toBeGreaterThan(0);
    expect(auth.getSession().accessToken).toBe('token_refreshed');
    expect([...fake.table('accounts').values()].some(r => r.name === 'Nubank')).toBe(true);
  });

  it('reports auth_expired when the refresh token is no longer valid', async () => {
    const { engine, auth, service } = createDevice('token_expired', Date.now() - 1000);
    auth.saveSession({ refreshToken: 'refresh_revoked' });
    service.createAccount({ name: 'Inter', type: 'checking', initialBalance: 0 });

    const res = await engine.sync();
    expect(res.status).toBe('auth_expired');
    expect(res.pendingCount).toBeGreaterThan(0);
  });

  it('propagates creations, edits and deletions between two computers', async () => {
    const pcA = createDevice();
    const acc = pcA.service.createAccount({ name: 'Conta Principal', type: 'checking', initialBalance: 50000 });
    const tx = pcA.service.createTransaction({
      type: 'expense', description: 'Mercado', amount: 12000, transactionDate: '2026-10-01',
      accountId: acc.id, categoryId: 'cat_alimentacao', status: 'completed',
    });
    expect((await pcA.engine.sync()).status).toBe('synced');

    // Second computer, fresh install: restore everything
    const pcB = createDevice();
    const restore = await pcB.engine.fullPull();
    expect(restore.success).toBe(true);
    expect(pcB.service.getAccounts().find((a: any) => a.id === acc.id)?.currentBalance).toBe(38000);

    // Edit + delete on A
    pcA.service.updateAccount(acc.id, { name: 'Conta Renomeada' });
    pcA.service.deleteTransaction(tx.id);
    expect((await pcA.engine.sync()).status).toBe('synced');

    // B receives both changes
    expect((await pcB.engine.sync()).status).toBe('synced');
    expect(pcB.service.getAccounts().find((a: any) => a.id === acc.id)?.name).toBe('Conta Renomeada');
    expect(pcB.db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE id = ?`).get(tx.id).c).toBe(0);
    // Applying a remote deletion must not create a local tombstone
    expect(pcB.db.prepare(`SELECT COUNT(*) as c FROM sync_tombstones`).get().c).toBe(0);
  });

  it('does not overwrite cloud edits of default categories on a fresh install', async () => {
    const pcA = createDevice();
    pcA.service.updateCategory('cat_lazer', { name: 'Lazer & Viagens' });
    await pcA.engine.sync();

    const pcB = createDevice();
    pcB.auth.associateLocalDataWithUser(USER_ID);
    await pcB.engine.sync();

    expect(pcB.db.prepare(`SELECT name FROM categories WHERE id = 'cat_lazer'`).get().name).toBe('Lazer & Viagens');
    expect(fake.table('categories').get('cat_lazer').name).toBe('Lazer & Viagens');
  });

  it('downloads more than one page of transactions', async () => {
    const remote = fake.table('transactions');
    const base = Date.parse('2026-09-01T00:00:00.000Z');
    for (let i = 0; i < 1205; i++) {
      remote.set(`tx_${i}`, {
        id: `tx_${i}`, user_id: USER_ID, type: 'expense', description: `Compra ${i}`, amount: 100,
        transaction_date: '2026-09-10', status: 'completed', updated_at: new Date(base + i * 1000).toISOString(),
      });
    }
    const pc = createDevice();
    const res = await pc.engine.fullPull();
    expect(res.totalRestored).toBeGreaterThanOrEqual(1205);
    expect(pc.db.prepare(`SELECT COUNT(*) as c FROM transactions`).get().c).toBe(1205);
  });

  it('retries a push without columns the cloud schema does not have', async () => {
    fake.state.missingColumns.accounts = ['icon'];
    const pc = createDevice();
    pc.service.createAccount({ name: 'Carteira', type: 'cash', initialBalance: 0 });
    const res = await pc.engine.sync();
    expect(res.status).toBe('synced');
    const remote = [...fake.table('accounts').values()].find(r => r.name === 'Carteira');
    expect(remote).toBeDefined();
    expect('icon' in remote).toBe(false);
  });

  it('keeps working with server-side timestamps and syncs settings between computers', async () => {
    fake.state.serverClock = true;
    const pcA = createDevice();
    pcA.service.createAccount({ name: 'Conta A', type: 'checking', initialBalance: 0 });
    pcA.service.updateSettings({ userName: 'Samuel', reserveTargetMonths: 9 });
    expect((await pcA.engine.sync()).status).toBe('synced');
    // Local row now carries the server timestamp, so the next sync has nothing to push
    expect(pcA.engine.getPendingCount()).toBe(0);

    const pcB = createDevice();
    await pcB.engine.fullPull();
    const settingsB = pcB.service.getSettings();
    expect(settingsB.userName).toBe('Samuel');
    expect(settingsB.reserveTargetMonths).toBe(9);
    expect(pcB.service.getAccounts().some((a: any) => a.name === 'Conta A')).toBe(true);
  });

  it('reports optional cloud features that are not installed yet', async () => {
    fake.state.storageEnabled = false;
    const pc = createDevice();
    pc.db.prepare(`INSERT INTO imported_statements (id, file_name, original_name, file_type, file_size, saved_path, imported_at) VALUES ('st1', 'x.ofx', 'x.ofx', 'ofx', 1, ?, ?)`)
      .run(__filename, new Date().toISOString());
    const res = await pc.engine.sync();
    expect(res.status).toBe('synced');
    expect(res.featuresMissing).toContain('statements_bucket');
  });

  it('uploads original statement files and restores them on another computer', async () => {
    const pcA = createDevice();
    const filePath = path.join(pcA.statementsFolder, 'extrato_set.ofx');
    fs.writeFileSync(filePath, '<OFX>conteudo</OFX>');
    pcA.db.prepare(`INSERT INTO imported_statements (id, file_name, original_name, file_type, file_size, saved_path, imported_at) VALUES ('st_a', 'extrato_set.ofx', 'extrato.ofx', 'ofx', 20, ?, ?)`)
      .run(filePath, new Date().toISOString());
    const resA = await pcA.engine.sync();
    expect(resA.filesUploaded).toBe(1);
    // The other computer does not have computer A's disk
    fs.rmSync(filePath);

    const pcB = createDevice();
    await pcB.engine.fullPull();
    expect(fs.readFileSync(path.join(pcB.statementsFolder, 'extrato_set.ofx'), 'utf8')).toBe('<OFX>conteudo</OFX>');
  });
});
