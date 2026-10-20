import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../electron/database.cjs';
import { FinancialService } from '../electron/services.cjs';
import { levelFromXp, titleForLevel, weekStart } from '../electron/gamificationEngine.cjs';

function monthKeyOffset(delta: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

describe('Gamification (Pigo RPG Financeiro)', () => {
  let db: any;
  let service: any;

  beforeEach(() => {
    db = initDatabase(':memory:');
    service = new FinancialService(db);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('uses a progressive level curve with titles', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100 });
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(250).level).toBe(3);
    expect(levelFromXp(249)).toEqual({ level: 2, xpIntoLevel: 149, xpForNext: 150 });
    expect(titleForLevel(1)).toBe('Porquinho Curioso');
    expect(titleForLevel(12)).toBe('Estrategista Financeiro');
    expect(weekStart('2026-10-08')).toBe('2026-10-05');
  });

  it('starts at level 1 with an empty database', () => {
    const o = service.getGameOverview();
    expect(o.level).toBe(1);
    expect(o.achievements.every((a: any) => !a.unlocked)).toBe(true);
  });

  it('derives XP retroactively from imports, categorization, positive months and reserve', () => {
    const acc = service.createAccount({ name: 'Conta', type: 'checking', initialBalance: 0 });
    service.saveImportedStatement({ originalName: 'extrato.ofx', fileType: 'ofx', content: '<OFX/>' });

    const months = [monthKeyOffset(-3), monthKeyOffset(-2), monthKeyOffset(-1)];
    for (const m of months) {
      service.createTransaction({ accountId: acc.id, categoryId: 'cat_salario', type: 'income', description: 'Salário', amount: 500000, transactionDate: `${m}-05`, status: 'completed' });
      service.createTransaction({ accountId: acc.id, categoryId: 'cat_moradia', type: 'expense', description: 'Aluguel', amount: 200000, transactionDate: `${m}-10`, status: 'completed' });
      service.createTransaction({ accountId: acc.id, categoryId: 'cat_investimentos', type: 'expense', description: 'Aplicacao CDB', amount: 100000, transactionDate: `${m}-15`, status: 'completed' });
    }

    const o = service.getGameOverview();
    expect(o.xpByKind.import).toBe(50);
    expect(o.xpByKind.categorize).toBe(9 * 2);
    expect(o.xpByKind.month).toBe(3 * 200);
    expect(o.xpByKind.reserve).toBeGreaterThanOrEqual(3 * 50);
    expect(o.streaks.positiveMonths.current).toBe(3);

    const unlocked = o.achievements.filter((a: any) => a.unlocked).map((a: any) => a.id);
    expect(unlocked).toEqual(expect.arrayContaining(['primeiro_extrato', 'mes_azul', 'azul_3', 'primeira_reserva']));
    expect(o.level).toBeGreaterThan(5);
  });

  it('generates three weekly missions and keeps them stable during the week', () => {
    const acc = service.createAccount({ name: 'Conta', type: 'checking', initialBalance: 0 });
    for (let i = 1; i <= 40; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      service.createTransaction({ accountId: acc.id, categoryId: 'cat_alimentacao', type: 'expense', description: `Mercado ${i}`, amount: 8000, transactionDate: d.toISOString().slice(0, 10), status: 'completed' });
    }
    const first = service.getGameOverview().missions.current;
    expect(first).toHaveLength(3);
    expect(first[0].id).toBe('spend_cap');
    const again = service.getGameOverview().missions.current;
    expect(again.map((m: any) => m.title)).toEqual(first.map((m: any) => m.title));
  });

  it('celebrates only new unlocks after the first run', () => {
    const firstRun = service.getGameUnlocks();
    expect(firstRun.firstRun).toBe(true);
    expect(firstRun.unlocks).toHaveLength(0);

    service.saveImportedStatement({ originalName: 'novo.ofx', fileType: 'ofx', content: '<OFX/>' });
    const next = service.getGameUnlocks();
    expect(next.firstRun).toBe(false);
    expect(next.unlocks.some((u: any) => u.type === 'achievement' && u.id === 'primeiro_extrato')).toBe(true);
    expect(service.getGameUnlocks().unlocks).toHaveLength(0);
  });


  it('has calibrated XP and a comprehensive catalog of achievements', () => {
    const o = service.getGameOverview();
    expect(o.achievements.length).toBeGreaterThanOrEqual(70);
    
    // Check rarity XP values
    const comum = o.achievements.filter((a: any) => a.rarity === 'comum');
    const raro = o.achievements.filter((a: any) => a.rarity === 'raro');
    const epico = o.achievements.filter((a: any) => a.rarity === 'epico');
    const lendario = o.achievements.filter((a: any) => a.rarity === 'lendario');

    expect(comum.length).toBeGreaterThan(0);
    expect(raro.length).toBeGreaterThan(0);
    expect(epico.length).toBeGreaterThan(0);
    expect(lendario.length).toBeGreaterThan(0);

    expect(comum[0].xp).toBe(15);
    expect(raro[0].xp).toBe(35);
    expect(epico[0].xp).toBe(75);
    expect(lendario[0].xp).toBe(150);

    // Verify categories are present
    const categories = new Set(o.achievements.map((a: any) => a.category));
    expect(categories.has('imports')).toBe(true);
    expect(categories.has('categorization')).toBe(true);
    expect(categories.has('habits')).toBe(true);
    expect(categories.has('goals')).toBe(true);
    expect(categories.has('positive_months')).toBe(true);
  });

  it('awards real-time XP for habit check-ins and Perfect Habit Day bonus', () => {
    const h1 = service.habits.createHabit({ name: 'Beber Água', category: 'saude' });
    const h2 = service.habits.createHabit({ name: 'Zero Gasto Impulsivo', category: 'financas' });
    const today = new Date().toISOString().slice(0, 10);

    service.habits.toggleHabitDay(h1.id, today);
    let o = service.getGameOverview();
    expect(o.xpByKind.habit).toBe(5);

    service.habits.toggleHabitDay(h2.id, today);
    o = service.getGameOverview();
    // 2 check-ins (2 * 5 = 10) + Perfect Day bonus (25) = 35 XP
    expect(o.xpByKind.habit).toBe(35);
    const unlockedIds = o.achievements.filter((a: any) => a.unlocked).map((a: any) => a.id);
    expect(unlockedIds).toEqual(expect.arrayContaining(['habito_primeiro', 'habito_checkin_1']));
  });
  it('translates finances into the kingdom world state', () => {
    const acc = service.createAccount({ name: 'Nubank', type: 'checking', initialBalance: 100000, color: '#8b5cf6' });
    const savings = service.createAccount({ name: 'Caixinha', type: 'savings', initialBalance: 0 });
    const card = service.createCreditCard({ name: 'Visa', creditLimit: 500000, closingDay: 5, dueDay: 12 });
    service.createTransaction({ creditCardId: card.id, type: 'expense', description: 'Compra', amount: 50000, transactionDate: new Date().toISOString().slice(0, 10), status: 'completed' });
    service.createTransaction({ accountId: acc.id, type: 'expense', description: 'Sem categoria', amount: 1000, transactionDate: new Date().toISOString().slice(0, 10), status: 'completed' });
    service.createGoal({ name: 'Viagem', targetAmount: 100000, currentAmount: 25000 });

    const world = service.getGameWorld();
    expect(world.buildings.map((b: any) => b.name)).toEqual(['Caixinha', 'Nubank']);
    expect(world.dragon.present).toBe(true);
    expect(world.dragon.debt).toBe(50000);
    expect(world.dragon.utilization).toBe(10);
    expect(world.warehouse.uncategorized).toBeGreaterThanOrEqual(1);
    expect(world.constructions[0].progress).toBe(25);
    expect(['sunny', 'cloudy', 'rain']).toContain(world.weather);
    expect(world.walls.targetMonths).toBe(6);
    expect(savings.id).toBeTruthy();
  });
});
