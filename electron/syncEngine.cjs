/**
 * Cloud Sync Engine (Local-First Bidirectional Delta Sync)
 *
 * Sincroniza o SQLite local com o Supabase PostgreSQL em segundo plano:
 * 1. Pull: baixa alterações remotas (updated_at > última marca, com margem de segurança)
 * 2. Push de exclusões: replica tombstones locais como soft delete (deleted_at) na nuvem
 * 3. Push: envia linhas locais pendentes (marcadas pelos triggers do SQLite)
 * 4. Resolução de conflitos: Last-Write-Wins por updated_at
 * 5. Renova o token do Supabase automaticamente e reporta falhas em vez de ignorá-las
 */

const fs = require('fs');
const path = require('path');
const { SYNC_TABLES, withSyncSuppressed } = require('./database.cjs');
const { AuthExpiredError } = require('./cloudAuth.cjs');

// PostgREST (Supabase) devolve no máximo 1000 linhas por requisição
const PULL_PAGE_SIZE = 1000;
const PUSH_CHUNK_SIZE = 500;
const TOMBSTONE_CHUNK_SIZE = 100;
// Margem para tolerar diferença de relógio entre computadores
const PULL_OVERLAP_MS = 10 * 60 * 1000;
// Colunas que existem apenas no SQLite local
const LOCAL_ONLY_COLUMNS = ['sync_status', 'is_demo'];
// Configurações que acompanham o usuário entre computadores (PIN e pasta de backup ficam locais)
const SYNCED_SETTINGS_COLUMNS = [
  'user_name', 'currency', 'theme', 'first_day_of_week', 'date_format',
  'reserve_target_months', 'reserve_account_ids', 'reserve_category_ids',
  'reserve_initial_amount', 'reserve_auto_detect', 'reserve_excluded_tx_ids',
];
const STATEMENTS_BUCKET = 'statements';
const MAX_FILE_TRANSFERS_PER_SYNC = 20;
const PAUSED_MESSAGE = 'Seu projeto no Supabase está pausado por inatividade. Acesse supabase.com/dashboard, abra o projeto e clique em "Restore project".';

function isAuthExpired(err) {
  return Boolean(err && err.code === 'auth_expired');
}

function toTime(iso) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

async function describeHttpError(res) {
  const text = await res.text().catch(() => '');
  try {
    const body = JSON.parse(text);
    return { code: body.code, message: body.message || body.msg || text || `HTTP ${res.status}` };
  } catch (e) {
    return { code: null, message: text || `HTTP ${res.status}` };
  }
}

class CloudSyncEngine {
  constructor(db, cloudAuth, options = {}) {
    this.db = db;
    this.auth = cloudAuth;
    this.getStatementsFolder = options.getStatementsFolder || null;
    this.isSyncing = false;
    this.session = null;
    // Recursos opcionais do Supabase (criados pelo SQL de melhorias); false = ausente
    this.remoteFeatures = { settings: null, storage: null };
    // Colunas locais que a tabela remota não possui (descobertas em tempo de execução)
    this.unknownRemoteColumns = {};
  }

  // Quick connectivity check: 'online' | 'offline' | 'paused'
  async checkConnectivity(supabaseUrl, anonKey) {
    try {
      const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { signal: controller.signal, headers: anonKey ? { apikey: anonKey } : {} });
      clearTimeout(timeoutId);
      if (res.status === 540) return 'paused';
      if (res.status >= 500) {
        const text = await res.text().catch(() => '');
        return /paused/i.test(text) ? 'paused' : 'offline';
      }
      return 'online';
    } catch (e) {
      return 'offline';
    }
  }

  async checkOnline(supabaseUrl) {
    return (await this.checkConnectivity(supabaseUrl)) === 'online';
  }

  // Authenticated REST call; refreshes the token once on 401
  async request(path, options = {}, allowRetry = true) {
    const base = options.base || 'rest/v1';
    const url = `${this.session.supabaseUrl.replace(/\/$/, '')}/${base}/${path}`;
    const { base: _base, ...fetchOptions } = options;
    const res = await fetch(url, {
      ...fetchOptions,
      headers: {
        'apikey': this.session.supabaseAnonKey,
        'Authorization': `Bearer ${this.session.accessToken}`,
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      if (!allowRetry) throw new AuthExpiredError();
      this.session = await this.auth.getValidSession({ forceRefresh: true });
      return this.request(path, options, false);
    }
    return res;
  }

  // Number of local changes still waiting to be sent to the cloud
  getPendingCount() {
    let total = this.db.prepare(`SELECT COUNT(*) as c FROM sync_tombstones`).get().c;
    for (const t of SYNC_TABLES) {
      total += this.db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE sync_status = 'pending' OR sync_status IS NULL`).get().c;
    }
    return total;
  }

  // Execute full sync cycle (Pull remote -> Push deletions -> Push pending)
  async sync({ fullResync = false } = {}) {
    if (this.isSyncing) {
      return { status: 'syncing', message: 'Sincronização já em andamento.' };
    }

    const stored = this.auth.getSession();
    if (!stored || !stored.userId || !stored.accessToken) {
      return {
        status: 'local_only',
        message: 'Modo local (sem conta na nuvem configurada).',
        lastSyncAt: null,
      };
    }

    this.isSyncing = true;
    try {
      const connectivity = await this.checkConnectivity(stored.supabaseUrl, stored.supabaseAnonKey);
      if (connectivity === 'paused') {
        return {
          status: 'error',
          code: 'project_paused',
          message: PAUSED_MESSAGE,
          lastSyncAt: stored.lastSyncAt,
          pendingCount: this.getPendingCount(),
        };
      }
      if (connectivity !== 'online') {
        return {
          status: 'offline',
          message: 'Sem conexão com a nuvem no momento. Operando 100% offline.',
          lastSyncAt: stored.lastSyncAt,
          pendingCount: this.getPendingCount(),
        };
      }

      this.session = await this.auth.getValidSession();

      if (fullResync) {
        this.db.prepare(`DELETE FROM sync_metadata`).run();
      }

      const errors = [];
      let totalPulled = 0;
      let totalPushed = 0;
      let totalDeleted = 0;

      // 1. Pull first: remote data wins over untouched local defaults
      for (const table of SYNC_TABLES) {
        try {
          totalPulled += await this.pullTable(table);
        } catch (e) {
          if (isAuthExpired(e)) throw e;
          errors.push(`${table} (download): ${e.message}`);
        }
      }

      // 2. Replicate local deletions
      try {
        totalDeleted = await this.pushTombstones();
      } catch (e) {
        if (isAuthExpired(e)) throw e;
        errors.push(`exclusões: ${e.message}`);
      }

      // 3. Push pending local changes (parents before children)
      for (const table of SYNC_TABLES) {
        try {
          totalPushed += await this.pushTable(table);
        } catch (e) {
          if (isAuthExpired(e)) throw e;
          errors.push(`${table} (envio): ${e.message}`);
        }
      }

      // 4. Configurações e arquivos de extrato (recursos opcionais do Supabase)
      try {
        await this.syncSettings({ preferRemote: fullResync });
      } catch (e) {
        if (isAuthExpired(e)) throw e;
        errors.push(`configurações: ${e.message}`);
      }
      let files = { uploaded: 0, downloaded: 0 };
      try {
        files = await this.syncStatementFiles();
      } catch (e) {
        if (isAuthExpired(e)) throw e;
        errors.push(`arquivos de extrato: ${e.message}`);
      }

      const pendingCount = this.getPendingCount();
      const featuresMissing = this.getMissingFeatures();

      if (errors.length > 0) {
        console.warn('[CloudSyncEngine] Sync finished with errors:', errors);
        return {
          status: 'error',
          message: `Sincronização parcial. Falhas: ${errors.join(' | ')}`,
          errors,
          pushedCount: totalPushed,
          pulledCount: totalPulled,
          deletedCount: totalDeleted,
          pendingCount,
          featuresMissing,
          lastSyncAt: stored.lastSyncAt,
        };
      }

      const now = new Date().toISOString();
      this.auth.saveSession({ lastSyncAt: now });

      return {
        status: 'synced',
        message: 'Sincronização com a nuvem concluída com sucesso.',
        pushedCount: totalPushed,
        pulledCount: totalPulled,
        deletedCount: totalDeleted,
        filesUploaded: files.uploaded,
        filesDownloaded: files.downloaded,
        pendingCount,
        featuresMissing,
        lastSyncAt: now,
      };
    } catch (err) {
      if (isAuthExpired(err)) {
        return {
          status: 'auth_expired',
          message: err.message,
          lastSyncAt: stored.lastSyncAt,
          pendingCount: this.getPendingCount(),
        };
      }
      console.error('[CloudSyncEngine] Error during sync:', err);
      return {
        status: 'error',
        message: `Falha na sincronização: ${err.message || err}`,
        lastSyncAt: stored.lastSyncAt,
        pendingCount: this.getPendingCount(),
      };
    } finally {
      this.isSyncing = false;
    }
  }

  // Build a payload row with only the columns the remote table accepts
  toRemoteRow(tableName, row, pushTime) {
    const copy = { ...row };
    for (const col of LOCAL_ONLY_COLUMNS) delete copy[col];
    for (const col of this.unknownRemoteColumns[tableName] || []) delete copy[col];
    copy.user_id = this.session.userId;
    copy.updated_at = pushTime;
    return copy;
  }

  // Upsert a batch; strips columns the remote schema does not know and retries.
  // Returns the server-side updated_at of each row (set by the server trigger when installed).
  async upsertRemote(tableName, rows, pushTime) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const payload = rows.map(r => this.toRemoteRow(tableName, r, pushTime));
      const res = await this.request(tableName, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json().catch(() => []);
        return new Map((Array.isArray(saved) ? saved : []).map(r => [r.id, r.updated_at]));
      }

      const err = await describeHttpError(res);
      const missingCol = err.code === 'PGRST204' && /'([^']+)' column/.exec(err.message);
      if (missingCol) {
        if (!this.unknownRemoteColumns[tableName]) this.unknownRemoteColumns[tableName] = new Set();
        this.unknownRemoteColumns[tableName].add(missingCol[1]);
        console.warn(`[CloudSyncEngine] Column "${missingCol[1]}" missing on remote ${tableName}; sending without it.`);
        continue;
      }
      throw new Error(err.message);
    }
    throw new Error('Esquema remoto incompatível.');
  }

  // Push pending rows for a single table
  async pushTable(tableName) {
    const rows = this.db.prepare(`
      SELECT * FROM ${tableName}
      WHERE sync_status = 'pending' OR sync_status IS NULL
    `).all();

    if (rows.length === 0) return 0;

    let pushed = 0;
    for (let i = 0; i < rows.length; i += PUSH_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + PUSH_CHUNK_SIZE);
      // The push time becomes the row version, so other machines never miss
      // a change that was made offline long before it reached the cloud.
      const pushTime = new Date().toISOString();
      const serverTimes = await this.upsertRemote(tableName, chunk, pushTime);

      // Mark as synced unless the row was edited again while the request ran
      const markStmt = this.db.prepare(`
        UPDATE ${tableName}
        SET sync_status = 'synced', updated_at = ?, user_id = ?
        WHERE id = ? AND updated_at IS ?
      `);
      withSyncSuppressed(this.db, () => {
        this.db.transaction(() => {
          for (const r of chunk) {
            markStmt.run(serverTimes.get(r.id) || pushTime, this.session.userId, r.id, r.updated_at);
          }
        })();
      });
      pushed += chunk.length;
    }

    return pushed;
  }

  // Replicate local hard deletes as remote soft deletes
  async pushTombstones() {
    const tombstones = this.db.prepare(`SELECT table_name, row_id FROM sync_tombstones`).all();
    if (tombstones.length === 0) return 0;

    const byTable = new Map();
    for (const t of tombstones) {
      if (!byTable.has(t.table_name)) byTable.set(t.table_name, []);
      byTable.get(t.table_name).push(t.row_id);
    }

    let deleted = 0;
    const removeStmt = this.db.prepare(`DELETE FROM sync_tombstones WHERE table_name = ? AND row_id = ?`);

    for (const [tableName, ids] of byTable.entries()) {
      for (let i = 0; i < ids.length; i += TOMBSTONE_CHUNK_SIZE) {
        const chunk = ids.slice(i, i + TOMBSTONE_CHUNK_SIZE);
        const now = new Date().toISOString();
        const idList = chunk.map(id => `"${String(id).replace(/"/g, '')}"`).join(',');
        const res = await this.request(
          `${tableName}?id=in.(${encodeURIComponent(idList)})&user_id=eq.${this.session.userId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ deleted_at: now, updated_at: now }),
          }
        );
        if (!res.ok) {
          const err = await describeHttpError(res);
          throw new Error(err.message);
        }
        this.db.transaction(() => {
          for (const id of chunk) removeStmt.run(tableName, id);
        })();
        deleted += chunk.length;
      }
    }
    return deleted;
  }

  // Pull remote updates for a single table (paginated)
  async pullTable(tableName) {
    const meta = this.db.prepare(`SELECT last_synced_at FROM sync_metadata WHERE table_name = ?`).get(tableName);
    const watermark = meta ? meta.last_synced_at : null;
    const since = watermark ? new Date(toTime(watermark) - PULL_OVERLAP_MS).toISOString() : null;

    let offset = 0;
    let total = 0;
    let maxSeen = watermark;

    while (true) {
      let path = `${tableName}?select=*&user_id=eq.${this.session.userId}&order=updated_at.asc,id.asc&limit=${PULL_PAGE_SIZE}&offset=${offset}`;
      if (since) {
        path += `&updated_at=gt.${encodeURIComponent(since)}`;
      }

      const res = await this.request(path, { method: 'GET' });
      if (!res.ok) {
        const err = await describeHttpError(res);
        throw new Error(err.message);
      }

      const remoteRows = await res.json();
      if (!Array.isArray(remoteRows) || remoteRows.length === 0) break;

      this.applyRemoteRows(tableName, remoteRows);
      for (const r of remoteRows) {
        if (r.updated_at && toTime(r.updated_at) > toTime(maxSeen)) maxSeen = r.updated_at;
      }
      total += remoteRows.length;

      if (remoteRows.length < PULL_PAGE_SIZE) break;
      offset += PULL_PAGE_SIZE;
    }

    if (maxSeen && maxSeen !== watermark) {
      this.db.prepare(`
        INSERT INTO sync_metadata (table_name, last_synced_at)
        VALUES (?, ?)
        ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at
      `).run(tableName, maxSeen);
    }

    return total;
  }

  // Merge a batch of remote rows into SQLite (Last-Write-Wins)
  applyRemoteRows(tableName, remoteRows) {
    const selectLocal = this.db.prepare(`SELECT id, updated_at, sync_status FROM ${tableName} WHERE id = ?`);
    const selectTombstone = this.db.prepare(`SELECT 1 FROM sync_tombstones WHERE table_name = ? AND row_id = ?`);
    const deleteLocal = this.db.prepare(`DELETE FROM ${tableName} WHERE id = ?`);
    const deleteTombstone = this.db.prepare(`DELETE FROM sync_tombstones WHERE table_name = ? AND row_id = ?`);

    this.db.pragma('foreign_keys = OFF');
    try {
      withSyncSuppressed(this.db, () => {
        this.db.transaction(() => {
          for (const remote of remoteRows) {
            const local = selectLocal.get(remote.id);
            const localIsNewer = local
              && local.sync_status === 'pending'
              && toTime(local.updated_at) > toTime(remote.updated_at);

            if (remote.deleted_at) {
              if (local && !localIsNewer) deleteLocal.run(remote.id);
              deleteTombstone.run(tableName, remote.id);
              continue;
            }

            // Deleted here but not yet replicated: the pending deletion wins
            if (selectTombstone.get(tableName, remote.id)) continue;

            if (!local) {
              this.insertLocalRow(tableName, remote);
            } else if (!localIsNewer) {
              this.updateLocalRow(tableName, remote);
            }
          }
        })();
      });
    } finally {
      this.db.pragma('foreign_keys = ON');
    }
  }

  // Full Pull for fresh installations on another computer
  async fullPull() {
    const stored = this.auth.getSession();
    if (!stored || !stored.userId || !stored.accessToken) {
      throw new Error('Faça login com sua conta para restaurar os dados da nuvem.');
    }
    if (this.isSyncing) {
      throw new Error('Sincronização já em andamento. Aguarde alguns segundos e tente novamente.');
    }

    this.isSyncing = true;
    try {
      this.session = await this.auth.getValidSession();
      this.db.prepare(`DELETE FROM sync_metadata`).run();

      let totalRestored = 0;
      for (const table of SYNC_TABLES) {
        totalRestored += await this.pullTable(table);
      }
      try {
        await this.syncSettings({ preferRemote: true });
        await this.syncStatementFiles();
      } catch (e) {
        if (isAuthExpired(e)) throw e;
        console.warn('[CloudSyncEngine] Optional restore step failed:', e.message);
      }

      const now = new Date().toISOString();
      this.auth.saveSession({ lastSyncAt: now });

      return {
        success: true,
        totalRestored,
        timestamp: now,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  getMissingFeatures() {
    const missing = [];
    if (this.remoteFeatures.settings === false) missing.push('user_settings');
    if (this.remoteFeatures.storage === false) missing.push('statements_bucket');
    return missing;
  }

  // Configurações do usuário (Last-Write-Wins pelo updated_at da linha de settings)
  async syncSettings({ preferRemote = false } = {}) {
    if (this.remoteFeatures.settings === false) return 'unsupported';
    const local = this.db.prepare(`SELECT * FROM settings WHERE id = 'app_config'`).get();
    if (!local) return 'skipped';

    const res = await this.request(`user_settings?select=data,updated_at&user_id=eq.${this.session.userId}`, { method: 'GET' });
    if (!res.ok) {
      const err = await describeHttpError(res);
      if (res.status === 404 || err.code === 'PGRST205' || err.code === '42P01' || /user_settings/.test(err.message)) {
        this.remoteFeatures.settings = false;
        return 'unsupported';
      }
      throw new Error(err.message);
    }
    this.remoteFeatures.settings = true;

    const rows = await res.json();
    const remote = Array.isArray(rows) ? rows[0] : null;
    const localTime = toTime(local.updated_at);
    const remoteTime = remote ? toTime(remote.updated_at) : 0;

    if (remote && remote.data && (preferRemote || remoteTime > localTime)) {
      const cols = SYNCED_SETTINGS_COLUMNS.filter(c => Object.prototype.hasOwnProperty.call(remote.data, c) && c in local);
      if (cols.length > 0) {
        this.db.prepare(`
          UPDATE settings SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = 'app_config'
        `).run(...cols.map(c => remote.data[c]), remote.updated_at);
      }
      return 'pulled';
    }

    if (!remote || localTime > remoteTime) {
      const data = {};
      for (const c of SYNCED_SETTINGS_COLUMNS) {
        if (c in local) data[c] = local[c];
      }
      const up = await this.request('user_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: this.session.userId, data, updated_at: local.updated_at || new Date().toISOString() }),
      });
      if (!up.ok) {
        const err = await describeHttpError(up);
        throw new Error(err.message);
      }
      return 'pushed';
    }
    return 'unchanged';
  }

  // Arquivos originais dos extratos: envia os locais e baixa os que faltam neste computador
  async syncStatementFiles() {
    const result = { uploaded: 0, downloaded: 0 };
    if (!this.getStatementsFolder || this.remoteFeatures.storage === false) return result;

    const folder = this.getStatementsFolder();
    const statements = this.db.prepare(`SELECT id, file_name, saved_path FROM imported_statements`).all();
    const done = new Set(this.db.prepare(`SELECT statement_id FROM statement_files`).all().map(r => r.statement_id));
    const markDone = this.db.prepare(`INSERT OR REPLACE INTO statement_files (statement_id, uploaded_at) VALUES (?, ?)`);
    let transfers = 0;

    for (const stmt of statements) {
      if (transfers >= MAX_FILE_TRANSFERS_PER_SYNC) break;
      const fallbackPath = path.join(folder, stmt.file_name);
      const localPath = stmt.saved_path && fs.existsSync(stmt.saved_path)
        ? stmt.saved_path
        : (fs.existsSync(fallbackPath) ? fallbackPath : null);
      const objectPath = `${this.session.userId}/${encodeURIComponent(`${stmt.id}-${stmt.file_name}`)}`;

      if (localPath && !done.has(stmt.id)) {
        transfers++;
        const res = await this.request(`object/${STATEMENTS_BUCKET}/${objectPath}`, {
          base: 'storage/v1',
          method: 'POST',
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'x-upsert': 'true' },
          body: fs.readFileSync(localPath),
        });
        if (!res.ok) {
          const err = await describeHttpError(res);
          if (/bucket not found/i.test(err.message) || res.status === 404) {
            this.remoteFeatures.storage = false;
            return result;
          }
          throw new Error(err.message);
        }
        this.remoteFeatures.storage = true;
        markDone.run(stmt.id, new Date().toISOString());
        result.uploaded++;
      } else if (!localPath) {
        transfers++;
        const res = await this.request(`object/authenticated/${STATEMENTS_BUCKET}/${objectPath}`, {
          base: 'storage/v1',
          method: 'GET',
        });
        if (res.ok) {
          fs.writeFileSync(fallbackPath, Buffer.from(await res.arrayBuffer()));
          markDone.run(stmt.id, new Date().toISOString());
          this.remoteFeatures.storage = true;
          result.downloaded++;
        } else {
          const err = await describeHttpError(res);
          if (/bucket not found/i.test(err.message)) {
            this.remoteFeatures.storage = false;
            return result;
          }
          // Arquivo nunca enviado pelo outro computador: segue sem ele
        }
      }
    }
    return result;
  }

  // Cached local column validator
  getTableColumns(tableName) {
    if (!this._tableColumnsCache) this._tableColumnsCache = {};
    if (!this._tableColumnsCache[tableName]) {
      const cols = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
      this._tableColumnsCache[tableName] = new Set(cols.map(c => c.name));
    }
    return this._tableColumnsCache[tableName];
  }

  // Insert a remote row into local SQLite
  insertLocalRow(tableName, row) {
    const validCols = this.getTableColumns(tableName);
    const cleanRow = { sync_status: 'synced' };
    for (const [k, v] of Object.entries(row)) {
      if (validCols.has(k)) {
        cleanRow[k] = v;
      }
    }

    const keys = Object.keys(cleanRow);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => cleanRow[k]);

    try {
      withSyncSuppressed(this.db, () => {
        this.db.prepare(`
          INSERT OR REPLACE INTO ${tableName} (${keys.join(', ')})
          VALUES (${placeholders})
        `).run(...values);
      });
    } catch (e) {
      console.warn(`[CloudSyncEngine] Error inserting into ${tableName}:`, e.message);
    }
  }

  // Update a local row from remote
  updateLocalRow(tableName, row) {
    const validCols = this.getTableColumns(tableName);
    const id = row.id;
    const cleanRow = { sync_status: 'synced' };
    for (const [k, v] of Object.entries(row)) {
      if (k !== 'id' && validCols.has(k)) {
        cleanRow[k] = v;
      }
    }

    const keys = Object.keys(cleanRow);
    const assignments = keys.map(k => `${k} = ?`).join(', ');
    const values = [...keys.map(k => cleanRow[k]), id];

    try {
      withSyncSuppressed(this.db, () => {
        this.db.prepare(`
          UPDATE ${tableName} SET ${assignments} WHERE id = ?
        `).run(...values);
      });
    } catch (e) {
      console.warn(`[CloudSyncEngine] Error updating ${tableName}:`, e.message);
    }
  }
}

module.exports = {
  CloudSyncEngine,
  SYNC_TABLES,
};
