/**
 * Gamification Engine (Pigo RPG Financeiro) — 100% local
 *
 * O XP é DERIVADO dos dados financeiros (extratos, lançamentos, reserva, faturas),
 * que já sincronizam entre computadores. Assim todos os PCs chegam ao mesmo nível,
 * o histórico antigo pontua retroativamente e não existe XP duplicado.
 * Apenas o que é inerentemente local fica em tabelas próprias:
 * missões semanais geradas e o controle de "já comemorado".
 */

const XP = {
  statementImport: 50,
  categorizedTransaction: 2,
  positiveMonth: 200,
  reserveAporteBase: 50,
  reserveAporteMaxBonus: 250,
  budgetKept: 50,
  invoiceOnTime: 80,
  habitCheckin: 5,
  perfectHabitDay: 25,
};

const RARITY_XP = { comum: 15, raro: 35, epico: 75, lendario: 150 };

const LEVEL_TITLES = [
  { from: 1, title: 'Porquinho Curioso' },
  { from: 3, title: 'Poupador Aprendiz' },
  { from: 6, title: 'Guardião do Cofre' },
  { from: 10, title: 'Estrategista Financeiro' },
  { from: 15, title: 'Investidor Disciplinado' },
  { from: 20, title: 'Mestre das Finanças' },
  { from: 30, title: 'Lenda do Pigo' },
];

// --- Date helpers (local time, YYYY-MM-DD strings) ---
function parseDate(dateStr) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function addMonthsToKey(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthEnd(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return formatDate(new Date(y, m, 0));
}

// Semana começa na segunda-feira; a chave é a data dessa segunda
function weekStart(dateStr) {
  const d = parseDate(dateStr);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return formatDate(d);
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatBRL(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- Level curve: subir do nível n para n+1 custa 100 + 50·(n-1) XP ---
function xpToNext(level) {
  return 100 + 50 * (level - 1);
}

function levelFromXp(totalXp) {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level++;
  }
  return { level, xpIntoLevel: remaining, xpForNext: xpToNext(level) };
}

function titleForLevel(level) {
  let title = LEVEL_TITLES[0].title;
  for (const t of LEVEL_TITLES) {
    if (level >= t.from) title = t.title;
  }
  return title;
}

function longestRun(sortedKeys, nextKey) {
  let best = 0;
  let current = 0;
  let prev = null;
  for (const key of sortedKeys) {
    current = prev && nextKey(prev) === key ? current + 1 : 1;
    best = Math.max(best, current);
    prev = key;
  }
  return best;
}

class GamificationEngine {
  constructor(db, intelligence) {
    this.db = db;
    this.intelligence = intelligence;
    this.ensureTables();
  }

  ensureTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_weekly_missions (
        week_key TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        definition TEXT NOT NULL,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (week_key, mission_id)
      );
      CREATE TABLE IF NOT EXISTS game_seen (
        key TEXT PRIMARY KEY,
        seen_at TEXT NOT NULL
      );
    `);
  }

  today() {
    return new Date().toISOString().slice(0, 10);
  }

  // ==========================================
  // Fatos derivados dos dados financeiros
  // ==========================================
  collectFacts() {
    const today = this.today();
    const currentMonth = today.slice(0, 7);

    const statements = this.db.prepare(`
      SELECT id, original_name, imported_at FROM imported_statements ORDER BY imported_at ASC
    `).all();

    const categorizedByMonth = this.db.prepare(`
      SELECT strftime('%Y-%m', transaction_date) as month_key, COUNT(*) as c
      FROM transactions
      WHERE category_id IS NOT NULL AND type IN ('income', 'expense') AND status != 'cancelled'
      GROUP BY month_key
      ORDER BY month_key ASC
    `).all();

    const totals = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN category_id IS NULL AND type IN ('income', 'expense') AND status != 'cancelled' THEN 1 ELSE 0 END) as uncategorized,
        MIN(transaction_date) as first_date,
        MAX(transaction_date) as last_date
      FROM transactions
    `).get();

    // Movimentos da reserva (aportes)
    let reserveMovements = [];
    let reserveStatus = null;
    try {
      reserveMovements = this.intelligence.getReserveMovements().filter(m => m.countsInBalance || m.source === 'transfer');
      reserveStatus = this.intelligence.getReserveStatus(currentMonth, 0, 1);
    } catch (e) {
      reserveMovements = [];
    }

    // Meses fechados no azul (resultado do dia a dia, sem contar aportes/resgates)
    const positiveMonths = [];
    if (totals.first_date) {
      let key = totals.first_date.slice(0, 7);
      while (key < currentMonth) {
        const income = this.intelligence.getMonthIncomeTotal(key).total;
        const expense = this.intelligence.getMonthExpenseTotal(key).total;
        const inMonth = reserveMovements.filter(m => m.date.slice(0, 7) === key && m.source !== 'transfer');
        const aportes = inMonth.filter(m => m.kind === 'aporte').reduce((s, m) => s + Math.abs(m.amount), 0);
        const resgates = inMonth.filter(m => m.kind === 'resgate').reduce((s, m) => s + Math.abs(m.amount), 0);
        const result = income - resgates - (expense - aportes);
        if (income > 0 && result >= 0) positiveMonths.push({ monthKey: key, result });
        key = addMonthsToKey(key, 1);
      }
    }

    // Tetos de orçamento cumpridos em meses fechados
    const budgetsKept = [];
    const budgets = this.db.prepare(`
      SELECT b.id, b.category_id, b.amount_limit, b.created_at, c.name as category_name
      FROM category_budgets b LEFT JOIN categories c ON c.id = b.category_id
    `).all();
    for (const b of budgets) {
      let key = (b.created_at || today).slice(0, 7);
      while (key < currentMonth) {
        const spent = this.db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total FROM transactions
          WHERE category_id = ? AND type = 'expense' AND status != 'cancelled'
            AND (
              (credit_card_id IS NULL AND transaction_date >= ? AND transaction_date <= ?)
              OR (credit_card_id IS NOT NULL AND invoice_month = ?)
            )
        `).get(b.category_id, `${key}-01`, `${key}-31`, key).total;
        const hadActivity = this.db.prepare(`
          SELECT 1 FROM transactions WHERE transaction_date >= ? AND transaction_date <= ? LIMIT 1
        `).get(`${key}-01`, `${key}-31`);
        if (hadActivity && spent <= b.amount_limit) {
          budgetsKept.push({ budgetId: b.id, monthKey: key, categoryName: b.category_name || 'Categoria' });
        }
        key = addMonthsToKey(key, 1);
      }
    }

    // Faturas pagas até o vencimento
    const invoicesOnTime = this.db.prepare(`
      SELECT t.id, t.transaction_date, t.invoice_month, c.due_day, c.name as card_name
      FROM transactions t
      JOIN credit_cards c ON c.id = t.credit_card_id
      WHERE t.type = 'card_payment' AND t.status = 'completed' AND t.invoice_month IS NOT NULL
    `).all().filter(p => {
      const [y, m] = p.invoice_month.split('-').map(Number);
      const maxDay = new Date(y, m, 0).getDate();
      const due = `${p.invoice_month}-${String(Math.min(p.due_day, maxDay)).padStart(2, '0')}`;
      return p.transaction_date <= due;
    });

    let recurringCount = 0;
    try {
      recurringCount = this.intelligence.detectRecurringPatterns('expense').length;
    } catch (e) {
      recurringCount = 0;
    }

    // Hábitos
    let habitCheckins = 0;
    let habitBestStreak = 0;
    let activeHabitsCount = 0;
    let habitCheckinsByDay = [];
    try {
      const checkinRow = this.db.prepare(`SELECT COUNT(*) as c FROM habit_logs WHERE completed = 1`).get();
      habitCheckins = checkinRow ? checkinRow.c : 0;

      const habitsRow = this.db.prepare(`SELECT COUNT(*) as c FROM habits WHERE archived = 0`).get();
      activeHabitsCount = habitsRow ? habitsRow.c : 0;

      habitCheckinsByDay = this.db.prepare(`
        SELECT date, COUNT(*) as c
        FROM habit_logs
        WHERE completed = 1
        GROUP BY date
        ORDER BY date ASC
      `).all();

      const habitDates = habitCheckinsByDay.map(r => r.date);
      let curStreak = 0;
      let maxStreak = 0;
      let prevDate = null;
      for (const d of habitDates) {
        if (!prevDate) {
          curStreak = 1;
        } else {
          const p = parseDate(prevDate);
          p.setDate(p.getDate() + 1);
          if (formatDate(p) === d) {
            curStreak++;
          } else {
            curStreak = 1;
          }
        }
        if (curStreak > maxStreak) maxStreak = curStreak;
        prevDate = d;
      }
      habitBestStreak = maxStreak;
    } catch (e) {
      habitCheckins = 0;
      habitBestStreak = 0;
      activeHabitsCount = 0;
      habitCheckinsByDay = [];
    }

    // Metas
    let goalsCount = 0;
    let goalsCompleted = 0;
    try {
      const gRows = this.db.prepare(`SELECT target_amount, current_amount FROM goals`).all();
      goalsCount = gRows.length;
      goalsCompleted = gRows.filter(g => g.current_amount >= g.target_amount && g.target_amount > 0).length;
    } catch (e) {
      goalsCount = 0;
      goalsCompleted = 0;
    }

    // Ferramentas (Anotações, Mapas Mentais e Cofre de Senhas) + Contas
    let notesCount = 0;
    let pinnedNotesCount = 0;
    let mindmapsCount = 0;
    let maxMindmapNodes = 0;
    let vaultItemsCount = 0;
    let accountsCount = 0;
    try {
      const nRows = this.db.prepare(`SELECT pinned FROM notes`).all();
      notesCount = nRows.length;
      pinnedNotesCount = nRows.filter(n => n.pinned).length;
    } catch (e) {}
    try {
      const mRows = this.db.prepare(`SELECT nodes_json FROM mindmaps`).all();
      mindmapsCount = mRows.length;
      for (const m of mRows) {
        try {
          const parsed = JSON.parse(m.nodes_json || '[]');
          if (Array.isArray(parsed) && parsed.length > maxMindmapNodes) {
            maxMindmapNodes = parsed.length;
          }
        } catch {}
      }
    } catch (e) {}
    try {
      const vRow = this.db.prepare(`SELECT COUNT(*) as c FROM password_vault`).get();
      vaultItemsCount = vRow ? vRow.c : 0;
    } catch (e) {}
    try {
      const aRow = this.db.prepare(`SELECT COUNT(*) as c FROM accounts WHERE archived = 0`).get();
      accountsCount = aRow ? aRow.c : 0;
    } catch (e) {}

    const perfectHabitDaysCount =
      activeHabitsCount > 0
        ? (habitCheckinsByDay || []).filter(d => d.c >= activeHabitsCount).length
        : 0;

    const pillarsActiveCount =
      (accountsCount > 0 || (totals.total || 0) > 0 ? 1 : 0) +
      (activeHabitsCount > 0 ? 1 : 0) +
      (notesCount > 0 || mindmapsCount > 0 ? 1 : 0) +
      (vaultItemsCount > 0 ? 1 : 0);


    return {
      today,
      currentMonth,
      statements,
      categorizedByMonth,
      categorizedCount: categorizedByMonth.reduce((s, r) => s + r.c, 0),
      transactionCount: totals.total || 0,
      uncategorizedCount: totals.uncategorized || 0,
      lastTransactionDate: totals.last_date,
      firstTransactionDate: totals.first_date,
      reserveAportes: reserveMovements.filter(m => m.kind === 'aporte'),
      reserveStatus,
      positiveMonths,
      budgetsKept,
      invoicesOnTime,
      recurringCount,
      habitCheckins,
      habitBestStreak,
      activeHabitsCount,
      habitCheckinsByDay,
      goalsCount,
      goalsCompleted,
      notesCount,
      pinnedNotesCount,
      mindmapsCount,
      maxMindmapNodes,
      vaultItemsCount,
      accountsCount,
      perfectHabitDaysCount,
      pillarsActiveCount,
    };
  }

  // ==========================================
  // Sequências
  // ==========================================
  computeStreaks(facts) {
    const thisWeek = weekStart(facts.today);
    const lastWeek = addDays(thisWeek, -7);
    const importWeeks = [...new Set(facts.statements.map(s => weekStart(s.imported_at.slice(0, 10))))].sort();
    const weekSet = new Set(importWeeks);

    let importCurrent = 0;
    let cursor = weekSet.has(thisWeek) ? thisWeek : lastWeek;
    while (weekSet.has(cursor)) {
      importCurrent++;
      cursor = addDays(cursor, -7);
    }

    const positiveKeys = facts.positiveMonths.map(m => m.monthKey).sort();
    const positiveSet = new Set(positiveKeys);
    let positiveCurrent = 0;
    let monthCursor = addMonthsToKey(facts.currentMonth, -1);
    while (positiveSet.has(monthCursor)) {
      positiveCurrent++;
      monthCursor = addMonthsToKey(monthCursor, -1);
    }

    return {
      importWeeks: {
        current: importCurrent,
        best: Math.max(importCurrent, longestRun(importWeeks, k => addDays(k, 7))),
        atRisk: importCurrent > 0 && !weekSet.has(thisWeek),
      },
      positiveMonths: {
        current: positiveCurrent,
        best: Math.max(positiveCurrent, longestRun(positiveKeys, k => addMonthsToKey(k, 1))),
        atRisk: false,
      },
    };
  }

  // ==========================================
  // Missões semanais
  // ==========================================
  generateMissions(weekKey, facts) {
    const missions = [];
    const before = weekKey;
    const windowStart = addDays(weekKey, -56);

    // 1. Teto de gasto na categoria variável que mais pesa nas últimas 8 semanas
    const reserveCategoryIds = new Set((facts.reserveStatus?.categories || []).filter(c => c.isReserve).map(c => c.id));
    const candidates = this.db.prepare(`
      SELECT t.category_id as id, c.name, SUM(t.amount) as total
      FROM transactions t JOIN categories c ON c.id = t.category_id
      WHERE t.type = 'expense' AND t.status != 'cancelled'
        AND t.transaction_date >= ? AND t.transaction_date < ?
      GROUP BY t.category_id
      ORDER BY total DESC
    `).all(windowStart, before).filter(c => !reserveCategoryIds.has(c.id));
    const weeksWithData = Math.max(1, Math.min(8, Math.ceil(
      (parseDate(before) - parseDate(facts.firstTransactionDate && facts.firstTransactionDate > windowStart ? facts.firstTransactionDate : windowStart)) / (7 * 86400000)
    )));
    const top = candidates.find(c => c.total / weeksWithData >= 3000);
    if (top) {
      const avgWeekly = top.total / weeksWithData;
      const target = Math.max(1000, Math.round((avgWeekly * 0.9) / 500) * 500);
      missions.push({
        id: 'spend_cap',
        title: `Gaste até ${formatBRL(target)} com ${top.name}`,
        description: `10% abaixo da sua média semanal (${formatBRL(Math.round(avgWeekly))}).`,
        xp: 150,
        categoryId: top.id,
        target,
      });
    }

    // 2. Organização: zerar lançamentos sem categoria ou importar extrato
    if (facts.uncategorizedCount > 0) {
      missions.push({
        id: 'categorize_all',
        title: 'Zere os lançamentos sem categoria',
        description: `${facts.uncategorizedCount} aguardando categoria. Cada um ensina a inteligência do Pigo.`,
        xp: 100,
        target: 0,
      });
    } else {
      missions.push({
        id: 'import_statement',
        title: 'Importe um extrato nesta semana',
        description: 'Manter os dados em dia deixa previsões e missões mais precisas.',
        xp: 100,
        target: 1,
      });
    }

    // 3. Reserva ou dias sem gastos
    if (facts.reserveStatus && facts.reserveStatus.status !== 'complete') {
      missions.push({
        id: 'reserve_aporte',
        title: 'Faça um aporte na reserva',
        description: facts.reserveStatus.suggestedContribution > 0
          ? `Sugestão do fechamento: ${formatBRL(facts.reserveStatus.suggestedContribution)}.`
          : 'Qualquer valor conta: o importante é o hábito.',
        xp: 150,
        target: 1,
      });
    } else {
      missions.push({
        id: 'zero_spend_days',
        title: 'Tenha 2 dias sem nenhum gasto',
        description: 'Dias "no-spend" ajudam a quebrar o consumo automático.',
        xp: 120,
        target: 2,
      });
    }

    return missions;
  }

  getWeeklyMissions(weekKey, facts, { create = true } = {}) {
    const rows = this.db.prepare(`SELECT * FROM game_weekly_missions WHERE week_key = ?`).all(weekKey);
    if (rows.length > 0 || !create) {
      return rows
        .map(r => ({ ...JSON.parse(r.definition), completedAt: r.completed_at }))
        .sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
    }
    const generated = this.generateMissions(weekKey, facts).map((m, position) => ({ ...m, position }));
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO game_weekly_missions (week_key, mission_id, definition, created_at) VALUES (?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const m of generated) insert.run(weekKey, m.id, JSON.stringify(m), now);
    return generated.map(m => ({ ...m, completedAt: null }));
  }

  // Avalia o progresso de uma missão; persiste a conclusão quando acontece
  evaluateMission(weekKey, mission, facts) {
    const weekEnd = addDays(weekKey, 6);
    const weekOver = facts.today > weekEnd;
    const dataCoversWeek = Boolean(facts.lastTransactionDate && facts.lastTransactionDate >= weekEnd);
    let progress = 0;
    let status = 'in_progress';
    let progressLabel = '';

    if (mission.completedAt) {
      return { ...mission, weekKey, status: 'completed', progress: 100, progressLabel: 'Concluída' };
    }

    if (mission.id === 'spend_cap') {
      const spent = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE category_id = ? AND type = 'expense' AND status != 'cancelled'
          AND transaction_date >= ? AND transaction_date <= ?
      `).get(mission.categoryId, weekKey, weekEnd).total;
      progress = Math.min(100, Math.round((spent / mission.target) * 100));
      progressLabel = `${formatBRL(spent)} de ${formatBRL(mission.target)}`;
      if (spent > mission.target) status = 'failed';
      else if (weekOver && dataCoversWeek) status = 'completed';
      else if (weekOver) status = 'awaiting_data';
    } else if (mission.id === 'categorize_all') {
      progressLabel = `${facts.uncategorizedCount} sem categoria`;
      if (facts.uncategorizedCount === 0 && !weekOver) status = 'completed';
      else if (weekOver) status = 'failed';
      progress = facts.uncategorizedCount === 0 ? 100 : 0;
    } else if (mission.id === 'import_statement') {
      const count = facts.statements.filter(s => {
        const d = s.imported_at.slice(0, 10);
        return d >= weekKey && d <= weekEnd;
      }).length;
      progress = Math.min(100, count * 100);
      progressLabel = `${count} de 1 extrato`;
      status = count >= 1 ? 'completed' : weekOver ? 'failed' : 'in_progress';
    } else if (mission.id === 'reserve_aporte') {
      const count = facts.reserveAportes.filter(m => m.date >= weekKey && m.date <= weekEnd).length;
      progress = Math.min(100, count * 100);
      progressLabel = `${count} de 1 aporte`;
      if (count >= 1) status = 'completed';
      else if (weekOver && dataCoversWeek) status = 'failed';
      else if (weekOver) status = 'awaiting_data';
    } else if (mission.id === 'zero_spend_days') {
      const spendDays = new Set(this.db.prepare(`
        SELECT DISTINCT transaction_date as d FROM transactions
        WHERE type = 'expense' AND status != 'cancelled' AND transaction_date >= ? AND transaction_date <= ?
      `).all(weekKey, weekEnd).map(r => r.d));
      const elapsed = weekOver ? 7 : Math.max(0, Math.round((parseDate(facts.today) - parseDate(weekKey)) / 86400000));
      const zeroDays = Math.max(0, elapsed - spendDays.size);
      progress = Math.min(100, Math.round((zeroDays / mission.target) * 100));
      progressLabel = `${Math.min(zeroDays, mission.target)} de ${mission.target} dias`;
      if (weekOver && dataCoversWeek) status = zeroDays >= mission.target ? 'completed' : 'failed';
      else if (weekOver) status = 'awaiting_data';
    }

    if (status === 'completed') {
      const completedAt = weekOver ? weekEnd : facts.today;
      this.db.prepare(`
        UPDATE game_weekly_missions SET completed_at = ? WHERE week_key = ? AND mission_id = ? AND completed_at IS NULL
      `).run(completedAt, weekKey, mission.id);
      return { ...mission, weekKey, completedAt, status, progress: 100, progressLabel };
    }
    return { ...mission, weekKey, status, progress, progressLabel };
  }

  // Missões de semanas anteriores ainda em aberto são reavaliadas (ex.: extrato chegou depois)
  evaluateAllMissions(facts) {
    const currentWeek = weekStart(facts.today);
    const current = this.getWeeklyMissions(currentWeek, facts).map(m => this.evaluateMission(currentWeek, m, facts));
    const pastWeeks = this.db.prepare(`
      SELECT DISTINCT week_key FROM game_weekly_missions WHERE week_key < ? ORDER BY week_key DESC
    `).all(currentWeek).map(r => r.week_key);
    const past = [];
    for (const wk of pastWeeks) {
      for (const m of this.getWeeklyMissions(wk, facts, { create: false })) {
        past.push(this.evaluateMission(wk, m, facts));
      }
    }
    return { current, past, weekEnd: addDays(currentWeek, 6) };
  }

  // ==========================================
  // Conquistas
  // ==========================================
    getAchievementDefinitions() {
    return [
      // --- 1. Extratos e Importações ---
      { id: 'primeiro_extrato', name: 'Primeiro Extrato', description: 'Importe seu primeiro extrato OFX/CSV.', rarity: 'comum', icon: 'FileUp', category: 'imports', metric: 'statements', target: 1 },
      { id: 'extratos_3', name: 'Iniciando a Jornada', description: 'Importe 3 extratos bancários.', rarity: 'comum', icon: 'FileUp', category: 'imports', metric: 'statements', target: 3 },
      { id: 'extratos_5', name: 'Colecionador de Extratos', description: 'Importe 5 extratos bancários.', rarity: 'comum', icon: 'FolderArchive', category: 'imports', metric: 'statements', target: 5 },
      { id: 'extratos_10', name: 'Arquivista', description: 'Importe 10 extratos.', rarity: 'raro', icon: 'FolderArchive', category: 'imports', metric: 'statements', target: 10 },
      { id: 'extratos_25', name: 'Historiador Financeiro', description: 'Importe 25 extratos.', rarity: 'raro', icon: 'Library', category: 'imports', metric: 'statements', target: 25 },
      { id: 'extratos_50', name: 'Guardião do Histórico', description: 'Importe 50 extratos.', rarity: 'epico', icon: 'Library', category: 'imports', metric: 'statements', target: 50 },
      { id: 'extratos_100', name: 'Biblioteca Central', description: 'Importe 100 extratos.', rarity: 'lendario', icon: 'Library', category: 'imports', metric: 'statements', target: 100 },
      { id: 'semanas_2', name: 'Ritmo Semanal', description: '2 semanas seguidas importando extratos.', rarity: 'comum', icon: 'CalendarCheck', category: 'imports', metric: 'importStreak', target: 2 },
      { id: 'semanas_4', name: 'Disciplina de Ferro', description: '4 semanas seguidas importando extratos.', rarity: 'raro', icon: 'CalendarCheck', category: 'imports', metric: 'importStreak', target: 4 },
      { id: 'semanas_8', name: 'Hábito Inquebrável', description: '8 semanas seguidas importando extratos.', rarity: 'raro', icon: 'CalendarCheck', category: 'imports', metric: 'importStreak', target: 8 },
      { id: 'semanas_12', name: 'Relógio Suíço', description: '12 semanas seguidas importando extratos.', rarity: 'epico', icon: 'CalendarCheck', category: 'imports', metric: 'importStreak', target: 12 },
      { id: 'semanas_24', name: 'Pontualidade Suprema', description: '24 semanas seguidas com importações ativas.', rarity: 'lendario', icon: 'Crown', category: 'imports', metric: 'importStreak', target: 24 },

      // --- 2. Categorização e Caixa Zero ---
      { id: 'categorizador_10', name: 'Primeiros Lançamentos', description: 'Tenha 10 lançamentos categorizados.', rarity: 'comum', icon: 'Tags', category: 'categorization', metric: 'categorized', target: 10 },
      { id: 'categorizador_50', name: 'Aprendiz da Classificação', description: 'Tenha 50 lançamentos categorizados.', rarity: 'comum', icon: 'Tags', category: 'categorization', metric: 'categorized', target: 50 },
      { id: 'categorizador_100', name: 'Organizador', description: 'Tenha 100 lançamentos categorizados.', rarity: 'comum', icon: 'Tags', category: 'categorization', metric: 'categorized', target: 100 },
      { id: 'categorizador_250', name: 'Mestre da Ordem', description: 'Tenha 250 lançamentos categorizados.', rarity: 'raro', icon: 'Tags', category: 'categorization', metric: 'categorized', target: 250 },
      { id: 'categorizador_500', name: 'Taxonomista', description: 'Tenha 500 lançamentos categorizados.', rarity: 'raro', icon: 'Tags', category: 'categorization', metric: 'categorized', target: 500 },
      { id: 'categorizador_1000', name: 'Big Data Pessoal', description: '1.000 lançamentos categorizados.', rarity: 'epico', icon: 'GraduationCap', category: 'categorization', metric: 'categorized', target: 1000 },
      { id: 'categorizador_2000', name: 'Professor do Pigo', description: '2.000 lançamentos categorizados treinando o app.', rarity: 'epico', icon: 'GraduationCap', category: 'categorization', metric: 'categorized', target: 2000 },
      { id: 'categorizador_5000', name: 'Oráculo das Contas', description: '5.000 lançamentos categorizados com maestria.', rarity: 'lendario', icon: 'Crown', category: 'categorization', metric: 'categorized', target: 5000 },
      { id: 'caixa_zero_20', name: 'Mesa Organizada', description: 'Nenhum lançamento sem categoria (com pelo menos 20 transações).', rarity: 'comum', icon: 'Inbox', category: 'categorization', metric: 'inboxZero20', target: 1 },
      { id: 'caixa_zero', name: 'Caixa de Entrada Zero', description: 'Nenhum lançamento sem categoria (com pelo menos 50 lançamentos).', rarity: 'raro', icon: 'Inbox', category: 'categorization', metric: 'inboxZero', target: 1 },
      { id: 'caixa_zero_100', name: 'Perfeccionismo Total', description: 'Nenhum lançamento sem categoria (com pelo menos 100 transações).', rarity: 'epico', icon: 'Inbox', category: 'categorization', metric: 'inboxZero100', target: 1 },
      { id: 'caixa_zero_250', name: 'Mestre da Limpeza', description: 'Nenhum lançamento sem categoria (com pelo menos 250 transações).', rarity: 'lendario', icon: 'Crown', category: 'categorization', metric: 'inboxZero250', target: 1 },

      // --- 3. Meses no Azul & Saúde Financeira ---
      { id: 'mes_azul', name: 'No Azul', description: 'Feche um mês com resultado positivo.', rarity: 'comum', icon: 'TrendingUp', category: 'positive_months', metric: 'positiveMonths', target: 1 },
      { id: 'azul_2', name: 'Caminho Seguro', description: '2 meses seguidos no azul.', rarity: 'comum', icon: 'TrendingUp', category: 'positive_months', metric: 'positiveStreak', target: 2 },
      { id: 'azul_3', name: 'Trimestre Azul', description: '3 meses seguidos no azul.', rarity: 'raro', icon: 'Flame', category: 'positive_months', metric: 'positiveStreak', target: 3 },
      { id: 'azul_6', name: 'Semestre Impecável', description: '6 meses seguidos no azul.', rarity: 'epico', icon: 'Flame', category: 'positive_months', metric: 'positiveStreak', target: 6 },
      { id: 'azul_9', name: 'Nove Meses Invictos', description: '9 meses seguidos no azul.', rarity: 'epico', icon: 'Flame', category: 'positive_months', metric: 'positiveStreak', target: 9 },
      { id: 'azul_12', name: 'Ano de Ouro', description: '12 meses seguidos no azul.', rarity: 'lendario', icon: 'Crown', category: 'positive_months', metric: 'positiveStreak', target: 12 },
      { id: 'azul_18', name: 'Lenda da Consistência', description: '18 meses seguidos no azul.', rarity: 'lendario', icon: 'Crown', category: 'positive_months', metric: 'positiveStreak', target: 18 },
      { id: 'total_meses_azul_3', name: 'Três Vitórias', description: 'Acumule 3 meses no azul no histórico.', rarity: 'comum', icon: 'TrendingUp', category: 'positive_months', metric: 'positiveMonths', target: 3 },
      { id: 'total_meses_azul_6', name: 'Meio Ano Vitorioso', description: 'Acumule 6 meses no azul no histórico.', rarity: 'raro', icon: 'TrendingUp', category: 'positive_months', metric: 'positiveMonths', target: 6 },
      { id: 'total_meses_azul_12', name: 'Doze Meses Positivos', description: 'Acumule 12 meses no azul no histórico.', rarity: 'epico', icon: 'Trophy', category: 'positive_months', metric: 'positiveMonths', target: 12 },
      { id: 'total_meses_azul_24', name: 'Dois Anos de Sucesso', description: 'Acumule 24 meses no azul no histórico.', rarity: 'lendario', icon: 'Trophy', category: 'positive_months', metric: 'positiveMonths', target: 24 },

      // --- 4. Reserva de Emergência ---
      { id: 'primeira_reserva', name: 'Primeiro Tijolo', description: 'Faça seu primeiro aporte na reserva.', rarity: 'comum', icon: 'PiggyBank', category: 'reserve', metric: 'reserveAportes', target: 1 },
      { id: 'aportes_3', name: 'Hábito de Guardar', description: 'Faça 3 aportes na reserva de emergência.', rarity: 'comum', icon: 'PiggyBank', category: 'reserve', metric: 'reserveAportes', target: 3 },
      { id: 'aportes_6', name: 'Poupança Ativa', description: 'Faça 6 aportes na reserva de emergência.', rarity: 'raro', icon: 'PiggyBank', category: 'reserve', metric: 'reserveAportes', target: 6 },
      { id: 'aportes_12', name: 'Aportador Constante', description: 'Faça 12 aportes na reserva de emergência.', rarity: 'raro', icon: 'PiggyBank', category: 'reserve', metric: 'reserveAportes', target: 12 },
      { id: 'aportes_24', name: 'Muralha de Aportes', description: 'Faça 24 aportes na reserva de emergência.', rarity: 'epico', icon: 'PiggyBank', category: 'reserve', metric: 'reserveAportes', target: 24 },
      { id: 'reserva_meio_mes', name: 'Primeiro Fôlego', description: 'Reserva cobrindo metade (0.5) de um mês de custo de vida.', rarity: 'comum', icon: 'Shield', category: 'reserve', metric: 'reserveCoverage', target: 0.5 },
      { id: 'reserva_1', name: 'Um Mês de Paz', description: 'Reserva cobrindo 1 mês de custo de vida.', rarity: 'raro', icon: 'Shield', category: 'reserve', metric: 'reserveCoverage', target: 1 },
      { id: 'reserva_2', name: 'Duplo Escudo', description: 'Reserva cobrindo 2 meses de custo de vida.', rarity: 'raro', icon: 'ShieldCheck', category: 'reserve', metric: 'reserveCoverage', target: 2 },
      { id: 'reserva_3', name: 'Colchão Seguro', description: 'Reserva cobrindo 3 meses de custo de vida.', rarity: 'epico', icon: 'ShieldCheck', category: 'reserve', metric: 'reserveCoverage', target: 3 },
      { id: 'reserva_6', name: 'Escudo Blindado', description: 'Reserva cobrindo 6 meses de custo de vida.', rarity: 'epico', icon: 'Castle', category: 'reserve', metric: 'reserveCoverage', target: 6 },
      { id: 'reserva_completa', name: 'Fortaleza', description: 'Atinja a meta completa estabelecida para sua reserva.', rarity: 'lendario', icon: 'Castle', category: 'reserve', metric: 'reserveComplete', target: 1 },

      // --- 5. Faturas de Cartão de Crédito ---
      { id: 'fatura_1', name: 'Primeira Fatura Paga', description: 'Pague sua primeira fatura de cartão em dia.', rarity: 'comum', icon: 'CreditCard', category: 'invoices', metric: 'invoicesOnTime', target: 1 },
      { id: 'fatura_3', name: 'Pagador Pontual', description: 'Pague 3 faturas de cartão até o vencimento.', rarity: 'comum', icon: 'CreditCard', category: 'invoices', metric: 'invoicesOnTime', target: 3 },
      { id: 'fatura_6', name: 'Cartão Sob Controle', description: 'Pague 6 faturas de cartão até o vencimento.', rarity: 'raro', icon: 'CreditCard', category: 'invoices', metric: 'invoicesOnTime', target: 6 },
      { id: 'fatura_12', name: 'Crédito de Ouro', description: 'Pague 12 faturas até o vencimento.', rarity: 'epico', icon: 'CreditCard', category: 'invoices', metric: 'invoicesOnTime', target: 12 },
      { id: 'fatura_18', name: 'Mestre dos Vencimentos', description: 'Pague 18 faturas até o vencimento.', rarity: 'epico', icon: 'CreditCard', category: 'invoices', metric: 'invoicesOnTime', target: 18 },
      { id: 'fatura_24', name: 'Score Perfeito', description: 'Pague 24 faturas até o vencimento.', rarity: 'lendario', icon: 'Crown', category: 'invoices', metric: 'invoicesOnTime', target: 24 },

      // --- 6. Tetos de Orçamento ---
      { id: 'orcamento_1', name: 'Primeiro Teto Cumprido', description: 'Cumpra seu primeiro teto de orçamento mensal.', rarity: 'comum', icon: 'Target', category: 'budgets', metric: 'budgetsKept', target: 1 },
      { id: 'orcamento_3', name: 'Disciplina Orçamentária', description: 'Cumpra 3 tetos de orçamento mensais.', rarity: 'comum', icon: 'Target', category: 'budgets', metric: 'budgetsKept', target: 3 },
      { id: 'orcamento_5', name: 'Dentro do Teto', description: 'Cumpra 5 tetos de orçamento mensais.', rarity: 'raro', icon: 'Target', category: 'budgets', metric: 'budgetsKept', target: 5 },
      { id: 'orcamento_10', name: 'Mestre do Orçamento', description: 'Cumpra 10 tetos de orçamento mensais.', rarity: 'epico', icon: 'Target', category: 'budgets', metric: 'budgetsKept', target: 10 },
      { id: 'orcamento_15', name: 'Guardião dos Gastos', description: 'Cumpra 15 tetos de orçamento mensais.', rarity: 'epico', icon: 'Target', category: 'budgets', metric: 'budgetsKept', target: 15 },
      { id: 'orcamento_25', name: 'Controle Absoluto', description: 'Cumpra 25 tetos de orçamento mensais.', rarity: 'lendario', icon: 'Crown', category: 'budgets', metric: 'budgetsKept', target: 25 },

      // --- 7. Missões Semanais ---
      { id: 'missoes_1', name: 'Primeira Missão', description: 'Conclua sua primeira missão semanal.', rarity: 'comum', icon: 'Swords', category: 'missions', metric: 'missionsCompleted', target: 1 },
      { id: 'missoes_3', name: 'Desbravador de Desafios', description: 'Conclua 3 missões semanais.', rarity: 'comum', icon: 'Swords', category: 'missions', metric: 'missionsCompleted', target: 3 },
      { id: 'missoes_5', name: 'Foco Semanal', description: 'Conclua 5 missões semanais.', rarity: 'comum', icon: 'Swords', category: 'missions', metric: 'missionsCompleted', target: 5 },
      { id: 'missoes_10', name: 'Caçador de Missões', description: 'Conclua 10 missões semanais.', rarity: 'raro', icon: 'Swords', category: 'missions', metric: 'missionsCompleted', target: 10 },
      { id: 'missoes_25', name: 'Veterano de Missões', description: 'Conclua 25 missões semanais.', rarity: 'epico', icon: 'Trophy', category: 'missions', metric: 'missionsCompleted', target: 25 },
      { id: 'missoes_50', name: 'Campeão do Pigo', description: 'Conclua 50 missões semanais.', rarity: 'lendario', icon: 'Crown', category: 'missions', metric: 'missionsCompleted', target: 50 },

      // --- 8. Detecção Inteligente e Assinaturas ---
      { id: 'detetive_1', name: 'Olho Clínico', description: 'O Pigo identificou 1 despesa recorrente nos seus lançamentos.', rarity: 'comum', icon: 'Search', category: 'intelligence', metric: 'recurringDetected', target: 1 },
      { id: 'detetive_3', name: 'Radar de Assinaturas', description: '3 despesas recorrentes identificadas.', rarity: 'comum', icon: 'Search', category: 'intelligence', metric: 'recurringDetected', target: 3 },
      { id: 'detetive', name: 'Detetive de Assinaturas', description: 'O Pigo identificou 5 despesas recorrentes nos seus extratos.', rarity: 'raro', icon: 'Search', category: 'intelligence', metric: 'recurringDetected', target: 5 },
      { id: 'detetive_10', name: 'Inspetor Implacável', description: '10 despesas recorrentes mapeadas no sistema.', rarity: 'epico', icon: 'Search', category: 'intelligence', metric: 'recurringDetected', target: 10 },

      // --- 9. Hábitos e Rotina Diária ---
      { id: 'habito_primeiro', name: 'O Começo de Tudo', description: 'Crie seu primeiro hábito diário no Pigo Hábitos.', rarity: 'comum', icon: 'Sparkles', category: 'habits', metric: 'activeHabits', target: 1 },
      { id: 'habito_checkin_1', name: 'Primeiro Check-in', description: 'Conclua seu primeiro hábito no dia.', rarity: 'comum', icon: 'CalendarCheck', category: 'habits', metric: 'habitCheckins', target: 1 },
      { id: 'habito_checkin_7', name: 'Semana de Hábitos', description: '7 check-ins de hábitos concluídos.', rarity: 'comum', icon: 'CalendarCheck', category: 'habits', metric: 'habitCheckins', target: 7 },
      { id: 'habito_checkin_21', name: 'Regra dos 21 Dias', description: '21 check-ins de hábitos acumulados.', rarity: 'raro', icon: 'Flame', category: 'habits', metric: 'habitCheckins', target: 21 },
      { id: 'habito_checkin_50', name: 'Mente Focada', description: '50 check-ins de hábitos completados.', rarity: 'raro', icon: 'Trophy', category: 'habits', metric: 'habitCheckins', target: 50 },
      { id: 'habito_checkin_100', name: 'Centenário da Disciplina', description: '100 check-ins de hábitos completados.', rarity: 'epico', icon: 'Trophy', category: 'habits', metric: 'habitCheckins', target: 100 },
      { id: 'habito_checkin_250', name: 'Mestre da Rotina', description: '250 check-ins de hábitos completados.', rarity: 'lendario', icon: 'Crown', category: 'habits', metric: 'habitCheckins', target: 250 },
      { id: 'habito_streak_7', name: 'Fogo Sagrado', description: 'Mantenha 7 dias consecutivos cumprindo hábitos.', rarity: 'raro', icon: 'Flame', category: 'habits', metric: 'habitStreak', target: 7 },
      { id: 'habito_streak_21', name: 'Inabalável', description: 'Mantenha 21 dias consecutivos cumprindo hábitos.', rarity: 'epico', icon: 'Flame', category: 'habits', metric: 'habitStreak', target: 21 },

      // --- 10. Metas Financeiras ---
      { id: 'meta_criada', name: 'Sonhador Estratégico', description: 'Crie sua primeira meta financeira no Pigo.', rarity: 'comum', icon: 'Target', category: 'goals', metric: 'goalsCount', target: 1 },
      { id: 'meta_concluida_1', name: 'Sonho Realizado', description: 'Atinja 100% de uma meta financeira.', rarity: 'raro', icon: 'Trophy', category: 'goals', metric: 'goalsCompleted', target: 1 },
      { id: 'meta_concluida_3', name: 'Conquistador de Sonhos', description: 'Atinja 100% em 3 metas financeiras.', rarity: 'epico', icon: 'Trophy', category: 'goals', metric: 'goalsCompleted', target: 3 },
      { id: 'meta_concluida_5', name: 'Arquiteto do Futuro', description: 'Atinja 100% em 5 metas financeiras.', rarity: 'lendario', icon: 'Crown', category: 'goals', metric: 'goalsCompleted', target: 5 },

      // --- 11. Hábitos Avançados & Dias Perfeitos ---
      { id: 'habito_diversidade_3', name: 'Tríade Diária', description: 'Tenha 3 ou mais hábitos ativos na sua rotina.', rarity: 'comum', icon: 'Sparkles', category: 'habits', metric: 'activeHabits', target: 3 },
      { id: 'habito_diversidade_5', name: 'Rotina Completa', description: 'Tenha 5 ou mais hábitos ativos na sua grade diária.', rarity: 'raro', icon: 'Sparkles', category: 'habits', metric: 'activeHabits', target: 5 },
      { id: 'dia_perfeito_1', name: 'Primeiro Dia Perfeito', description: 'Conclua 100% dos seus hábitos ativos em um mesmo dia.', rarity: 'comum', icon: 'CalendarCheck', category: 'habits', metric: 'perfectHabitDays', target: 1 },
      { id: 'dia_perfeito_7', name: 'Semana 100% Impecável', description: 'Alcance 7 Dias Perfeitos (100% dos hábitos concluídos).', rarity: 'raro', icon: 'Flame', category: 'habits', metric: 'perfectHabitDays', target: 7 },
      { id: 'dia_perfeito_15', name: 'Quinzena de Elite', description: 'Alcance 15 Dias Perfeitos cumprindo toda a grade.', rarity: 'epico', icon: 'Trophy', category: 'habits', metric: 'perfectHabitDays', target: 15 },
      { id: 'dia_perfeito_30', name: 'Mês de Alta Performance', description: 'Alcance 30 Dias Perfeitos cumprindo todos os hábitos.', rarity: 'lendario', icon: 'Crown', category: 'habits', metric: 'perfectHabitDays', target: 30 },
      { id: 'habito_streak_14', name: 'Duas Semanas de Fogo', description: 'Mantenha 14 dias consecutivos cumprindo hábitos.', rarity: 'raro', icon: 'Flame', category: 'habits', metric: 'habitStreak', target: 14 },
      { id: 'habito_streak_30', name: 'Trinta Dias de Aço', description: 'Mantenha 30 dias consecutivos cumprindo hábitos.', rarity: 'epico', icon: 'Flame', category: 'habits', metric: 'habitStreak', target: 30 },
      { id: 'habito_streak_60', name: 'Disciplina Inabalável', description: 'Mantenha 60 dias consecutivos cumprindo hábitos.', rarity: 'lendario', icon: 'Crown', category: 'habits', metric: 'habitStreak', target: 60 },

      // --- 12. Segundo Cérebro: Anotações & Ideias ---
      { id: 'nota_primeira', name: 'Primeira Ideia no Papel', description: 'Crie sua primeira anotação nas Ferramentas do Pigo.', rarity: 'comum', icon: 'Library', category: 'tools', metric: 'notesCount', target: 1 },
      { id: 'nota_fixada', name: 'Foco Prioritário', description: 'Fixe uma anotação importante no topo do seu quadro.', rarity: 'comum', icon: 'Sparkles', category: 'tools', metric: 'pinnedNotesCount', target: 1 },
      { id: 'notas_5', name: 'Bloco de Ideias Ativo', description: 'Mantenha 5 anotações organizadas no Pigo.', rarity: 'comum', icon: 'Library', category: 'tools', metric: 'notesCount', target: 5 },
      { id: 'notas_15', name: 'Segundo Cérebro', description: 'Construa uma base sólida com 15 anotações salvas.', rarity: 'raro', icon: 'GraduationCap', category: 'tools', metric: 'notesCount', target: 15 },
      { id: 'notas_30', name: 'Enciclopédia Pessoal', description: 'Alcance 30 anotações salvas no seu Segundo Cérebro.', rarity: 'epico', icon: 'Crown', category: 'tools', metric: 'notesCount', target: 30 },

      // --- 13. Mapas Mentais & Estratégia Visual ---
      { id: 'mapa_primeiro', name: 'Arquiteto de Ideias', description: 'Crie seu primeiro Mapa Mental interativo.', rarity: 'comum', icon: 'Sparkles', category: 'tools', metric: 'mindmapsCount', target: 1 },
      { id: 'mapa_ramificado_6', name: 'Pensamento Ramificado', description: 'Construa um Mapa Mental com pelo menos 6 nós conectados.', rarity: 'raro', icon: 'Target', category: 'tools', metric: 'maxMindmapNodes', target: 6 },
      { id: 'mapa_ramificado_12', name: 'Teia Estratégica', description: 'Construa um Mapa Mental complexo com 12 ou mais nós.', rarity: 'epico', icon: 'Trophy', category: 'tools', metric: 'maxMindmapNodes', target: 12 },
      { id: 'mapas_3', name: 'Estrategista Visual', description: 'Tenha 3 quadros de Mapas Mentais criados.', rarity: 'raro', icon: 'Library', category: 'tools', metric: 'mindmapsCount', target: 3 },
      { id: 'mapas_5', name: 'Mente Cartográfica', description: 'Mantenha 5 quadros de Mapas Mentais estruturados.', rarity: 'epico', icon: 'Crown', category: 'tools', metric: 'mindmapsCount', target: 5 },

      // --- 14. Cofre de Senhas & Segurança Digital ---
      { id: 'cofre_primeira', name: 'Cofre Blindado', description: 'Guarde sua primeira credencial criptografada no Cofre de Senhas.', rarity: 'comum', icon: 'Shield', category: 'tools', metric: 'vaultItemsCount', target: 1 },
      { id: 'cofre_5', name: 'Chaveiro Seguro', description: 'Proteja 5 senhas no Cofre Criptografado do Pigo.', rarity: 'comum', icon: 'ShieldCheck', category: 'tools', metric: 'vaultItemsCount', target: 5 },
      { id: 'cofre_15', name: 'Guardião Digital', description: 'Proteja 15 credenciais no Cofre de Senhas.', rarity: 'raro', icon: 'ShieldCheck', category: 'tools', metric: 'vaultItemsCount', target: 15 },
      { id: 'cofre_30', name: 'Fortaleza Criptografada', description: 'Mantenha 30 senhas protegidas com criptografia AES-256.', rarity: 'epico', icon: 'Castle', category: 'tools', metric: 'vaultItemsCount', target: 30 },

      // --- 15. Domínio Completo da Plataforma ---
      { id: 'contas_multiplas', name: 'Visão Multi-Bancos', description: 'Cadastre 3 ou mais contas bancárias ou carteiras.', rarity: 'comum', icon: 'PiggyBank', category: 'reserve', metric: 'accountsCount', target: 3 },
      { id: 'mestre_4_pilares', name: 'Mestre dos 4 Pilares', description: 'Use ativamente Finanças, Hábitos, Notas/Mapas e Cofre de Senhas no Pigo!', rarity: 'lendario', icon: 'Crown', category: 'tools', metric: 'pillarsActiveCount', target: 4 },
    ];
  }

  computeAchievements(facts, streaks, missionsCompleted) {
    const metrics = {
      statements: facts.statements.length,
      categorized: facts.categorizedCount,
      inboxZero20: facts.transactionCount >= 20 && facts.uncategorizedCount === 0 ? 1 : 0,
      inboxZero: facts.transactionCount >= 50 && facts.uncategorizedCount === 0 ? 1 : 0,
      inboxZero100: facts.transactionCount >= 100 && facts.uncategorizedCount === 0 ? 1 : 0,
      inboxZero250: facts.transactionCount >= 250 && facts.uncategorizedCount === 0 ? 1 : 0,
      positiveMonths: facts.positiveMonths.length,
      positiveStreak: streaks.positiveMonths.best,
      reserveAportes: facts.reserveAportes.length,
      reserveCoverage: facts.reserveStatus ? facts.reserveStatus.coverageMonths : 0,
      reserveComplete: facts.reserveStatus && facts.reserveStatus.status === 'complete' ? 1 : 0,
      importStreak: streaks.importWeeks.best,
      invoicesOnTime: facts.invoicesOnTime.length,
      budgetsKept: facts.budgetsKept.length,
      missionsCompleted,
      recurringDetected: facts.recurringCount,
      activeHabits: facts.activeHabitsCount,
      habitCheckins: facts.habitCheckins,
      habitStreak: facts.habitBestStreak,
      goalsCount: facts.goalsCount,
      goalsCompleted: facts.goalsCompleted,
      perfectHabitDays: facts.perfectHabitDaysCount || 0,
      notesCount: facts.notesCount || 0,
      pinnedNotesCount: facts.pinnedNotesCount || 0,
      mindmapsCount: facts.mindmapsCount || 0,
      maxMindmapNodes: facts.maxMindmapNodes || 0,
      vaultItemsCount: facts.vaultItemsCount || 0,
      accountsCount: facts.accountsCount || 0,
      pillarsActiveCount: facts.pillarsActiveCount || 0,
    };
    const seen = new Map(this.db.prepare(`SELECT key, seen_at FROM game_seen WHERE key LIKE 'ach:%'`).all().map(r => [r.key, r.seen_at]));

    return this.getAchievementDefinitions().map(def => {
      const current = metrics[def.metric] || 0;
      const unlocked = current >= def.target;
      return {
        ...def,
        xp: RARITY_XP[def.rarity],
        current: Math.min(current, def.target),
        progress: Math.min(100, Math.round((current / def.target) * 100)),
        unlocked,
        unlockedAt: unlocked ? (seen.get(`ach:${def.id}`) || facts.today).slice(0, 10) : null,
      };
    });
  }

  // ==========================================
  // Visão geral (XP, nível, eventos)
  // ==========================================
  getOverview() {
    const facts = this.collectFacts();
    const streaks = this.computeStreaks(facts);
    const missions = this.evaluateAllMissions(facts);
    const allMissions = [...missions.current, ...missions.past];
    const completedMissions = allMissions.filter(m => m.status === 'completed');
    const achievements = this.computeAchievements(facts, streaks, completedMissions.length);

    const events = [];
    for (const s of facts.statements) {
      events.push({ id: `stmt:${s.id}`, date: s.imported_at.slice(0, 10), xp: XP.statementImport, kind: 'import', title: `Extrato importado: ${s.original_name}` });
    }
    for (const row of facts.categorizedByMonth) {
      const date = row.month_key === facts.currentMonth ? facts.today : monthEnd(row.month_key);
      events.push({ id: `cat:${row.month_key}`, date, xp: row.c * XP.categorizedTransaction, kind: 'categorize', title: `${row.c} lançamentos categorizados em ${monthLabel(row.month_key)}` });
    }
    for (const m of facts.positiveMonths) {
      events.push({ id: `month:${m.monthKey}`, date: monthEnd(m.monthKey), xp: XP.positiveMonth, kind: 'month', title: `${monthLabel(m.monthKey)} fechou no azul (+${formatBRL(m.result)})` });
    }
    for (const a of facts.reserveAportes) {
      const bonus = Math.min(XP.reserveAporteMaxBonus, Math.floor(Math.abs(a.amount) / 2000));
      events.push({ id: `res:${a.id}`, date: a.date, xp: XP.reserveAporteBase + bonus, kind: 'reserve', title: `Aporte de ${formatBRL(Math.abs(a.amount))} na reserva` });
    }
    for (const b of facts.budgetsKept) {
      events.push({ id: `bud:${b.budgetId}:${b.monthKey}`, date: monthEnd(b.monthKey), xp: XP.budgetKept, kind: 'budget', title: `Teto de ${b.categoryName} cumprido em ${monthLabel(b.monthKey)}` });
    }
    for (const p of facts.invoicesOnTime) {
      events.push({ id: `inv:${p.id}`, date: p.transaction_date, xp: XP.invoiceOnTime, kind: 'invoice', title: `Fatura ${p.card_name} paga em dia` });
    }
    for (const m of completedMissions) {
      events.push({ id: `mis:${m.weekKey}:${m.id}`, date: m.completedAt || facts.today, xp: m.xp, kind: 'mission', title: `Missão concluída: ${m.title}` });
    }
        for (const hDay of (facts.habitCheckinsByDay || [])) {
      events.push({
        id: `hab:${hDay.date}`,
        date: hDay.date,
        xp: hDay.c * XP.habitCheckin,
        kind: 'habit',
        title: `${hDay.c} ${hDay.c === 1 ? 'hábito concluído' : 'hábitos concluídos'} no dia`,
      });
      if (facts.activeHabitsCount > 0 && hDay.c >= facts.activeHabitsCount) {
        events.push({
          id: `hab_perfect:${hDay.date}`,
          date: hDay.date,
          xp: XP.perfectHabitDay,
          kind: 'habit',
          title: 'Dia Perfeito: 100% dos hábitos concluídos!',
        });
      }
    }
    for (const a of achievements.filter(x => x.unlocked)) {
      events.push({ id: `ach:${a.id}`, date: a.unlockedAt, xp: a.xp, kind: 'achievement', title: `Conquista: ${a.name}` });
    }
    events.sort((a, b) => b.date.localeCompare(a.date) || b.xp - a.xp);

    const totalXp = events.reduce((s, e) => s + e.xp, 0);
    const levelInfo = levelFromXp(totalXp);
    const xpByKind = {};
    for (const e of events) xpByKind[e.kind] = (xpByKind[e.kind] || 0) + e.xp;
    const nextTitle = LEVEL_TITLES.find(t => t.from > levelInfo.level) || null;

    return {
      totalXp,
      level: levelInfo.level,
      title: titleForLevel(levelInfo.level),
      xpIntoLevel: levelInfo.xpIntoLevel,
      xpForNext: levelInfo.xpForNext,
      progressPercent: Math.round((levelInfo.xpIntoLevel / levelInfo.xpForNext) * 100),
      nextTitle: nextTitle ? { title: nextTitle.title, level: nextTitle.from } : null,
      streaks,
      missions: { current: missions.current, weekEnd: missions.weekEnd, completedTotal: completedMissions.length },
      achievements,
      events: events.slice(0, 60),
      xpByKind,
      xpThisWeek: events.filter(e => e.date >= weekStart(facts.today)).reduce((s, e) => s + e.xp, 0),
    };
  }

  // ==========================================
  // Reino do Pigo: os dados financeiros traduzidos em elementos da vila
  // ==========================================
  getWorldState() {
    const facts = this.collectFacts();
    const today = facts.today;
    const overview = this.getOverview();

    // Prédios = contas ativas
    const accounts = this.db.prepare(`SELECT id, name, type, color FROM accounts WHERE active = 1 ORDER BY name ASC`).all()
      .map(a => ({ ...a, balance: this.intelligence.getAccountBalanceAt(a.id, today) }));
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

    // Muralhas = reserva (camadas = meses de custo de vida cobertos)
    const reserve = facts.reserveStatus;

    // Dragão = faturas de cartão em aberto
    const cards = this.db.prepare(`SELECT id, name, credit_limit FROM credit_cards WHERE active = 1`).all();
    const cardDebt = cards.length === 0 ? 0 : this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE credit_card_id IS NOT NULL AND type = 'expense' AND status NOT IN ('cancelled', 'paid')
    `).get().total;
    const totalLimit = cards.reduce((s, c) => s + c.credit_limit, 0);
    const longInstallments = this.db.prepare(`
      SELECT COUNT(DISTINCT installment_id) as c FROM transactions
      WHERE credit_card_id IS NOT NULL AND installment_id IS NOT NULL AND status NOT IN ('cancelled', 'paid')
        AND invoice_month > ?
    `).get(facts.currentMonth).c;

    // Construções = metas
    const goals = this.db.prepare(`SELECT id, name, color, target_amount, current_amount FROM goals ORDER BY created_at ASC`).all()
      .map(g => ({
        id: g.id,
        name: g.name,
        color: g.color,
        progress: g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0,
        currentAmount: g.current_amount,
        targetAmount: g.target_amount,
      }));

    // Goblins = assinaturas/recorrências ativas detectadas nos extratos
    let subscriptions = [];
    try {
      subscriptions = this.intelligence.detectRecurringPatterns('expense')
        .filter(p => p.isActive)
        .map(p => ({ name: p.cleanDescription, amount: p.averageAmount, frequency: p.suggestedFrequency }));
    } catch (e) {
      subscriptions = [];
    }

    // Clima = saúde financeira + resultado do último mês fechado
    let healthScore = 50;
    try {
      healthScore = this.intelligence.getFinancialHealthScore().score;
    } catch (e) {}
    const lastMonthKey = addMonthsToKey(facts.currentMonth, -1);
    const lastMonthPositive = facts.positiveMonths.some(m => m.monthKey === lastMonthKey);
    const lastMonthHadData = Boolean(this.db.prepare(`
      SELECT 1 FROM transactions WHERE transaction_date >= ? AND transaction_date <= ? LIMIT 1
    `).get(`${lastMonthKey}-01`, `${lastMonthKey}-31`));
    let weather = 'cloudy';
    if (lastMonthHadData && !lastMonthPositive && healthScore < 60) weather = 'rain';
    else if (healthScore >= 70 || lastMonthPositive) weather = 'sunny';

    // Caravana = extrato importado nos últimos 7 dias
    const lastImport = facts.statements.length > 0 ? facts.statements[facts.statements.length - 1].imported_at : null;
    const caravanArrived = Boolean(lastImport && lastImport.slice(0, 10) >= addDays(today, -7));

    return {
      level: overview.level,
      title: overview.title,
      totalXp: overview.totalXp,
      progressPercent: overview.progressPercent,
      healthScore,
      weather,
      festival: lastMonthPositive,
      lastMonthKey,
      treasury: { totalBalance },
      buildings: accounts,
      walls: reserve ? {
        layers: Math.max(0, Math.floor(reserve.coverageMonths)),
        coverageMonths: reserve.coverageMonths,
        targetMonths: reserve.targetMonths,
        balance: reserve.balance,
        status: reserve.status,
      } : { layers: 0, coverageMonths: 0, targetMonths: 6, balance: 0, status: 'not_configured' },
      dragon: {
        present: cardDebt > 0,
        debt: cardDebt,
        totalLimit,
        utilization: totalLimit > 0 ? Math.round((cardDebt / totalLimit) * 100) : 0,
        chains: longInstallments,
        cardsCount: cards.length,
      },
      warehouse: { uncategorized: facts.uncategorizedCount, categorized: facts.categorizedCount },
      constructions: goals,
      goblins: subscriptions,
      caravan: { arrived: caravanArrived, lastImportAt: lastImport },
      streaks: overview.streaks,
      missions: overview.missions.current,
    };
  }

  // Novidades desde a última vez (para comemorar); na primeira execução só registra
  getNewUnlocks() {
    const overview = this.getOverview();
    const seenKeys = new Set(this.db.prepare(`SELECT key FROM game_seen`).all().map(r => r.key));
    const firstRun = seenKeys.size === 0;
    const now = new Date().toISOString();
    const markSeen = this.db.prepare(`INSERT OR IGNORE INTO game_seen (key, seen_at) VALUES (?, ?)`);

    const fresh = [];
    for (const a of overview.achievements.filter(x => x.unlocked)) {
      const key = `ach:${a.id}`;
      if (!seenKeys.has(key)) {
        markSeen.run(key, now);
        if (!firstRun) fresh.push({ type: 'achievement', id: a.id, name: a.name, rarity: a.rarity, xp: a.xp, icon: a.icon });
      }
    }
    const levelKey = `level:${overview.level}`;
    if (!seenKeys.has(levelKey)) {
      markSeen.run(levelKey, now);
      if (!firstRun) fresh.push({ type: 'level', level: overview.level, title: overview.title });
    }

    return {
      firstRun,
      unlocks: fresh,
      summary: { level: overview.level, title: overview.title, totalXp: overview.totalXp, achievements: overview.achievements.filter(a => a.unlocked).length },
    };
  }
}

module.exports = {
  GamificationEngine,
  levelFromXp,
  titleForLevel,
  weekStart,
  XP,
  RARITY_XP,
};
