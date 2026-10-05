import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../electron/database.cjs';
import { FinancialIntelligenceEngine, tokenizeText, cleanMerchantName, isReserveDescription } from '../electron/intelligenceEngine.cjs';
import { getFinancialService } from '../electron/services.cjs';

describe('FinancialIntelligenceEngine (100% Offline Local AI)', () => {
  let db: any;
  let service: any;
  let engine: FinancialIntelligenceEngine;

  beforeEach(() => {
    db = initDatabase(':memory:');
    service = getFinancialService(db);
    engine = new FinancialIntelligenceEngine(db);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('tokenizes text and extracts clean merchant names properly', () => {
    const raw = 'PAG* IFOOD 1234 SP BRASIL';
    const tokens = tokenizeText(raw);
    expect(tokens).toContain('IFOOD');

    const clean = cleanMerchantName('COMPRA CARTAO NETFLIX COM BR');
    expect(clean).toContain('NETFLIX');
  });

  it('calculates financial health score with all 5 pillars', () => {
    const acc = service.createAccount({
      name: 'Conta Corrente',
      type: 'checking',
      initialBalance: 500000, // R$ 5.000,00
    });

    const catSalario = service.createCategory({ name: 'Salário', type: 'income' });
    const catAlimentacao = service.createCategory({ name: 'Alimentação', type: 'expense' });

    // Income: R$ 4.000,00
    service.createTransaction({
      accountId: acc.id,
      categoryId: catSalario.id,
      type: 'income',
      description: 'Salário Empresa',
      amount: 400000,
      transactionDate: '2026-09-05',
      status: 'completed',
    });

    // Expense: R$ 1.500,00
    service.createTransaction({
      accountId: acc.id,
      categoryId: catAlimentacao.id,
      type: 'expense',
      description: 'Supermercado',
      amount: 150000,
      transactionDate: '2026-09-10',
      status: 'completed',
    });

    const health = engine.getFinancialHealthScore('2026-09-14');
    expect(health.score).toBeGreaterThanOrEqual(60);
    expect(health.pillars).toHaveLength(5);
    expect(['Excelente', 'Boa']).toContain(health.classification);
  });

  it('projects balance forecast and identifies positive cash flow', () => {
    const acc = service.createAccount({
      name: 'Banco Digital',
      type: 'checking',
      initialBalance: 200000, // R$ 2.000,00
    });

    // Histórico importado: salário todo dia 5 e aluguel todo dia 10 nos últimos 3 meses
    const now = new Date();
    for (let i = 3; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      service.createTransaction({
        accountId: acc.id, type: 'income', description: 'SALARIO EMPRESA XYZ',
        amount: 300000, transactionDate: `${monthKey}-05`, status: 'completed',
      });
      service.createTransaction({
        accountId: acc.id, type: 'expense', description: 'ALUGUEL IMOBILIARIA',
        amount: 120000, transactionDate: `${monthKey}-10`, status: 'completed',
      });
    }

    const forecast = engine.getBalanceForecast(60);
    expect(forecast.daysAhead).toBe(60);
    expect(forecast.currentBalance).toBe(200000 + 3 * 300000 - 3 * 120000);
    expect(forecast.dailyTrajectory.length).toBeGreaterThan(50);
    const projectedTitles = forecast.dailyTrajectory.flatMap((d: any) => d.events.map((e: any) => e.title));
    expect(projectedTitles.some((t: string) => t.includes('SALARIO'))).toBe(true);
    expect(projectedTitles.some((t: string) => t.includes('ALUGUEL'))).toBe(true);
    expect(forecast.finalBalance).toBeGreaterThan(forecast.currentBalance);
  });

  it('detects statistical anomalies and duplicate charges', () => {
    const acc = service.createAccount({ name: 'Conta Principal', type: 'checking', initialBalance: 1000000 });
    const cat = service.createCategory({ name: 'Farmácia', type: 'expense' });

    // Normal transactions: around R$ 40 - 60
    for (let i = 1; i <= 6; i++) {
      service.createTransaction({
        accountId: acc.id,
        categoryId: cat.id,
        type: 'expense',
        description: `Farmácia Compra ${i}`,
        amount: 4500 + i * 200,
        transactionDate: `2026-09-0${i}`,
        status: 'completed',
      });
    }

    // Extreme outlier: R$ 950,00 (95000 cents)
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'Farmácia Compra Medicamento Especial',
      amount: 95000,
      transactionDate: '2026-09-12',
      status: 'completed',
    });

    // Duplicate charge within 24h: 2x R$ 39,90
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'Drogaria Duplicada',
      amount: 3990,
      transactionDate: '2026-09-13',
      status: 'completed',
    });
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'Drogaria Duplicada',
      amount: 3990,
      transactionDate: '2026-09-14',
      status: 'completed',
    });

    const anomalies = engine.detectAnomalies(6);
    expect(anomalies.length).toBeGreaterThanOrEqual(2);

    const dup = anomalies.find(a => a.anomalyType === 'duplicate_charge');
    expect(dup).toBeDefined();

    const outlier = anomalies.find(a => a.anomalyType === 'statistical_outlier');
    expect(outlier).toBeDefined();
    expect(outlier?.amount).toBe(95000);
  });

  it('suggests category intelligently based on tokens and rules', () => {
    const acc = service.createAccount({ name: 'Conta', type: 'checking', initialBalance: 100000 });
    const cat = service.createCategory({ name: 'Transporte', type: 'expense' });

    // Add historical transactions for UBER
    service.createTransaction({
      accountId: acc.id,
      type: 'expense',
      categoryId: cat.id,
      description: 'UBER *TRIP RIO',
      amount: 2500,
      transactionDate: '2026-09-01',
      status: 'completed',
    });

    const suggestion = engine.suggestCategory('UBER TRIP SÃO PAULO');
    expect(suggestion).not.toBeNull();
    expect(suggestion?.categoryName).toBe('Transporte');
    expect(suggestion?.confidence).toBeGreaterThan(60);
  });

  it('detects recurring subscription candidates automatically', () => {
    const acc = service.createAccount({ name: 'Conta', type: 'checking', initialBalance: 500000 });
    const cat = service.createCategory({ name: 'Serviços Online', type: 'expense' });

    // Monthly subscription: Spotify R$ 21,90 for 3 consecutive months
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'SPOTIFY BRASIL',
      amount: 2190,
      transactionDate: '2026-07-10',
      status: 'completed',
    });
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'SPOTIFY BRASIL',
      amount: 2190,
      transactionDate: '2026-08-10',
      status: 'completed',
    });
    service.createTransaction({
      accountId: acc.id,
      categoryId: cat.id,
      type: 'expense',
      description: 'SPOTIFY BRASIL',
      amount: 2190,
      transactionDate: '2026-09-10',
      status: 'completed',
    });

    const candidates = engine.detectRecurringPatterns();
    expect(candidates.length).toBeGreaterThanOrEqual(1);

    const spotify = candidates.find(c => c.cleanDescription.includes('SPOTIFY'));
    expect(spotify).toBeDefined();
    expect(spotify?.suggestedFrequency).toBe('monthly');
    expect(spotify?.averageAmount).toBe(2190);
    expect(spotify?.type).toBe('expense');
  });

  it('generates monthly closeout summary with MoM comparisons', () => {
    const acc = service.createAccount({ name: 'Conta', type: 'checking', initialBalance: 500000 });
    const catAluguel = service.createCategory({ name: 'Moradia', type: 'expense' });
    const catSalario = service.createCategory({ name: 'Salário', type: 'income' });

    service.createTransaction({
      accountId: acc.id,
      categoryId: catSalario.id,
      type: 'income',
      description: 'Salário',
      amount: 500000,
      transactionDate: '2026-09-05',
      status: 'completed',
    });

    service.createTransaction({
      accountId: acc.id,
      categoryId: catAluguel.id,
      type: 'expense',
      description: 'Aluguel Apartamento',
      amount: 180000,
      transactionDate: '2026-09-08',
      status: 'completed',
    });

    const closeout = engine.getMonthlyCloseout('2026-09');
    expect(closeout.incomeTotal).toBe(500000);
    expect(closeout.expenseTotal).toBe(180000);
    expect(closeout.savedAmount).toBe(320000);
    expect(closeout.savingsRate).toBe(64);
    expect(closeout.topCategories[0].name).toBe('Moradia');
    expect(closeout.achievements.length).toBeGreaterThan(0);
  });

  it('tracks the financial reserve inside the monthly closeout', () => {
    const checking = service.createAccount({ name: 'Conta Corrente', type: 'checking', initialBalance: 0 });
    const savings = service.createAccount({ name: 'Poupança', type: 'savings', initialBalance: 300000 });

    for (const [monthKey, reserveIn] of [['2026-06', 0], ['2026-07', 50000], ['2026-08', 50000], ['2026-09', 100000]] as const) {
      service.createTransaction({ accountId: checking.id, type: 'income', description: 'Salário', amount: 500000, transactionDate: `${monthKey}-05`, status: 'completed' });
      service.createTransaction({ accountId: checking.id, type: 'expense', description: 'Despesas do mês', amount: 200000, transactionDate: `${monthKey}-12`, status: 'completed' });
      if (reserveIn > 0) {
        service.createTransaction({ accountId: checking.id, destinationAccountId: savings.id, type: 'transfer', description: 'Aporte reserva', amount: reserveIn, transactionDate: `${monthKey}-20`, status: 'completed' });
      }
    }

    const closeout = engine.getMonthlyCloseout('2026-09');
    const reserve = closeout.reserve;
    expect(reserve.accounts.find((a: any) => a.id === savings.id)?.isReserve).toBe(true);
    expect(reserve.balance).toBe(500000);
    expect(reserve.monthContribution).toBe(100000);
    expect(reserve.monthlyCost).toBe(200000);
    expect(reserve.targetAmount).toBe(1200000);
    expect(reserve.coverageMonths).toBe(2.5);
    expect(reserve.status).toBe('building');
    expect(reserve.suggestedContribution).toBeGreaterThan(0);
    expect(closeout.recommendations.some((r: any) => r.type === 'reserve')).toBe(true);
    expect(closeout.previousMonthKey).toBe('2026-08');

    // User picks a different reserve setup: 3 months target and checking account only
    service.updateSettings({ reserveTargetMonths: 3, reserveAccountIds: [checking.id] });
    const custom = engine.getMonthlyCloseout('2026-09').reserve;
    expect(custom.targetMonths).toBe(3);
    expect(custom.usingDefaultAccounts).toBe(false);
    expect(custom.accounts.find((a: any) => a.id === savings.id)?.isReserve).toBe(false);
  });

  it('counts expenses in investment categories as reserve contributions, not cost of living', () => {
    const checking = service.createAccount({ name: 'Nubank', type: 'checking', initialBalance: 0 });
    const catInvest = service.createCategory({ name: 'Investimentos CDB', type: 'expense' });

    for (const monthKey of ['2026-07', '2026-08', '2026-09']) {
      service.createTransaction({ accountId: checking.id, type: 'income', description: 'Salário', amount: 600000, transactionDate: `${monthKey}-05`, status: 'completed' });
      service.createTransaction({ accountId: checking.id, type: 'expense', description: 'Gastos', amount: 300000, transactionDate: `${monthKey}-10`, status: 'completed' });
      service.createTransaction({ accountId: checking.id, categoryId: catInvest.id, type: 'expense', description: 'PIX CORRETORA', amount: 100000, transactionDate: `${monthKey}-15`, status: 'completed' });
    }
    service.updateSettings({ reserveInitialAmount: 50000 });

    const reserve = engine.getMonthlyCloseout('2026-09').reserve;
    expect(reserve.categories.find((c: any) => c.id === catInvest.id)?.isReserve).toBe(true);
    expect(reserve.monthlyCost).toBe(300000);
    expect(reserve.balance).toBe(50000 + 3 * 100000);
    expect(reserve.monthContribution).toBe(100000);
  });

  it('detects investment applications and redemptions from statement text', () => {
    expect(isReserveDescription('Cdb Porquinho Banco Inter S A Aplicacao: "CDB PORQUINHO"')).toBe(true);
    expect(isReserveDescription('Vencimento Renda Fixa: "CDB POS DI LIQ."')).toBe(true);
    expect(isReserveDescription('RESGATE CAIXINHA NUBANK')).toBe(true);
    expect(isReserveDescription('Rendimento CDB')).toBe(false);
    expect(isReserveDescription('IFOOD *RESTAURANTE')).toBe(false);

    const checking = service.createAccount({ name: 'Inter', type: 'checking', initialBalance: 1000000 });
    // Redemption of money saved before the first imported statement, then a new application
    service.createTransaction({ accountId: checking.id, type: 'income', description: 'Vencimento Renda Fixa CDB', amount: 200000, transactionDate: '2026-08-31', status: 'completed' });
    service.createTransaction({ accountId: checking.id, type: 'expense', description: 'Aplicacao CDB Porquinho', amount: 150000, transactionDate: '2026-09-08', status: 'completed' });
    service.createTransaction({ accountId: checking.id, type: 'expense', description: 'Mercado', amount: 100000, transactionDate: '2026-09-10', status: 'completed' });

    const reserve = engine.getReserveOverview('2026-09');
    expect(reserve.initialAmountEstimated).toBe(true);
    expect(reserve.initialAmount).toBe(200000);
    expect(reserve.balance).toBe(150000);
    expect(reserve.monthAportes).toBe(150000);
    expect(reserve.movements).toHaveLength(2);
    expect(reserve.history).toHaveLength(12);

    // User says the application was not a reserve movement
    const aplicacao = reserve.movements.find((m: any) => m.kind === 'aporte');
    service.setReserveTransactionExcluded(aplicacao.id, true);
    expect(engine.getReserveOverview('2026-09').balance).toBe(0);
  });

  it('registers reserve contributions as transfer or categorized expense', () => {
    const checking = service.createAccount({ name: 'Nubank', type: 'checking', initialBalance: 500000 });
    const savings = service.createAccount({ name: 'Caixinha', type: 'savings', initialBalance: 0 });

    service.registerReserveMovement({ kind: 'aporte', amount: 40000, accountId: checking.id, reserveAccountId: savings.id, date: '2026-09-10' });
    service.registerReserveMovement({ kind: 'resgate', amount: 10000, accountId: checking.id, reserveAccountId: savings.id, date: '2026-09-20' });
    let reserve = engine.getReserveOverview('2026-09');
    expect(reserve.balance).toBe(30000);
    expect(reserve.movements.filter((m: any) => m.source === 'transfer')).toHaveLength(2);

    // Reserve held outside the app (CDB): expense in the reserve category
    const cat = service.createCategory({ name: 'Investimentos CDB', type: 'expense' });
    service.registerReserveMovement({ kind: 'aporte', amount: 25000, accountId: checking.id, categoryId: cat.id, date: '2026-09-25' });
    reserve = engine.getReserveOverview('2026-09');
    expect(reserve.balance).toBe(55000);
  });
});
