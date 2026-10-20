import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { HabitsEngine } from '../electron/habitsEngine.cjs';

describe('Habits Engine (Atomic Habits / Loop Tracker)', () => {
  let db: any;
  let engine: any;

  beforeEach(() => {
    // Banco SQLite em memória para testes isolados e ultrarrápidos
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'geral',
        color TEXT DEFAULT '#38bdf8',
        icon TEXT DEFAULT 'CheckCircle',
        type TEXT DEFAULT 'boolean',
        target_value REAL DEFAULT 1,
        target_unit TEXT,
        frequency_type TEXT DEFAULT 'daily',
        frequency_days TEXT,
        frequency_times INTEGER DEFAULT 7,
        period_of_day TEXT DEFAULT 'anytime',
        archived INTEGER DEFAULT 0,
        position INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS habit_logs (
        id TEXT PRIMARY KEY,
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        completed INTEGER DEFAULT 1,
        value REAL DEFAULT 1,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT,
        UNIQUE(habit_id, date)
      );
    `);
    engine = new HabitsEngine(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates and lists habits with default statistics', () => {
    const habit = engine.createHabit({
      name: 'Beber 2L de água',
      category: 'saude',
      color: '#38bdf8',
      type: 'measurable',
      targetValue: 2000,
      targetUnit: 'ml',
      periodOfDay: 'morning',
    });

    expect(habit).toBeDefined();
    expect(habit.name).toBe('Beber 2L de água');
    expect(habit.target_value).toBe(2000);
    expect(habit.currentStreak).toBe(0);
    expect(habit.strength).toBe(0);

    const list = engine.getHabits();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(habit.id);
  });

  it('toggles daily check-in with a single click', () => {
    const habit = engine.createHabit({ name: 'Meditação' });
    const today = engine.getTodayDateString();

    // Marca como feito
    const check1 = engine.toggleHabitDay(habit.id, today);
    expect(check1.completed).toBe(true);

    let updated = engine.getHabits().find((h: any) => h.id === habit.id);
    expect(updated.completedToday).toBe(true);
    expect(updated.currentStreak).toBe(1);

    // Desmarca ao clicar novamente
    const check2 = engine.toggleHabitDay(habit.id, today);
    expect(check2.completed).toBe(false);

    updated = engine.getHabits().find((h: any) => h.id === habit.id);
    expect(updated.completedToday).toBe(false);
    expect(updated.currentStreak).toBe(0);
  });

  it('calculates streaks correctly across consecutive days', () => {
    const habit = engine.createHabit({ name: 'Leitura' });
    const now = new Date();

    // Simula 5 dias seguidos concluídos até hoje
    for (let i = 0; i < 5; i++) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - i);
      const dateStr = dt.toISOString().slice(0, 10);
      engine.toggleHabitDay(habit.id, dateStr);
    }

    const updated = engine.getHabits().find((h: any) => h.id === habit.id);
    expect(updated.currentStreak).toBe(5);
    expect(updated.longestStreak).toBe(5);
    expect(updated.strength).toBeGreaterThan(0);
  });

  it('generates annual heatmap correctly', () => {
    const habit = engine.createHabit({ name: 'Treino' });
    const year = 2026;
    const testDate = '2026-05-15';

    engine.toggleHabitDay(habit.id, testDate);
    const heatmap = engine.getHabitHeatmap(habit.id, year);

    expect(heatmap[testDate]).toBeDefined();
    expect(heatmap[testDate].completed).toBe(true);
    expect(heatmap['2026-05-16']).toBeUndefined();
  });

  it('provides accurate overview metrics for the header banner', () => {
    const h1 = engine.createHabit({ name: 'H1' });
    const h2 = engine.createHabit({ name: 'H2' });
    const today = engine.getTodayDateString();

    // Conclui apenas 1 dos 2
    engine.toggleHabitDay(h1.id, today);

    const overview = engine.getHabitsOverview();
    expect(overview.total).toBe(2);
    expect(overview.completedToday).toBe(1);
    expect(overview.percentToday).toBe(50);
    expect(overview.bestStreak).toBe(1);
    expect(overview.bestHabitName).toBe('H1');
  });
});
