const crypto = require('crypto');

const VAULT_SECRET = crypto
  .createHash('sha256')
  .update('pigo-local-vault-key-v1-aes256')
  .digest();

function encryptSecret(plainText) {
  if (!plainText) return '';
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_SECRET, iv);
    const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  } catch {
    return Buffer.from(String(plainText), 'utf8').toString('base64');
  }
}

function decryptSecret(payload) {
  if (!payload) return '';
  try {
    if (String(payload).startsWith('v1:')) {
      const [, ivB64, tagB64, dataB64] = String(payload).split(':');
      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(tagB64, 'base64');
      const encrypted = Buffer.from(dataB64, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', VAULT_SECRET, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    }
    return Buffer.from(String(payload), 'base64').toString('utf8');
  } catch {
    return String(payload);
  }
}

class ToolsEngine {
  constructor(db) {
    this.db = db;
  }

  // =========================================================
  // 1. ANOTAÇÕES & SEGUNDO CÉREBRO (notes)
  // =========================================================
  getNotes() {
    const rows = this.db
      .prepare(`SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC`)
      .all();
    return rows.map((r) => {
      let checklist = [];
      try {
        checklist = r.checklist_json ? JSON.parse(r.checklist_json) : [];
      } catch {
        checklist = [];
      }
      return {
        id: r.id,
        title: r.title,
        content: r.content || '',
        category: r.category || 'ideias',
        color: r.color || '#a855f7',
        pinned: Boolean(r.pinned),
        checklist,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  createNote(data) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const checklistJson = JSON.stringify(Array.isArray(data.checklist) ? data.checklist : []);
    this.db
      .prepare(
        `INSERT INTO notes (id, title, content, category, color, pinned, checklist_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        (data.title || 'Nova Anotação').trim(),
        data.content || '',
        data.category || 'ideias',
        data.color || '#a855f7',
        data.pinned ? 1 : 0,
        checklistJson,
        now,
        now
      );
    return this.getNotes().find((n) => n.id === id);
  }

  updateNote(id, data) {
    const existing = this.db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id);
    if (!existing) throw new Error('Anotação não encontrada.');
    const now = new Date().toISOString();
    const checklistJson =
      data.checklist !== undefined
        ? JSON.stringify(Array.isArray(data.checklist) ? data.checklist : [])
        : existing.checklist_json;

    this.db
      .prepare(
        `UPDATE notes
         SET title = ?, content = ?, category = ?, color = ?, pinned = ?, checklist_json = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        data.title !== undefined ? data.title.trim() : existing.title,
        data.content !== undefined ? data.content : existing.content,
        data.category !== undefined ? data.category : existing.category,
        data.color !== undefined ? data.color : existing.color,
        data.pinned !== undefined ? (data.pinned ? 1 : 0) : existing.pinned,
        checklistJson,
        now,
        id
      );
    return this.getNotes().find((n) => n.id === id);
  }

  deleteNote(id) {
    this.db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
    return true;
  }

  // =========================================================
  // 2. MAPAS MENTAIS INTERATIVOS (mindmaps)
  // =========================================================
  getMindmaps() {
    const rows = this.db
      .prepare(`SELECT * FROM mindmaps ORDER BY updated_at DESC`)
      .all();
    return rows.map((r) => {
      let nodes = [];
      try {
        nodes = r.nodes_json ? JSON.parse(r.nodes_json) : [];
      } catch {
        nodes = [];
      }
      return {
        id: r.id,
        title: r.title,
        description: r.description || '',
        nodes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  createMindmap(data) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = (data.title || 'Novo Mapa Mental').trim();
    const defaultNodes =
      Array.isArray(data.nodes) && data.nodes.length > 0
        ? data.nodes
        : [
            {
              id: 'root',
              label: title,
              parentId: null,
              x: 420,
              y: 240,
              color: '#a855f7',
              notes: 'Ideia Central',
            },
            {
              id: 'branch_1',
              label: 'Objetivo 1',
              parentId: 'root',
              x: 160,
              y: 120,
              color: '#10b981',
              notes: '',
            },
            {
              id: 'branch_2',
              label: 'Objetivo 2',
              parentId: 'root',
              x: 680,
              y: 120,
              color: '#38bdf8',
              notes: '',
            },
            {
              id: 'branch_3',
              label: 'Próximos Passos',
              parentId: 'root',
              x: 420,
              y: 400,
              color: '#f59e0b',
              notes: '',
            },
          ];

    this.db
      .prepare(
        `INSERT INTO mindmaps (id, title, description, nodes_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, title, data.description || '', JSON.stringify(defaultNodes), now, now);
    return this.getMindmaps().find((m) => m.id === id);
  }

  updateMindmap(id, data) {
    const existing = this.db.prepare(`SELECT * FROM mindmaps WHERE id = ?`).get(id);
    if (!existing) throw new Error('Mapa mental não encontrado.');
    const now = new Date().toISOString();
    const nodesJson =
      data.nodes !== undefined ? JSON.stringify(data.nodes) : existing.nodes_json;

    this.db
      .prepare(
        `UPDATE mindmaps
         SET title = ?, description = ?, nodes_json = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        data.title !== undefined ? data.title.trim() : existing.title,
        data.description !== undefined ? data.description : existing.description,
        nodesJson,
        now,
        id
      );
    return this.getMindmaps().find((m) => m.id === id);
  }

  deleteMindmap(id) {
    this.db.prepare(`DELETE FROM mindmaps WHERE id = ?`).run(id);
    return true;
  }

  // =========================================================
  // 3. COFRE DE SENHAS CRIPTOGRAFADO (password_vault)
  // =========================================================
  getVaultItems() {
    const rows = this.db
      .prepare(`SELECT * FROM password_vault ORDER BY favorite DESC, title ASC`)
      .all();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category || 'outros',
      username: r.username || '',
      password: decryptSecret(r.password_encrypted),
      url: r.url || '',
      notes: r.notes || '',
      favorite: Boolean(r.favorite),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  createVaultItem(data) {
    if (!data.title || !data.title.trim()) {
      throw new Error('Informe o nome do serviço ou aplicativo.');
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const encryptedPass = encryptSecret(data.password || '');

    this.db
      .prepare(
        `INSERT INTO password_vault (id, title, category, username, password_encrypted, url, notes, favorite, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.title.trim(),
        data.category || 'outros',
        (data.username || '').trim(),
        encryptedPass,
        (data.url || '').trim(),
        data.notes || '',
        data.favorite ? 1 : 0,
        now,
        now
      );
    return this.getVaultItems().find((v) => v.id === id);
  }

  updateVaultItem(id, data) {
    const existing = this.db.prepare(`SELECT * FROM password_vault WHERE id = ?`).get(id);
    if (!existing) throw new Error('Credencial não encontrada.');
    const now = new Date().toISOString();
    const encryptedPass =
      data.password !== undefined
        ? encryptSecret(data.password)
        : existing.password_encrypted;

    this.db
      .prepare(
        `UPDATE password_vault
         SET title = ?, category = ?, username = ?, password_encrypted = ?, url = ?, notes = ?, favorite = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        data.title !== undefined ? data.title.trim() : existing.title,
        data.category !== undefined ? data.category : existing.category,
        data.username !== undefined ? data.username.trim() : existing.username,
        encryptedPass,
        data.url !== undefined ? data.url.trim() : existing.url,
        data.notes !== undefined ? data.notes : existing.notes,
        data.favorite !== undefined ? (data.favorite ? 1 : 0) : existing.favorite,
        now,
        id
      );
    return this.getVaultItems().find((v) => v.id === id);
  }

  deleteVaultItem(id) {
    this.db.prepare(`DELETE FROM password_vault WHERE id = ?`).run(id);
    return true;
  }
}

module.exports = { ToolsEngine };
