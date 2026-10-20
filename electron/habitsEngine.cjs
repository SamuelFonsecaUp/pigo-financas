const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

/**
 * HabitsEngine - Motor de rastreamento de hábitos e consistência
 * Inspirado nos padrões Loop Habit Tracker, Streaks e Atomic Habits.
 */
class HabitsEngine {
  constructor(db) {
    this.db = db;
  }

  // Obtém a data local de hoje em formato YYYY-MM-DD
  getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Gera array de datas consecutivas YYYY-MM-DD entre start e end
  getDateRange(daysBack = 14) {
    const dates = [];
    const today = new Date();
    for (let i = daysBack - 1; i >= 0; i--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    return dates;
  }

  /**
   * Calcula o streak atual, o maior streak e a força do hábito (0-100%)
   * baseando-se no histórico de conclusões.
   */
  calculateStats(logsMap, frequencyType = 'daily', targetDays = []) {
    const todayStr = this.getTodayDateString();
    const dates = Object.keys(logsMap).sort();

    // 1. Cálculo de Streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Percorre até 365 dias para trás para calcular streak e força
    const checkDays = 365;
    const now = new Date();
    const historyDesc = [];

    for (let i = 0; i < checkDays; i++) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - i);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = dt.getDay(); // 0 = Domingo, 1 = Segunda...

      // Se o hábito for em dias específicos da semana e hoje não for um deles:
      let isScheduled = true;
      if (frequencyType === 'days_of_week' && Array.isArray(targetDays) && targetDays.length > 0) {
        isScheduled = targetDays.includes(dayOfWeek);
      }

      const isCompleted = Boolean(logsMap[dateStr]?.completed);
      historyDesc.push({ date: dateStr, isCompleted, isScheduled });
    }

    // Calcula current streak a partir de hoje ou ontem
    let countingCurrent = true;
    for (let i = 0; i < historyDesc.length; i++) {
      const { date, isCompleted, isScheduled } = historyDesc[i];
      if (!isScheduled) continue; // Pula dias em que o hábito não estava programado

      if (i === 0 && !isCompleted && date === todayStr) {
        // Se ainda não marcou hoje, ainda não quebrou o streak de ontem!
        continue;
      }

      if (isCompleted) {
        if (countingCurrent) currentStreak++;
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        countingCurrent = false;
        tempStreak = 0;
      }
    }

    // 2. Cálculo da Força do Hábito (Exponential Smoothing do Loop Habit Tracker)
    // S_t = S_{t-1} * 0.95 + (check ? 0.05 : 0)
    // Avaliamos em ordem cronológica (do dia mais antigo ao mais recente)
    let strength = 0;
    const LAMBDA = 0.95; // Fator de retenção
    const historyAsc = [...historyDesc].reverse();

    for (const item of historyAsc) {
      if (!item.isScheduled) continue;
      const checkValue = item.isCompleted ? 1 : 0;
      strength = strength * LAMBDA + checkValue * (1 - LAMBDA);
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      strength: Math.min(100, Math.round(strength * 100)),
    };
  }

  // Lista todos os hábitos com histórico recente e estatísticas
  getHabits(includeArchived = false) {
    const todayStr = this.getTodayDateString();
    const query = includeArchived
      ? 'SELECT * FROM habits ORDER BY position ASC, created_at ASC'
      : 'SELECT * FROM habits WHERE archived = 0 ORDER BY position ASC, created_at ASC';

    const habits = this.db.prepare(query).all();
    if (!habits.length) return [];

    const recentDates = this.getDateRange(14); // Últimas 2 semanas para a grade rápida
    const startDate = recentDates[0];

    // Busca todos os logs relevantes
    const logsStmt = this.db.prepare(`
      SELECT habit_id, date, completed, value, notes 
      FROM habit_logs 
      WHERE date >= ?
    `);
    const logs = logsStmt.all(startDate);

    // Agrupa logs por habit_id
    const logsByHabit = {};
    for (const log of logs) {
      if (!logsByHabit[log.habit_id]) logsByHabit[log.habit_id] = {};
      logsByHabit[log.habit_id][log.date] = log;
    }

    // Busca logs completos de cada hábito para o cálculo de streak (últimos 365 dias)
    const yearAgo = new Date();
    yearAgo.setDate(yearAgo.getDate() - 365);
    const yearAgoStr = yearAgo.toISOString().slice(0, 10);
    const allYearLogsStmt = this.db.prepare(`
      SELECT habit_id, date, completed, value 
      FROM habit_logs 
      WHERE date >= ?
    `);
    const allYearLogs = allYearLogsStmt.all(yearAgoStr);
    const yearLogsByHabit = {};
    for (const log of allYearLogs) {
      if (!yearLogsByHabit[log.habit_id]) yearLogsByHabit[log.habit_id] = {};
      yearLogsByHabit[log.habit_id][log.date] = log;
    }

    return habits.map((h) => {
      let days = [];
      try {
        days = h.frequency_days ? JSON.parse(h.frequency_days) : [];
      } catch (e) {
        days = [];
      }

      const habitYearLogs = yearLogsByHabit[h.id] || {};
      const stats = this.calculateStats(habitYearLogs, h.frequency_type, days);
      const habitRecentLogs = logsByHabit[h.id] || {};

      const recentHistory = recentDates.map((date) => {
        const log = habitRecentLogs[date];
        return {
          date,
          completed: Boolean(log?.completed),
          value: log?.value ?? null,
        };
      });

      return {
        ...h,
        archived: Boolean(h.archived),
        frequency_days: days,
        completedToday: Boolean(habitRecentLogs[todayStr]?.completed),
        todayValue: habitRecentLogs[todayStr]?.value ?? null,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        strength: stats.strength,
        recentHistory,
      };
    });
  }

  // Cria um novo hábito
  createHabit(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const rawFreqDays = data.frequencyDays ?? data.frequency_days ?? [0, 1, 2, 3, 4, 5, 6];
    const frequencyDaysJson = Array.isArray(rawFreqDays)
      ? JSON.stringify(rawFreqDays)
      : rawFreqDays || null;

    const stmt = this.db.prepare(`
      INSERT INTO habits (
        id, name, description, category, color, icon, type, target_value,
        target_unit, frequency_type, frequency_days, frequency_times,
        period_of_day, archived, position, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, 0, 0, ?, ?
      )
    `);

    stmt.run(
      id,
      data.name.trim(),
      data.description?.trim() || null,
      data.category || 'geral',
      data.color || '#38bdf8',
      data.icon || 'CheckCircle',
      data.type || 'boolean',
      data.targetValue ?? data.target_value ?? 1,
      (data.targetUnit ?? data.target_unit)?.trim() || null,
      data.frequencyType || data.frequency_type || 'daily',
      frequencyDaysJson,
      data.frequencyTimes ?? data.frequency_times ?? 7,
      data.periodOfDay || data.period_of_day || 'anytime',
      now,
      now
    );

    return this.getHabits().find((h) => h.id === id);
  }

  // Atualiza um hábito
  updateHabit(id, data) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name.trim());
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description?.trim() || null);
    }
    if (data.category !== undefined) {
      fields.push('category = ?');
      values.push(data.category);
    }
    if (data.color !== undefined) {
      fields.push('color = ?');
      values.push(data.color);
    }
    if (data.icon !== undefined) {
      fields.push('icon = ?');
      values.push(data.icon);
    }
    if (data.type !== undefined) {
      fields.push('type = ?');
      values.push(data.type);
    }
    if (data.targetValue !== undefined) {
      fields.push('target_value = ?');
      values.push(data.targetValue);
    }
    if (data.targetUnit !== undefined) {
      fields.push('target_unit = ?');
      values.push(data.targetUnit?.trim() || null);
    }
    if (data.frequencyType !== undefined) {
      fields.push('frequency_type = ?');
      values.push(data.frequencyType);
    }
    if (data.frequencyDays !== undefined) {
      fields.push('frequency_days = ?');
      values.push(Array.isArray(data.frequencyDays) ? JSON.stringify(data.frequencyDays) : data.frequencyDays);
    }
    if (data.frequencyTimes !== undefined) {
      fields.push('frequency_times = ?');
      values.push(data.frequencyTimes);
    }
    if (data.periodOfDay !== undefined) {
      fields.push('period_of_day = ?');
      values.push(data.periodOfDay);
    }
    if (data.archived !== undefined) {
      fields.push('archived = ?');
      values.push(data.archived ? 1 : 0);
    }
    if (data.position !== undefined) {
      fields.push('position = ?');
      values.push(data.position);
    }

    if (!fields.length) return null;

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const query = `UPDATE habits SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(query).run(...values);

    return this.getHabits(true).find((h) => h.id === id);
  }

  // Deleta um hábito e seus logs
  deleteHabit(id) {
    this.db.prepare('DELETE FROM habit_logs WHERE habit_id = ?').run(id);
    const res = this.db.prepare('DELETE FROM habits WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // Alterna o status de conclusão de um dia (com 1 clique)
  toggleHabitDay(habitId, date, value = null, notes = null) {
    const now = new Date().toISOString();
    const existing = this.db.prepare('SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?').get(habitId, date);

    if (existing) {
      if (existing.completed) {
        // Se já estava concluído, desmarca (remove ou marca completed = 0)
        this.db.prepare('DELETE FROM habit_logs WHERE id = ?').run(existing.id);
        return { completed: false, value: null };
      } else {
        // Marca como concluído
        this.db.prepare('UPDATE habit_logs SET completed = 1, value = ?, notes = ?, updated_at = ? WHERE id = ?')
          .run(value ?? 1, notes, now, existing.id);
        return { completed: true, value: value ?? 1 };
      }
    } else {
      // Cria novo log de conclusão
      const id = uuidv4();
      this.db.prepare(`
        INSERT INTO habit_logs (id, habit_id, date, completed, value, notes, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?)
      `).run(id, habitId, date, value ?? 1, notes, now, now);
      return { completed: true, value: value ?? 1 };
    }
  }

  // Obtém o mapa de calor anual (365 dias) estilo GitHub de um hábito
  getHabitHeatmap(habitId, year = new Date().getFullYear()) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const logs = this.db.prepare(`
      SELECT date, completed, value, notes 
      FROM habit_logs 
      WHERE habit_id = ? AND date >= ? AND date <= ?
    `).all(habitId, startDate, endDate);

    const map = {};
    for (const log of logs) {
      map[log.date] = {
        completed: Boolean(log.completed),
        value: log.value,
        notes: log.notes,
      };
    }
    return map;
  }

  // Visão geral de estatísticas para o cabeçalho
  getHabitsOverview() {
    const todayStr = this.getTodayDateString();
    const habits = this.getHabits(false);
    const total = habits.length;
    const completedToday = habits.filter((h) => h.completedToday).length;
    const percentToday = total > 0 ? Math.round((completedToday / total) * 100) : 0;

    let bestStreakHabit = null;
    let maxStreak = 0;
    for (const h of habits) {
      if (h.currentStreak > maxStreak) {
        maxStreak = h.currentStreak;
        bestStreakHabit = h;
      }
    }

    const averageStrength = total > 0
      ? Math.round(habits.reduce((acc, h) => acc + h.strength, 0) / total)
      : 0;

    return {
      total,
      completedToday,
      percentToday,
      bestStreak: maxStreak,
      bestHabitName: bestStreakHabit?.name || null,
      averageStrength,
    };
  }
}

module.exports = { HabitsEngine };
