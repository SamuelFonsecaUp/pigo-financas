/**
 * Financial Intelligence Engine (100% Local & Offline)
 * 
 * Centraliza toda a modelagem matemática, estatística determinística (IQR, Z-Score,
 * médias móveis, análise de séries temporais) e mineração de padrões de texto
 * para fornecer inteligência financeira sem requisições externas ou APIs.
 */

// Helper functions for date arithmetic
function parseDate(dateStr) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function getMonthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function addMonthsToKey(monthKey, deltaMonths) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Statistical helper functions
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((acc, val) => acc + val, 0) / arr.length;
}

function stdDev(arr, arrMean = null) {
  if (!arr || arr.length <= 1) return 0;
  const m = arrMean !== null ? arrMean : mean(arr);
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

function median(sortedArr) {
  return percentile(sortedArr, 50);
}

// Text normalization & tokenization for category prediction and merchant pattern matching
const STOP_WORDS = new Set([
  'LTDA', 'SA', 'S/A', 'ME', 'EPP', 'PAG', 'PG', 'PAGAMENTO', 'PAGTO', 'PAGAMENTOS',
  'COMPRA', 'DEB', 'CRE', 'DOC', 'TED', 'PIX', 'TRANSF', 'TRANSFERENCIA', 'ENVIO',
  'RECEBIMENTO', 'CARTAO', 'ELO', 'VISA', 'MASTERCARD', 'MASTER', 'HIPERCARD',
  'ESTABELECIMENTO', 'MERCADO', 'LOJA', 'COMERCIO', 'SERVICOS', 'BRASIL', 'BR',
  'ONLINE', 'APP', 'PAY', 'PAYMENT', 'INTERNET', 'AUTOMATICO', 'DEBITO', 'CREDITO',
  'BANCO', 'FINANCEIRA', 'OPERACAO', 'VALOR', 'REF', 'PARC', 'PARCELA'
]);

function tokenizeText(text) {
  if (!text) return [];
  // Remove accents and special characters
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ');

  // Split and filter tokens
  const rawTokens = normalized.split(/\s+/).filter(t => t.length >= 3 && !/^\d+$/.test(t));
  return rawTokens.filter(t => !STOP_WORDS.has(t));
}

// Reconhece aplicações/resgates de investimentos pelo texto do extrato
const RESERVE_TEXT_PATTERN = /\b(APLICACAO|APLIC|RESGATE|CDB|LCI|LCA|TESOURO|CAIXINHA|PORQUINHO|POUPANCA|RENDA FIXA|RESERVA|COFRINHO)\b/;
const RESERVE_TEXT_EXCLUDE = /\b(RENDIMENTO|RENDIMENTOS|JUROS|IOF)\b/;

function isReserveDescription(text) {
  if (!text) return false;
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return RESERVE_TEXT_PATTERN.test(normalized) && !RESERVE_TEXT_EXCLUDE.test(normalized);
}

function cleanMerchantName(rawText) {
  if (!rawText) return '';
  let cleaned = rawText
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(PIX|PAG\*|PG\*|COMPRA CARTAO|PAGTO|TED|DOC|PARC\s*\d+\/\d+)/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim();

  // Compress multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  // Remove known stop words at boundaries
  const words = cleaned.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return words.slice(0, 3).join(' ') || rawText.trim().toUpperCase();
}

class FinancialIntelligenceEngine {
  constructor(db) {
    this.db = db;
  }

  // ==========================================
  // 1. SAÚDE FINANCEIRA (0 a 100)
  // ==========================================
  getFinancialHealthScore(targetDate = null) {
    const today = targetDate || new Date().toISOString().slice(0, 10);
    const currentMonthKey = getMonthKey(today);
    const prevMonthKey = addMonthsToKey(currentMonthKey, -1);
    const prev2MonthKey = addMonthsToKey(currentMonthKey, -2);

    // 1.1 Income & Expense stats (last 3 months rolling average)
    const windowMonths = [currentMonthKey, prevMonthKey, prev2MonthKey];
    const placeholders = windowMonths.map(() => '?').join(',');

    const incomeRows = this.db.prepare(`
      SELECT strftime('%Y-%m', transaction_date) as month_key, SUM(amount) as total
      FROM transactions
      WHERE type = 'income' AND status = 'completed'
        AND strftime('%Y-%m', transaction_date) IN (${placeholders})
      GROUP BY strftime('%Y-%m', transaction_date)
    `).all(...windowMonths);

    const expenseRows = this.db.prepare(`
      SELECT 
        COALESCE(invoice_month, strftime('%Y-%m', transaction_date)) as month_key,
        SUM(amount) as total
      FROM transactions
      WHERE type = 'expense' AND status != 'cancelled'
        AND COALESCE(invoice_month, strftime('%Y-%m', transaction_date)) IN (${placeholders})
      GROUP BY month_key
    `).all(...windowMonths);

    const totalIncome3m = incomeRows.reduce((sum, r) => sum + r.total, 0);
    const totalExpense3m = expenseRows.reduce((sum, r) => sum + r.total, 0);
    const avgMonthlyIncome = Math.round(totalIncome3m / (incomeRows.length || 1));
    const avgMonthlyExpense = Math.round(totalExpense3m / (expenseRows.length || 1));

    // Current month specific
    const curIncome = incomeRows.find(r => r.month_key === currentMonthKey)?.total || 0;
    const curExpense = expenseRows.find(r => r.month_key === currentMonthKey)?.total || 0;
    const effectiveIncome = curIncome > 0 ? curIncome : avgMonthlyIncome;
    const effectiveExpense = curExpense > 0 ? curExpense : avgMonthlyExpense;

    // --- PILAR 1: Capacidade de Poupança (0 a 30 pts) ---
    let savingsScore = 15;
    let savingsRate = 0;
    let savingsDiagnostic = '';

    if (effectiveIncome > 0) {
      savingsRate = (effectiveIncome - effectiveExpense) / effectiveIncome;
      if (savingsRate >= 0.25) {
        savingsScore = 30;
        savingsDiagnostic = `Excelente taxa de poupança (${(savingsRate * 100).toFixed(0)}%). Você guarda mais de 25% da renda.`;
      } else if (savingsRate >= 0.15) {
        savingsScore = 24 + Math.round(((savingsRate - 0.15) / 0.10) * 5);
        savingsDiagnostic = `Boa capacidade de poupança (${(savingsRate * 100).toFixed(0)}%). Continue acumulando.`;
      } else if (savingsRate >= 0.05) {
        savingsScore = 16 + Math.round(((savingsRate - 0.05) / 0.10) * 7);
        savingsDiagnostic = `Taxa de economia moderada (${(savingsRate * 100).toFixed(0)}%). Tente cortar pequenos supérfluos para atingir 15%.`;
      } else if (savingsRate >= 0) {
        savingsScore = 10 + Math.round((savingsRate / 0.05) * 5);
        savingsDiagnostic = `Sua margem de economia está muito apertada (${(savingsRate * 100).toFixed(0)}%).`;
      } else {
        // Déficit
        const deficitPercent = Math.min(0.5, Math.abs(savingsRate));
        savingsScore = Math.max(0, Math.round(10 - (deficitPercent / 0.5) * 10));
        savingsDiagnostic = `Atenção: Gastos superaram a renda no período em ${(Math.abs(savingsRate) * 100).toFixed(0)}%. Risco de endividamento.`;
      }
    } else {
      savingsScore = effectiveExpense === 0 ? 15 : 5;
      savingsDiagnostic = 'Pouca movimentação de receitas registrada para cálculo preciso.';
    }

    // --- PILAR 2: Custos Fixos & Recorrentes (0 a 25 pts) ---
    // Custos fixos aprendidos dos extratos importados (assinaturas, contas mensais etc.)
    const recurringExpenses = this.getLearnedFixedCosts(today);

    let recurringScore = 20;
    let recurringDiagnostic = '';
    const referenceIncome = effectiveIncome > 0 ? effectiveIncome : 300000; // default 3k base if empty
    const recurringRatio = recurringExpenses / referenceIncome;

    if (recurringExpenses === 0) {
      recurringScore = 22;
      recurringDiagnostic = 'Nenhum custo fixo identificado no histórico ainda. Importe mais extratos para o Pigo aprender seus padrões.';
    } else if (recurringRatio <= 0.35) {
      recurringScore = 25;
      recurringDiagnostic = `Custos fixos sob controle (${(recurringRatio * 100).toFixed(0)}% da renda). Excelente flexibilidade orçamentária.`;
    } else if (recurringRatio <= 0.50) {
      recurringScore = 19 + Math.round(((0.50 - recurringRatio) / 0.15) * 5);
      recurringDiagnostic = `Custos fixos saudáveis (${(recurringRatio * 100).toFixed(0)}% da renda), dentro do limite recomendado de 50%.`;
    } else if (recurringRatio <= 0.70) {
      recurringScore = 10 + Math.round(((0.70 - recurringRatio) / 0.20) * 8);
      recurringDiagnostic = `Comprometimento alto (${(recurringRatio * 100).toFixed(0)}% da renda com fixos). Sobra pouco espaço para imprevistos.`;
    } else {
      recurringScore = Math.max(0, Math.round(10 - ((recurringRatio - 0.70) / 0.30) * 10));
      recurringDiagnostic = `Alerta Crítico: ${(recurringRatio * 100).toFixed(0)}% da sua renda está engessada em contas fixas e assinaturas.`;
    }

    // --- PILAR 3: Endividamento & Cartões de Crédito (0 a 20 pts) ---
    const cards = this.db.prepare(`SELECT * FROM credit_cards WHERE active = 1`).all();
    let debtScore = 20;
    let debtDiagnostic = '';

    if (cards.length === 0) {
      debtScore = 20;
      debtDiagnostic = 'Sem faturas de cartão de crédito ativas.';
    } else {
      const totalLimit = cards.reduce((s, c) => s + c.credit_limit, 0);
      const pendingInvoices = this.db.prepare(`
        SELECT SUM(amount) as total
        FROM transactions
        WHERE credit_card_id IS NOT NULL
          AND status != 'cancelled'
          AND status != 'paid'
      `).get().total || 0;

      const limitUtilization = totalLimit > 0 ? (pendingInvoices / totalLimit) : 0;

      if (limitUtilization <= 0.20) {
        debtScore = 20;
        debtDiagnostic = `Uso inteligente do crédito (${(limitUtilization * 100).toFixed(0)}% do limite utilizado).`;
      } else if (limitUtilization <= 0.40) {
        debtScore = 16 + Math.round(((0.40 - limitUtilization) / 0.20) * 3);
        debtDiagnostic = `Utilização equilibrada do cartão (${(limitUtilization * 100).toFixed(0)}% do limite).`;
      } else if (limitUtilization <= 0.65) {
        debtScore = 10 + Math.round(((0.65 - limitUtilization) / 0.25) * 5);
        debtDiagnostic = `Atenção: ${(limitUtilization * 100).toFixed(0)}% do limite do cartão está comprometido. Evite novos parcelamentos.`;
      } else {
        debtScore = Math.max(0, Math.round(9 - ((limitUtilization - 0.65) / 0.35) * 9));
        debtDiagnostic = `Alerta: ${(limitUtilization * 100).toFixed(0)}% do limite utilizado. Alto risco de juros e comprometimento de fluxo.`;
      }
    }

    // --- PILAR 4: Cobertura de Reserva de Emergência (0 a 15 pts) ---
    const accounts = this.db.prepare(`SELECT id, initial_balance, type FROM accounts WHERE active = 1`).all();
    let totalLiquidBalance = 0;

    for (const acc of accounts) {
      const inc = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type = 'income' AND status = 'completed'
      `).get(acc.id).s;

      const exp = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type IN ('expense', 'card_payment') AND status = 'completed'
      `).get(acc.id).s;

      const transfOut = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type = 'transfer' AND status = 'completed'
      `).get(acc.id).s;

      const transfIn = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE destination_account_id = ? AND type = 'transfer' AND status = 'completed'
      `).get(acc.id).s;

      totalLiquidBalance += (acc.initial_balance + inc + transfIn - exp - transfOut);
    }

    let reserveScore = 8;
    let reserveMonths = 0;
    let reserveDiagnostic = '';
    const monthlyBurnRate = avgMonthlyExpense > 0 ? avgMonthlyExpense : (effectiveExpense > 0 ? effectiveExpense : 200000);
    const reserveAccounts = this.getReserveAccounts();
    const reserveBase = reserveAccounts.length > 0
      ? reserveAccounts.reduce((sum, acc) => sum + this.getAccountBalanceAt(acc.id, today), 0)
      : totalLiquidBalance;

    if (reserveBase < 0) {
      reserveScore = 0;
      reserveMonths = 0;
      reserveDiagnostic = 'Saldo líquido total negativo. Priorize a regularização de saldos devedores.';
    } else {
      reserveMonths = reserveBase / monthlyBurnRate;
      if (reserveMonths >= 6) {
        reserveScore = 15;
        reserveDiagnostic = `Excelente reserva (${reserveMonths.toFixed(1)} meses de despesas cobertas). Você tem segurança financeira sólida.`;
      } else if (reserveMonths >= 3) {
        reserveScore = 11 + Math.round(((reserveMonths - 3) / 3) * 3);
        reserveDiagnostic = `Boa reserva (${reserveMonths.toFixed(1)} meses de custos). Continue aportando para chegar a 6 meses.`;
      } else if (reserveMonths >= 1) {
        reserveScore = 6 + Math.round(((reserveMonths - 1) / 2) * 4);
        reserveDiagnostic = `Reserva inicial (${reserveMonths.toFixed(1)} mês de cobertura). Recomenda-se aumentar a margem de segurança.`;
      } else {
        reserveScore = Math.max(1, Math.round(reserveMonths * 5));
        reserveDiagnostic = `Reserva crítica (cobre apenas ${(reserveMonths * 30).toFixed(0)} dias de despesas). Qualquer imprevisto exigirá crédito.`;
      }
    }

    // --- PILAR 5: Disciplina Orçamentária (0 a 10 pts) ---
    const budgets = this.db.prepare(`SELECT * FROM category_budgets`).all();
    let budgetScore = 8;
    let budgetDiagnostic = '';

    if (budgets.length === 0) {
      budgetScore = 8;
      budgetDiagnostic = 'Sem tetos de gastos cadastrados por categoria. Definir orçamentos ajuda a controlar despesas.';
    } else {
      let withinBudgetCount = 0;
      for (const b of budgets) {
        const spent = this.db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM transactions
          WHERE category_id = ? AND type = 'expense' AND status != 'cancelled'
            AND (
              (credit_card_id IS NULL AND transaction_date >= '${currentMonthKey}-01' AND transaction_date <= '${currentMonthKey}-31')
              OR (credit_card_id IS NOT NULL AND invoice_month = '${currentMonthKey}')
            )
        `).get(b.category_id).total;

        if (spent <= b.amount_limit) {
          withinBudgetCount++;
        }
      }

      const complianceRatio = withinBudgetCount / budgets.length;
      budgetScore = Math.round(complianceRatio * 10);
      budgetDiagnostic = `${withinBudgetCount} de ${budgets.length} categorias orçadas estão dentro do teto estipulado (${(complianceRatio * 100).toFixed(0)}%).`;
    }

    // Total Overall Score (0 to 100)
    const totalScore = Math.min(100, Math.max(0, savingsScore + recurringScore + debtScore + reserveScore + budgetScore));

    let classification = 'Atenção';
    let color = '#f59e0b';
    let message = 'Sua saúde financeira requer cuidados com despesas e reservas.';

    if (totalScore >= 80) {
      classification = 'Excelente';
      color = '#10b981';
      message = 'Parabéns! Suas finanças estão muito bem estruturadas, com poupança e reservas sólidas.';
    } else if (totalScore >= 65) {
      classification = 'Boa';
      color = '#3b82f6';
      message = 'Sua situação é estável e equilibrada. Pequenos ajustes podem acelerar a formação de patrimônio.';
    } else if (totalScore >= 45) {
      classification = 'Atenção';
      color = '#f59e0b';
      message = 'Alerta moderado: seus custos fixos ou gastos estão próximos da sua capacidade de renda.';
    } else {
      classification = 'Crítica';
      color = '#ef4444';
      message = 'Alerta máximo: há desequilíbrio entre receitas, despesas e faturas. Risco de endividamento.';
    }

    return {
      score: totalScore,
      classification,
      color,
      message,
      calculatedAt: today,
      metrics: {
        effectiveIncome,
        effectiveExpense,
        savingsRate: Math.round(savingsRate * 100),
        recurringTotal: recurringExpenses,
        totalLiquidBalance,
        reserveCoverageMonths: Number(reserveMonths.toFixed(1)),
      },
      pillars: [
        {
          id: 'savings',
          name: 'Capacidade de Poupança',
          score: savingsScore,
          maxScore: 30,
          weight: 30,
          status: savingsScore >= 24 ? 'excellent' : savingsScore >= 16 ? 'good' : 'warning',
          diagnostic: savingsDiagnostic,
        },
        {
          id: 'recurring',
          name: 'Custos Fixos & Recorrentes',
          score: recurringScore,
          maxScore: 25,
          weight: 25,
          status: recurringScore >= 20 ? 'excellent' : recurringScore >= 14 ? 'good' : 'warning',
          diagnostic: recurringDiagnostic,
        },
        {
          id: 'debt',
          name: 'Endividamento & Cartões',
          score: debtScore,
          maxScore: 20,
          weight: 20,
          status: debtScore >= 16 ? 'excellent' : debtScore >= 10 ? 'good' : 'warning',
          diagnostic: debtDiagnostic,
        },
        {
          id: 'reserve',
          name: 'Reserva de Emergência',
          score: reserveScore,
          maxScore: 15,
          weight: 15,
          status: reserveScore >= 12 ? 'excellent' : reserveScore >= 8 ? 'good' : 'warning',
          diagnostic: reserveDiagnostic,
        },
        {
          id: 'discipline',
          name: 'Disciplina Orçamentária',
          score: budgetScore,
          maxScore: 10,
          weight: 10,
          status: budgetScore >= 8 ? 'excellent' : budgetScore >= 5 ? 'good' : 'warning',
          diagnostic: budgetDiagnostic,
        },
      ],
    };
  }

  // ==========================================
  // 2. PREVISÃO DE SALDO (30, 60, 90 DIAS)
  // ==========================================
  getBalanceForecast(daysAhead = 90) {
    const today = new Date().toISOString().slice(0, 10);
    const endDate = addDays(today, daysAhead);

    // 2.1 Calculate current total liquid balance
    const accounts = this.db.prepare(`SELECT id, initial_balance FROM accounts WHERE active = 1`).all();
    let currentTotalBalance = 0;

    for (const acc of accounts) {
      const inc = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type = 'income' AND status = 'completed'
      `).get(acc.id).s;

      const exp = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type IN ('expense', 'card_payment') AND status = 'completed'
      `).get(acc.id).s;

      const transfOut = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE account_id = ? AND type = 'transfer' AND status = 'completed'
      `).get(acc.id).s;

      const transfIn = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM transactions
        WHERE destination_account_id = ? AND type = 'transfer' AND status = 'completed'
      `).get(acc.id).s;

      currentTotalBalance += (acc.initial_balance + inc + transfIn - exp - transfOut);
    }

    // 2.2 Pending one-time transactions scheduled in accounts
    const scheduledTxs = this.db.prepare(`
      SELECT transaction_date, type, amount, description
      FROM transactions
      WHERE status = 'pending'
        AND transaction_date >= ?
        AND transaction_date <= ?
        AND account_id IS NOT NULL
        AND credit_card_id IS NULL
      ORDER BY transaction_date ASC
    `).all(today, endDate);

    // 2.3 Padrões recorrentes aprendidos do histórico (receitas e despesas)
    const learnedPatterns = [
      ...this.detectRecurringPatterns('income'),
      ...this.detectRecurringPatterns('expense'),
    ].filter(p => p.isActive);

    // 2.4 Credit cards with due dates and their projected invoice amounts
    const cards = this.db.prepare(`SELECT * FROM credit_cards WHERE active = 1`).all();

    // Map of events by date
    const eventsByDate = new Map();
    const addEvent = (dateStr, event) => {
      if (!eventsByDate.has(dateStr)) {
        eventsByDate.set(dateStr, []);
      }
      eventsByDate.get(dateStr).push(event);
    };

    // Populate scheduled transactions
    for (const tx of scheduledTxs) {
      addEvent(tx.transaction_date, {
        title: tx.description,
        amount: tx.type === 'income' ? tx.amount : -tx.amount,
        type: tx.type,
      });
    }

    // Project learned patterns across the daysAhead window
    const todayParsed = parseDate(today);
    const endParsed = parseDate(endDate);

    for (const pattern of learnedPatterns) {
      const signedAmount = pattern.type === 'income' ? pattern.averageAmount : -pattern.averageAmount;
      const label = pattern.type === 'income' ? '(Receita prevista)' : '(Despesa prevista)';

      if (pattern.suggestedFrequency === 'monthly') {
        const billingDay = pattern.suggestedBillingDay;
        const last = parseDate(pattern.lastDate);
        const dayIn = (y, m) => new Date(y, m, Math.min(billingDay, new Date(y, m + 1, 0).getDate()));
        let monthOffset = 1;
        let cur = dayIn(last.getFullYear(), last.getMonth() + monthOffset);
        while (cur < todayParsed) {
          monthOffset++;
          cur = dayIn(last.getFullYear(), last.getMonth() + monthOffset);
        }
        while (cur <= endParsed) {
          addEvent(formatDate(cur), {
            title: `${label} ${pattern.cleanDescription}`,
            amount: signedAmount,
            type: pattern.type,
          });
          monthOffset++;
          cur = dayIn(last.getFullYear(), last.getMonth() + monthOffset);
        }
      } else if (pattern.suggestedFrequency === 'weekly') {
        let cur = parseDate(pattern.lastDate);
        cur.setDate(cur.getDate() + 7);
        while (cur < todayParsed) {
          cur.setDate(cur.getDate() + 7);
        }
        while (cur <= endParsed) {
          addEvent(formatDate(cur), {
            title: `${label} ${pattern.cleanDescription}`,
            amount: signedAmount,
            type: pattern.type,
          });
          cur.setDate(cur.getDate() + 7);
        }
      }
    }

    // Project credit card invoice payments on their due_days
    for (const card of cards) {
      const monthsSpan = Math.ceil(daysAhead / 30) + 1;
      let monthCursor = getMonthKey(today);

      for (let i = 0; i < monthsSpan; i++) {
        const invoiceTotal = this.db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM transactions
          WHERE credit_card_id = ?
            AND invoice_month = ?
            AND status != 'cancelled'
            AND status != 'paid'
        `).get(card.id, monthCursor).total;

        if (invoiceTotal > 0) {
          const [yr, mo] = monthCursor.split('-').map(Number);
          const maxDays = new Date(yr, mo, 0).getDate();
          const dueDayValid = Math.min(card.due_day, maxDays);
          const dueDateStr = `${yr}-${String(mo).padStart(2, '0')}-${String(dueDayValid).padStart(2, '0')}`;

          if (dueDateStr >= today && dueDateStr <= endDate) {
            addEvent(dueDateStr, {
              title: `Fatura ${card.name} (${monthCursor})`,
              amount: -invoiceTotal,
              type: 'card_invoice',
            });
          }
        }

        monthCursor = addMonthsToKey(monthCursor, 1);
      }
    }

    // Construct day-by-day trajectory
    const dailyTrajectory = [];
    let runningBalance = currentTotalBalance;
    let minBalance = currentTotalBalance;
    let minBalanceDate = today;
    let maxBalance = currentTotalBalance;
    let alertUnderZero = false;
    let firstNegativeDate = null;

    let dayCursor = new Date(todayParsed);
    while (dayCursor <= endParsed) {
      const dStr = formatDate(dayCursor);
      const dayEvents = eventsByDate.get(dStr) || [];

      let dayDelta = 0;
      for (const ev of dayEvents) {
        dayDelta += ev.amount;
      }

      runningBalance += dayDelta;

      if (runningBalance < minBalance) {
        minBalance = runningBalance;
        minBalanceDate = dStr;
      }
      if (runningBalance > maxBalance) {
        maxBalance = runningBalance;
      }
      if (runningBalance < 0 && !alertUnderZero) {
        alertUnderZero = true;
        firstNegativeDate = dStr;
      }

      dailyTrajectory.push({
        date: dStr,
        balance: runningBalance,
        delta: dayDelta,
        eventsCount: dayEvents.length,
        events: dayEvents,
      });

      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const finalBalance = dailyTrajectory[dailyTrajectory.length - 1]?.balance || runningBalance;

    return {
      daysAhead,
      startDate: today,
      endDate,
      currentBalance: currentTotalBalance,
      finalBalance,
      minBalance,
      minBalanceDate,
      maxBalance,
      alertUnderZero,
      firstNegativeDate,
      dailyTrajectory,
    };
  }

  // ==========================================
  // 3. INSIGHTS AUTOMÁTICOS & DESPERDÍCIOS
  // ==========================================
  getSmartInsights(targetMonthKey = null) {
    const today = new Date().toISOString().slice(0, 10);
    const curMonthKey = targetMonthKey || getMonthKey(today);
    const prevMonthKey = addMonthsToKey(curMonthKey, -1);
    const prev2MonthKey = addMonthsToKey(curMonthKey, -2);
    const prev3MonthKey = addMonthsToKey(curMonthKey, -3);

    const insights = [];

    const categoryStats = this.db.prepare(`
      SELECT 
        c.id, c.name, c.color, c.icon,
        COALESCE(SUM(CASE WHEN COALESCE(t.invoice_month, strftime('%Y-%m', t.transaction_date)) = '${curMonthKey}' THEN t.amount ELSE 0 END), 0) as current_month,
        COALESCE(SUM(CASE WHEN COALESCE(t.invoice_month, strftime('%Y-%m', t.transaction_date)) = '${prevMonthKey}' THEN t.amount ELSE 0 END), 0) as prev_month,
        COALESCE(SUM(CASE WHEN COALESCE(t.invoice_month, strftime('%Y-%m', t.transaction_date)) IN ('${prevMonthKey}', '${prev2MonthKey}', '${prev3MonthKey}') THEN t.amount ELSE 0 END), 0) as past_3m_sum
      FROM categories c
      JOIN transactions t ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.status != 'cancelled'
      GROUP BY c.id
    `).all();

    for (const cat of categoryStats) {
      const avg3m = Math.round(cat.past_3m_sum / 3);

      if (avg3m > 0 && cat.current_month > avg3m + 5000 && cat.current_month > avg3m * 1.25) {
        const percentIncrease = Math.round(((cat.current_month - avg3m) / avg3m) * 100);
        insights.push({
          id: `spike_${cat.id}`,
          type: 'warning',
          category: cat.name,
          title: `Aumento expressivo em ${cat.name}`,
          description: `Gastos atingiram ${(cat.current_month / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, um aumento de ${percentIncrease}% sobre sua média histórica trimestral de ${(avg3m / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
          metric: `+${percentIncrease}%`,
          actionSuggestion: `Revise os lançamentos recentes de ${cat.name} para verificar se houve compras pontuais ou aumento recorrente de custos.`,
        });
      }

      if (avg3m > 10000 && cat.current_month < avg3m * 0.80 && (avg3m - cat.current_month) > 8000) {
        const percentSaved = Math.round(((avg3m - cat.current_month) / avg3m) * 100);
        insights.push({
          id: `saving_${cat.id}`,
          type: 'success',
          category: cat.name,
          title: `Economia notável em ${cat.name}`,
          description: `Você gastou ${percentSaved}% menos em ${cat.name} este mês comparado à sua média trimestral, economizando ${((avg3m - cat.current_month) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
          metric: `-${percentSaved}%`,
          actionSuggestion: 'Excelente disciplina orçamentária mantida nessa categoria.',
        });
      }
    }

    const discretionaryCategories = ['Alimentação', 'Lazer', 'Restaurante', 'Delivery', 'Compras', 'Eletrônicos', 'Vestuário'];
    let discretionaryTotalCur = 0;
    let discretionaryTotalPrev = 0;

    for (const cat of categoryStats) {
      if (discretionaryCategories.some(d => cat.name.toLowerCase().includes(d.toLowerCase()))) {
        discretionaryTotalCur += cat.current_month;
        discretionaryTotalPrev += cat.prev_month;
      }
    }

    if (discretionaryTotalPrev > 0 && discretionaryTotalCur > discretionaryTotalPrev * 1.30 && (discretionaryTotalCur - discretionaryTotalPrev) > 10000) {
      const growth = Math.round(((discretionaryTotalCur - discretionaryTotalPrev) / discretionaryTotalPrev) * 100);
      insights.push({
        id: 'discretionary_waste',
        type: 'danger',
        category: 'Despesas Variáveis',
        title: 'Gastos discricionários em elevação',
        description: `Gastos em alimentação fora, compras e lazer subiram ${growth}% em relação ao mês anterior (total de ${(discretionaryTotalCur / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`,
        metric: `+${growth}%`,
        actionSuggestion: 'Estabeleça um teto semanal para delivery e saídas para evitar corrosão da sua capacidade de poupança.',
      });
    }

    const topCat = [...categoryStats].sort((a, b) => b.current_month - a.current_month)[0];
    if (topCat && topCat.current_month > 20000) {
      const potentialYearlySavings = Math.round(topCat.current_month * 0.15 * 12);
      insights.push({
        id: `opp_${topCat.id}`,
        type: 'tip',
        category: 'Oportunidade',
        title: `Potencial de poupança em ${topCat.name}`,
        description: `Se você otimizar apenas 15% dos gastos com ${topCat.name}, economizará aproximadamente ${(potentialYearlySavings / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ao longo de 1 ano.`,
        metric: '15% otimização',
        actionSuggestion: `Defina um orçamento mensal de ${((topCat.current_month * 0.85) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${topCat.name}.`,
      });
    }

    return insights;
  }

  // ==========================================
  // 4. DETECÇÃO DE ANOMALIAS (IQR / Z-SCORE)
  // ==========================================
  detectAnomalies(monthsBack = 6) {
    const today = new Date().toISOString().slice(0, 10);
    const startMonth = addMonthsToKey(getMonthKey(today), -monthsBack);

    const anomalies = [];

    const duplicateCandidates = this.db.prepare(`
      SELECT 
        t1.id as id1, t1.description, t1.amount, t1.transaction_date as date1,
        t2.id as id2, t2.transaction_date as date2,
        c.name as category_name
      FROM transactions t1
      JOIN transactions t2 ON t1.id < t2.id 
        AND t1.amount = t2.amount 
        AND t1.description = t2.description
        AND t1.type = t2.type
        AND t1.status != 'cancelled' AND t2.status != 'cancelled'
        AND abs(julianday(t1.transaction_date) - julianday(t2.transaction_date)) <= 2
      LEFT JOIN categories c ON t1.category_id = c.id
      WHERE t1.type = 'expense'
        AND t1.transaction_date >= '${startMonth}-01'
      ORDER BY t1.transaction_date DESC
      LIMIT 20
    `).all();

    for (const dup of duplicateCandidates) {
      anomalies.push({
        id: `dup_${dup.id1}_${dup.id2}`,
        transactionId: dup.id2,
        description: dup.description,
        amount: dup.amount,
        date: dup.date2,
        categoryName: dup.category_name || 'Sem categoria',
        anomalyType: 'duplicate_charge',
        severity: 'high',
        reason: `Possível cobrança duplicada: lançamento idêntico de ${(dup.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} registrado em ${dup.date1} e ${dup.date2} (intervalo ≤ 48h).`,
      });
    }

    const categories = this.db.prepare(`
      SELECT DISTINCT c.id, c.name
      FROM categories c
      JOIN transactions t ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.status != 'cancelled'
    `).all();

    for (const cat of categories) {
      const rows = this.db.prepare(`
        SELECT id, description, amount, transaction_date
        FROM transactions
        WHERE category_id = ?
          AND type = 'expense'
          AND status != 'cancelled'
          AND transaction_date >= '${startMonth}-01'
        ORDER BY amount ASC
      `).all(cat.id);

      if (rows.length < 4) continue;

      const amounts = rows.map(r => r.amount);
      const q1 = percentile(amounts, 25);
      const med = median(amounts);
      const q3 = percentile(amounts, 75);
      const iqr = q3 - q1;

      const upperBound = Math.round(q3 + 2.0 * Math.max(iqr, med * 0.5));

      const outliers = rows.filter(r => r.amount > upperBound && r.amount > 5000);

      for (const out of outliers) {
        if (out.transaction_date >= addDays(today, -60)) {
          const ratio = (out.amount / (med || 1)).toFixed(1);
          anomalies.push({
            id: `outlier_${out.id}`,
            transactionId: out.id,
            description: out.description,
            amount: out.amount,
            date: out.transaction_date,
            categoryName: cat.name,
            anomalyType: 'statistical_outlier',
            severity: out.amount > upperBound * 1.5 ? 'high' : 'medium',
            reason: `Gasto incomum em ${cat.name}: ${(out.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} é ${ratio}x maior que o valor mediano habitual de ${(med / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
          });
        }
      }
    }

    return anomalies.sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0));
  }

  // ==========================================
  // 5. CATEGORIZAÇÃO INTELIGENTE PREDITIVA
  // ==========================================
  suggestCategory(description, amount = null) {
    if (!description || description.trim().length === 0) {
      return null;
    }

    const descUpper = description.trim().toUpperCase();

    const importRules = this.db.prepare(`
      SELECT r.pattern, r.category_id, c.name as category_name
      FROM import_rules r
      JOIN categories c ON r.category_id = c.id
      WHERE r.active = 1
    `).all();

    for (const rule of importRules) {
      if (descUpper.includes(rule.pattern.toUpperCase())) {
        return {
          categoryId: rule.category_id,
          categoryName: rule.category_name,
          confidence: 98,
          source: 'rule',
        };
      }
    }

    const tokens = tokenizeText(description);
    if (tokens.length === 0) return null;

    const categoryFrequency = new Map();
    let totalMatches = 0;

    for (const token of tokens) {
      const rows = this.db.prepare(`
        SELECT t.category_id, c.name as category_name, COUNT(*) as cnt
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.category_id IS NOT NULL
          AND UPPER(t.description) LIKE ?
        GROUP BY t.category_id
      `).all(`%${token}%`);

      for (const r of rows) {
        if (!categoryFrequency.has(r.category_id)) {
          categoryFrequency.set(r.category_id, {
            id: r.category_id,
            name: r.category_name,
            score: 0,
            count: 0,
          });
        }
        const item = categoryFrequency.get(r.category_id);
        item.score += r.cnt;
        item.count += r.cnt;
        totalMatches += r.cnt;
      }
    }

    if (totalMatches > 0 && categoryFrequency.size > 0) {
      const candidates = Array.from(categoryFrequency.values()).sort((a, b) => b.score - a.score);
      const best = candidates[0];
      const confidence = Math.min(95, Math.max(60, Math.round((best.score / totalMatches) * 100)));

      return {
        categoryId: best.id,
        categoryName: best.name,
        confidence,
        source: 'history',
      };
    }

    return null;
  }

  // ==========================================
  // 6. IDENTIFICAÇÃO DE RECORRÊNCIAS & ASSINATURAS
  // ==========================================
  detectRecurringPatterns(type = 'expense', referenceDate = null) {
    const today = referenceDate || new Date().toISOString().slice(0, 10);
    const windowStart = addMonthsToKey(getMonthKey(today), -8);
    // Salários variam um pouco mais (horas extras, descontos) que assinaturas
    const maxAmountCv = type === 'income' ? 0.15 : 0.08;

    const txs = this.db.prepare(`
      SELECT id, description, amount, transaction_date, category_id
      FROM transactions
      WHERE type = ? AND status != 'cancelled'
        AND transaction_date >= ? AND transaction_date <= ?
      ORDER BY transaction_date ASC
    `).all(type, `${windowStart}-01`, today);

    const groups = new Map();
    for (const tx of txs) {
      const cleanName = cleanMerchantName(tx.description);
      if (!cleanName || cleanName.length < 3) continue;

      if (!groups.has(cleanName)) {
        groups.set(cleanName, []);
      }
      groups.get(cleanName).push(tx);
    }

    const candidates = [];

    for (const [merchant, list] of groups.entries()) {
      if (list.length < 2) continue;

      const intervals = [];
      for (let i = 1; i < list.length; i++) {
        const d1 = parseDate(list[i - 1].transaction_date);
        const d2 = parseDate(list[i].transaction_date);
        const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) intervals.push(diffDays);
      }

      if (intervals.length === 0) continue;

      const avgInterval = mean(intervals);
      const intervalStdDev = stdDev(intervals, avgInterval);

      const amounts = list.map(l => l.amount);
      const avgAmount = Math.round(mean(amounts));
      const amountStdDev = stdDev(amounts, avgAmount);
      const amountCv = avgAmount > 0 ? (amountStdDev / avgAmount) : 1;

      let frequency = null;
      if (avgInterval >= 25 && avgInterval <= 35 && intervalStdDev <= 6) {
        frequency = 'monthly';
      } else if (avgInterval >= 6 && avgInterval <= 8 && intervalStdDev <= 2) {
        frequency = 'weekly';
      }

      if (frequency && amountCv <= maxAmountCv) {
        const lastTx = list[list.length - 1];
        const lastDate = lastTx.transaction_date;
        const nextExpectedDate = frequency === 'monthly' ? addDays(lastDate, 30) : addDays(lastDate, 7);

        const catMap = new Map();
        for (const it of list) {
          if (it.category_id) {
            catMap.set(it.category_id, (catMap.get(it.category_id) || 0) + 1);
          }
        }
        let topCatId = null;
        let topCatCount = 0;
        for (const [cId, count] of catMap.entries()) {
          if (count > topCatCount) {
            topCatCount = count;
            topCatId = cId;
          }
        }

        // Padrão ainda vivo: última ocorrência dentro de ~2 ciclos
        const daysSinceLast = Math.round((parseDate(today) - parseDate(lastDate)) / (1000 * 60 * 60 * 24));
        const isActive = frequency === 'monthly' ? daysSinceLast <= 62 : daysSinceLast <= 21;

        candidates.push({
          id: `rec_${type}_${merchant.replace(/\s+/g, '_').toLowerCase()}`,
          type,
          isActive,
          rawDescription: lastTx.description,
          cleanDescription: merchant,
          averageAmount: avgAmount,
          suggestedFrequency: frequency,
          suggestedBillingDay: parseDate(lastDate).getDate(),
          occurrencesCount: list.length,
          lastDate,
          nextExpectedDate,
          categoryId: topCatId,
          confidence: Math.min(96, Math.max(70, Math.round((1 - amountCv) * 90))),
        });
      }
    }

    return candidates.sort((a, b) => b.occurrencesCount - a.occurrencesCount);
  }

  // ==========================================
  // 7. ANÁLISE DE CARTÕES & FATURAS FUTURAS
  // ==========================================
  getCreditCardIntelligence() {
    const today = new Date().toISOString().slice(0, 10);
    const curMonthKey = getMonthKey(today);

    const cards = this.db.prepare(`SELECT * FROM credit_cards WHERE active = 1`).all();
    const result = [];

    const projectionMonths = [];
    for (let i = 0; i < 6; i++) {
      projectionMonths.push(addMonthsToKey(curMonthKey, i));
    }

    for (const card of cards) {
      const totalLimit = card.credit_limit;

      const monthlyProjections = [];
      let totalUsedAcrossFuture = 0;

      for (const mKey of projectionMonths) {
        const invTotal = this.db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
          FROM transactions
          WHERE credit_card_id = ?
            AND invoice_month = ?
            AND status != 'cancelled'
            AND status != 'paid'
        `).get(card.id, mKey);

        monthlyProjections.push({
          monthKey: mKey,
          amount: invTotal.total,
          itemCount: invTotal.count,
        });

        totalUsedAcrossFuture += invTotal.total;
      }

      const currentInvoice = monthlyProjections[0]?.amount || 0;
      const nextInvoice = monthlyProjections[1]?.amount || 0;
      const currentUtilization = totalLimit > 0 ? Math.round((currentInvoice / totalLimit) * 100) : 0;

      const activeInstallments = this.db.prepare(`
        SELECT description, amount, installment_number, total_installments, invoice_month
        FROM transactions
        WHERE credit_card_id = ?
          AND installment_id IS NOT NULL
          AND status != 'cancelled'
          AND installment_number = total_installments
          AND invoice_month >= '${curMonthKey}'
        ORDER BY invoice_month ASC
      `).all(card.id);

      result.push({
        cardId: card.id,
        cardName: card.name,
        color: card.color,
        creditLimit: totalLimit,
        currentInvoice,
        nextInvoice,
        currentUtilization,
        closingDay: card.closing_day,
        dueDay: card.due_day,
        monthlyProjections,
        endingInstallments: activeInstallments.map(inst => ({
          description: inst.description,
          amount: inst.amount,
          endsInMonth: inst.invoice_month,
        })),
      });
    }

    return result;
  }

  // ==========================================
  // 8. METAS FINANCEIRAS COM PROJEÇÃO
  // ==========================================
  getGoalsIntelligence() {
    const goals = this.db.prepare(`SELECT * FROM goals`).all();
    if (goals.length === 0) return [];

    const today = new Date().toISOString().slice(0, 10);
    const curMonthKey = getMonthKey(today);
    const prevMonthKey = addMonthsToKey(curMonthKey, -1);
    const prev2MonthKey = addMonthsToKey(curMonthKey, -2);

    const incomeAvg = this.db.prepare(`
      SELECT COALESCE(AVG(monthly_total), 0) as avg_inc
      FROM (
        SELECT SUM(amount) as monthly_total
        FROM transactions
        WHERE type = 'income' AND status = 'completed'
          AND strftime('%Y-%m', transaction_date) IN (?, ?, ?)
        GROUP BY strftime('%Y-%m', transaction_date)
      )
    `).get(curMonthKey, prevMonthKey, prev2MonthKey).avg_inc;

    const expenseAvg = this.db.prepare(`
      SELECT COALESCE(AVG(monthly_total), 0) as avg_exp
      FROM (
        SELECT SUM(amount) as monthly_total
        FROM transactions
        WHERE type = 'expense' AND status != 'cancelled'
          AND COALESCE(invoice_month, strftime('%Y-%m', transaction_date)) IN (?, ?, ?)
        GROUP BY COALESCE(invoice_month, strftime('%Y-%m', transaction_date))
      )
    `).get(curMonthKey, prevMonthKey, prev2MonthKey).avg_exp;

    const avgMonthlySavings = Math.max(0, Math.round(incomeAvg - expenseAvg));

    return goals.map(goal => {
      const remainingAmount = Math.max(0, goal.target_amount - goal.current_amount);
      const progressPercent = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 100;

      let estimatedMonthsToFinish = null;
      let estimatedCompletionDate = null;
      let requiredMonthlyAporte = null;
      let status = 'on_track';

      if (remainingAmount === 0) {
        status = 'completed';
      } else if (avgMonthlySavings > 0) {
        const allocatedMonthly = Math.round(avgMonthlySavings / (goals.filter(g => g.current_amount < g.target_amount).length || 1));
        if (allocatedMonthly > 0) {
          estimatedMonthsToFinish = Math.ceil(remainingAmount / allocatedMonthly);
          estimatedCompletionDate = addMonthsToKey(curMonthKey, estimatedMonthsToFinish);
        }
      }

      if (goal.target_date && remainingAmount > 0) {
        const targetMonth = getMonthKey(goal.target_date);
        const monthsUntilTarget = Math.max(1, (parseDate(goal.target_date).getFullYear() - parseDate(today).getFullYear()) * 12 + (parseDate(goal.target_date).getMonth() - parseDate(today).getMonth()));

        requiredMonthlyAporte = Math.round(remainingAmount / monthsUntilTarget);

        if (estimatedCompletionDate && estimatedCompletionDate > targetMonth) {
          status = 'at_risk';
        }
      }

      return {
        id: goal.id,
        name: goal.name,
        targetAmount: goal.target_amount,
        currentAmount: goal.current_amount,
        remainingAmount,
        progressPercent,
        color: goal.color,
        icon: goal.icon,
        targetDate: goal.target_date,
        estimatedCompletionDate,
        estimatedMonthsToFinish,
        requiredMonthlyAporte,
        status,
      };
    });
  }

  // ==========================================
  // 9. RESERVA FINANCEIRA
  // ==========================================

  // Saldo de uma conta considerando lançamentos até a data (inclusive)
  getAccountBalanceAt(accountId, dateStr) {
    const row = this.db.prepare(`
      SELECT a.initial_balance
        + COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'income' AND status = 'completed' AND transaction_date <= ?), 0)
        - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'expense' AND credit_card_id IS NULL AND status = 'completed' AND transaction_date <= ?), 0)
        + COALESCE((SELECT SUM(amount) FROM transactions WHERE destination_account_id = a.id AND type = 'transfer' AND status = 'completed' AND transaction_date <= ?), 0)
        - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type IN ('transfer', 'card_payment') AND status = 'completed' AND transaction_date <= ?), 0)
        AS balance
      FROM accounts a
      WHERE a.id = ?
    `).get(dateStr, dateStr, dateStr, dateStr, accountId);
    return row ? row.balance : 0;
  }

  getReserveSettings() {
    let row = null;
    try {
      row = this.db.prepare(`
        SELECT reserve_target_months, reserve_account_ids, reserve_category_ids, reserve_initial_amount,
               reserve_auto_detect, reserve_excluded_tx_ids
        FROM settings WHERE id = 'app_config'
      `).get();
    } catch (e) {
      row = null;
    }
    const parseIds = (value) => {
      try {
        const parsed = value ? JSON.parse(value) : null;
        return Array.isArray(parsed) ? parsed : null;
      } catch (e) {
        return null;
      }
    };
    return {
      targetMonths: (row && row.reserve_target_months) || 6,
      accountIds: parseIds(row && row.reserve_account_ids),
      categoryIds: parseIds(row && row.reserve_category_ids),
      initialAmount: (row && row.reserve_initial_amount) || 0,
      autoDetect: !row || row.reserve_auto_detect === null || row.reserve_auto_detect === undefined ? true : Boolean(row.reserve_auto_detect),
      excludedTransactionIds: parseIds(row && row.reserve_excluded_tx_ids) || [],
    };
  }

  // Categorias que representam aportes/resgates (ex.: "Investimentos"): o dinheiro
  // sai do extrato da conta corrente, mas vai para a reserva e não é custo de vida.
  getReserveCategories() {
    const { categoryIds } = this.getReserveSettings();
    const categories = this.getExpenseUsableCategories();
    if (categoryIds) return categories.filter(c => categoryIds.includes(c.id));
    const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return categories.filter(c => /invest|reserva|poupan|aplicac|aporte/.test(normalize(c.name)));
  }

  // Categorias de despesa + qualquer categoria já usada em despesas
  getExpenseUsableCategories() {
    return this.db.prepare(`
      SELECT id, name, color FROM categories
      WHERE active = 1
        AND (type = 'expense' OR id IN (SELECT DISTINCT category_id FROM transactions WHERE type = 'expense' AND category_id IS NOT NULL))
      ORDER BY name ASC
    `).all();
  }

  // Movimentos da reserva que passam pela conta corrente:
  // saída = aporte (+), entrada = resgate (-). Reconhecidos pela categoria
  // escolhida ou pelo texto do extrato (aplicação, resgate, CDB, caixinha...).
  getReserveMovements() {
    const { autoDetect, excludedTransactionIds } = this.getReserveSettings();
    const reserveCategoryIds = new Set(this.getReserveCategories().map(c => c.id));
    const reserveAccountIds = new Set(this.getReserveAccounts().map(a => a.id));
    const excluded = new Set(excludedTransactionIds);

    const rows = this.db.prepare(`
      SELECT t.id, t.type, t.amount, t.transaction_date, t.description, t.category_id,
             t.account_id, t.destination_account_id,
             c.name as category_name, a.name as account_name, d.name as destination_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN accounts a ON a.id = t.account_id
      LEFT JOIN accounts d ON d.id = t.destination_account_id
      WHERE t.status = 'completed' AND t.credit_card_id IS NULL
        AND t.type IN ('income', 'expense', 'transfer')
      ORDER BY t.transaction_date ASC, t.created_at ASC
    `).all();

    const movements = [];
    for (const r of rows) {
      if (r.type === 'transfer') {
        // Transferências entre conta comum e conta de reserva (já refletidas no saldo da conta)
        const intoReserve = reserveAccountIds.has(r.destination_account_id) && !reserveAccountIds.has(r.account_id);
        const outOfReserve = reserveAccountIds.has(r.account_id) && !reserveAccountIds.has(r.destination_account_id);
        if (!intoReserve && !outOfReserve) continue;
        movements.push({
          id: r.id,
          date: r.transaction_date,
          description: r.description,
          amount: intoReserve ? r.amount : -r.amount,
          kind: intoReserve ? 'aporte' : 'resgate',
          source: 'transfer',
          accountName: intoReserve ? r.account_name : r.destination_name,
          categoryName: null,
          countsInBalance: false,
          excluded: false,
        });
        continue;
      }

      // Lançamentos dentro das próprias contas de reserva já entram pelo saldo delas
      if (reserveAccountIds.has(r.account_id)) continue;

      const byCategory = reserveCategoryIds.has(r.category_id);
      const byText = autoDetect && isReserveDescription(r.description);
      if (!byCategory && !byText) continue;

      const isExcluded = excluded.has(r.id);
      movements.push({
        id: r.id,
        date: r.transaction_date,
        description: r.description,
        amount: r.type === 'expense' ? r.amount : -r.amount,
        kind: r.type === 'expense' ? 'aporte' : 'resgate',
        source: byCategory ? 'category' : 'detected',
        accountName: r.account_name,
        categoryName: r.category_name,
        countsInBalance: !isExcluded,
        excluded: isExcluded,
      });
    }
    return movements;
  }

  // Contas que compõem a reserva: escolha do usuário ou, por padrão, poupança e investimentos
  getReserveAccounts() {
    const { accountIds } = this.getReserveSettings();
    const accounts = this.db.prepare(`SELECT id, name, type, color FROM accounts WHERE active = 1 ORDER BY name ASC`).all();
    if (accountIds) return accounts.filter(a => accountIds.includes(a.id));
    return accounts.filter(a => a.type === 'savings' || a.type === 'investment');
  }

  // Soma mensal dos custos fixos aprendidos no histórico importado
  getLearnedFixedCosts(referenceDate = null) {
    return this.detectRecurringPatterns('expense', referenceDate)
      .filter(p => p.isActive)
      .reduce((sum, p) => sum + (p.suggestedFrequency === 'weekly' ? Math.round((p.averageAmount * 52) / 12) : p.averageAmount), 0);
  }

  getMonthIncomeTotal(mKey) {
    return this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM transactions
      WHERE type = 'income' AND status = 'completed'
        AND transaction_date >= ? AND transaction_date <= ?
    `).get(`${mKey}-01`, `${mKey}-31`);
  }

  getMonthExpenseTotal(mKey) {
    return this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM transactions
      WHERE type = 'expense' AND status != 'cancelled'
        AND (
          (credit_card_id IS NULL AND status = 'completed' AND transaction_date >= ? AND transaction_date <= ?)
          OR (credit_card_id IS NOT NULL AND invoice_month = ?)
        )
    `).get(`${mKey}-01`, `${mKey}-31`, mKey);
  }

  getReserveStatus(mKey, monthSurplus = 0, historyMonths = 6) {
    const today = new Date().toISOString().slice(0, 10);
    const currentKey = getMonthKey(today);
    const settings = this.getReserveSettings();
    const { targetMonths } = settings;
    const reserveAccounts = this.getReserveAccounts();
    const reserveIds = new Set(reserveAccounts.map(a => a.id));
    const reserveCategories = this.getReserveCategories();
    const reserveCategorySet = new Set(reserveCategories.map(c => c.id));
    const movements = this.getReserveMovements();
    const balanceMovements = movements.filter(m => m.countsInBalance);

    // Resgates maiores que os aportes registrados indicam dinheiro guardado antes
    // do primeiro extrato importado: usa isso como saldo inicial quando não informado.
    let running = 0;
    let lowest = 0;
    for (const m of balanceMovements) {
      running += m.amount;
      lowest = Math.min(lowest, running);
    }
    const initialAmountEstimated = settings.initialAmount === 0 && lowest < 0;
    const initialAmount = settings.initialAmount > 0 ? settings.initialAmount : Math.max(0, -lowest);

    const endOf = (key) => {
      if (key === currentKey) return today;
      const [y, m] = key.split('-').map(Number);
      return formatDate(new Date(y, m, 0));
    };
    const balanceOn = (dateStr) => initialAmount
      + reserveAccounts.reduce((sum, acc) => sum + this.getAccountBalanceAt(acc.id, dateStr), 0)
      + balanceMovements.filter(m => m.date <= dateStr).reduce((sum, m) => sum + m.amount, 0);
    const movementsIn = (key, kind = null) => balanceMovements
      .filter(m => m.date.slice(0, 7) === key && (!kind || m.kind === kind))
      .reduce((sum, m) => sum + Math.abs(m.amount), 0);

    const monthEnd = endOf(mKey);
    const balance = balanceOn(monthEnd);
    const previousBalance = balanceOn(endOf(addMonthsToKey(mKey, -1)));
    const monthContribution = balance - previousBalance;
    const averageContribution = Math.round((balance - balanceOn(endOf(addMonthsToKey(mKey, -3)))) / 3);
    const monthAportes = movementsIn(mKey, 'aporte');
    const monthResgates = movementsIn(mKey, 'resgate');

    // Custo de vida: média das despesas dos 3 meses anteriores (meses fechados), sem os aportes
    const costOf = (key) => Math.max(0, this.getMonthExpenseTotal(key).total - movementsIn(key, 'aporte'));
    const pastCosts = [1, 2, 3].map(i => costOf(addMonthsToKey(mKey, -i))).filter(v => v > 0);
    const monthlyCost = pastCosts.length > 0 ? Math.round(mean(pastCosts)) : costOf(mKey);

    const targetAmount = monthlyCost * targetMonths;
    const gap = Math.max(0, targetAmount - balance);
    const coverageMonths = monthlyCost > 0 ? Math.max(0, balance) / monthlyCost : 0;
    const progressPercent = targetAmount > 0 ? Math.min(100, Math.max(0, Math.round((balance / targetAmount) * 100))) : 0;

    // Quanto menor a cobertura, maior a fatia do superávit sugerida para a reserva.
    // Aportes já feitos no mês contam: a sugestão é só o que falta além deles.
    const suggestedRate = coverageMonths < 1 ? 0.5 : coverageMonths < 3 ? 0.4 : 0.3;
    const operationalSurplus = monthSurplus + monthAportes - monthResgates;
    const suggestedContribution = gap > 0 && operationalSurplus > 0
      ? Math.max(0, Math.min(gap, Math.round(operationalSurplus * suggestedRate) - Math.max(0, monthContribution)))
      : 0;
    const pace = Math.max(averageContribution, suggestedContribution);
    const monthsToTarget = gap === 0 ? 0 : pace > 0 ? Math.ceil(gap / pace) : null;
    const estimatedCompletion = monthsToTarget ? addMonthsToKey(mKey, monthsToTarget) : null;

    let status = 'complete';
    let message = `Reserva completa: ${coverageMonths.toFixed(1)} meses de custo de vida protegidos. Direcione o excedente para metas e investimentos.`;
    if (reserveAccounts.length === 0 && reserveCategories.length === 0 && initialAmount === 0 && movements.length === 0) {
      status = 'not_configured';
      message = 'Diga ao Pigo onde fica sua reserva: contas (poupança, CDB, caixinha), a categoria dos aportes (ex.: Investimentos) ou o saldo que você já tem guardado.';
    } else if (monthlyCost === 0) {
      status = 'building';
      message = 'Importe extratos de mais meses para o Pigo calcular seu custo de vida e a meta ideal de reserva.';
    } else if (coverageMonths < 1) {
      status = 'critical';
      message = `Reserva cobre apenas ${Math.round(coverageMonths * 30)} dias de despesas. Priorize aportes antes de novos gastos.`;
    } else if (coverageMonths < 3) {
      status = 'building';
      message = `Reserva em construção: ${coverageMonths.toFixed(1)} meses cobertos. O mínimo recomendado é 3 meses.`;
    } else if (gap > 0) {
      status = 'good';
      message = `Boa proteção: ${coverageMonths.toFixed(1)} de ${targetMonths} meses cobertos. Faltam ${(gap / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para a meta.`;
    }

    const history = [];
    for (let i = historyMonths - 1; i >= 0; i--) {
      const key = addMonthsToKey(mKey, -i);
      history.push({
        monthKey: key,
        balance: balanceOn(endOf(key)),
        target: targetAmount,
        aportes: movementsIn(key, 'aporte'),
        resgates: movementsIn(key, 'resgate'),
      });
    }

    const allAccounts = this.db.prepare(`SELECT id, name, type, color FROM accounts WHERE active = 1 ORDER BY name ASC`).all();
    const allCategories = this.getExpenseUsableCategories();
    const monthCategoryTotal = (categoryId) => this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE type = 'expense' AND status = 'completed' AND credit_card_id IS NULL AND category_id = ?
        AND transaction_date >= ? AND transaction_date <= ?
    `).get(categoryId, `${mKey}-01`, `${mKey}-31`).total;

    return {
      status,
      message,
      monthKey: mKey,
      targetMonths,
      initialAmount,
      initialAmountEstimated,
      autoDetect: settings.autoDetect,
      usingDefaultAccounts: !settings.accountIds,
      usingDefaultCategories: !settings.categoryIds,
      accounts: allAccounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        color: a.color,
        balance: this.getAccountBalanceAt(a.id, monthEnd),
        isReserve: reserveIds.has(a.id),
      })),
      categories: allCategories.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        monthTotal: monthCategoryTotal(c.id),
        isReserve: reserveCategorySet.has(c.id),
      })),
      balance,
      previousBalance,
      monthContribution,
      monthAportes,
      monthResgates,
      averageContribution,
      monthlyCost,
      targetAmount,
      gap,
      coverageMonths: Number(coverageMonths.toFixed(1)),
      progressPercent,
      suggestedContribution,
      monthsToTarget,
      estimatedCompletion,
      history,
      movements: movements.filter(m => m.date <= monthEnd).slice(-60).reverse(),
    };
  }

  // Visão completa da tela de Reserva (12 meses de evolução)
  getReserveOverview(monthKey = null) {
    const today = new Date().toISOString().slice(0, 10);
    const mKey = monthKey || getMonthKey(today);
    const surplus = this.getMonthIncomeTotal(mKey).total - this.getMonthExpenseTotal(mKey).total;
    return this.getReserveStatus(mKey, surplus, 12);
  }

  // ==========================================
  // 10. FECHAMENTO MENSAL INTELIGENTE
  // ==========================================
  getMonthlyCloseout(yearMonth = null) {
    const today = new Date().toISOString().slice(0, 10);
    const currentKey = getMonthKey(today);
    let mKey = yearMonth || currentKey;
    if (!yearMonth) {
      // Sem extrato do mês atual ainda: abre no último mês com movimentação
      const hasCurrent = this.db.prepare(`
        SELECT 1 FROM transactions
        WHERE strftime('%Y-%m', transaction_date) = ? OR invoice_month = ?
        LIMIT 1
      `).get(currentKey, currentKey);
      if (!hasCurrent) {
        const latest = this.db.prepare(`
          SELECT MAX(COALESCE(invoice_month, strftime('%Y-%m', transaction_date))) as k
          FROM transactions
          WHERE COALESCE(invoice_month, strftime('%Y-%m', transaction_date)) < ?
        `).get(currentKey);
        if (latest && latest.k) mKey = latest.k;
      }
    }
    const prevKey = addMonthsToKey(mKey, -1);
    const isCurrentMonth = mKey === currentKey;
    const [yr, mo] = mKey.split('-').map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const daysElapsed = isCurrentMonth ? parseDate(today).getDate() : daysInMonth;
    const formatBRL = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const income = this.getMonthIncomeTotal(mKey);
    const expense = this.getMonthExpenseTotal(mKey);
    const prevIncome = this.getMonthIncomeTotal(prevKey).total;
    const prevExpense = this.getMonthExpenseTotal(prevKey).total;

    const savedAmount = income.total - expense.total;
    const savingsRate = income.total > 0 ? Math.round((savedAmount / income.total) * 100) : 0;

    // Projeção do mês em andamento pelo ritmo diário de gastos
    const projectedExpenseTotal = isCurrentMonth && daysElapsed < daysInMonth && daysElapsed > 0
      ? Math.round((expense.total / daysElapsed) * daysInMonth)
      : expense.total;

    // Mês em andamento: comparar só quando já há movimentação, e pela projeção de gastos
    const incomeChangeMoM = prevIncome > 0 && (!isCurrentMonth || income.total > 0)
      ? Math.round(((income.total - prevIncome) / prevIncome) * 100) : 0;
    const expenseBasis = isCurrentMonth ? projectedExpenseTotal : expense.total;
    const expenseChangeMoM = prevExpense > 0 && expenseBasis > 0
      ? Math.round(((expenseBasis - prevExpense) / prevExpense) * 100) : 0;

    const monthFilter = `
      t.type = 'expense' AND t.status != 'cancelled'
      AND (
        (t.credit_card_id IS NULL AND t.status = 'completed' AND t.transaction_date >= ? AND t.transaction_date <= ?)
        OR (t.credit_card_id IS NOT NULL AND t.invoice_month = ?)
      )
    `;
    const monthArgs = (key) => [`${key}-01`, `${key}-31`, key];

    const categoryTotalsFor = (key) => {
      const rows = this.db.prepare(`
        SELECT t.category_id as id, SUM(t.amount) as total
        FROM transactions t
        WHERE ${monthFilter}
        GROUP BY t.category_id
      `).all(...monthArgs(key));
      return new Map(rows.map(r => [r.id, r.total]));
    };
    const pastCategoryTotals = [1, 2, 3].map(i => categoryTotalsFor(addMonthsToKey(mKey, -i)));

    const topCategories = this.db.prepare(`
      SELECT
        t.category_id as id, c.name, c.color, c.icon,
        SUM(t.amount) as total,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE ${monthFilter}
      GROUP BY t.category_id
      ORDER BY total DESC
      LIMIT 8
    `).all(...monthArgs(mKey)).map(c => {
      const pastValues = pastCategoryTotals.map(m => m.get(c.id) || 0);
      const monthsWithData = pastValues.filter(v => v > 0).length;
      const averagePrevious = monthsWithData > 0 ? Math.round(pastValues.reduce((a, b) => a + b, 0) / monthsWithData) : 0;
      return {
        id: c.id || 'uncategorized',
        name: c.name || 'Sem categoria',
        color: c.color || '#94a3b8',
        icon: c.icon || 'Tag',
        total: c.total,
        count: c.count,
        percentage: expense.total > 0 ? Math.round((c.total / expense.total) * 100) : 0,
        averagePrevious,
        changeVsAverage: averagePrevious > 0 ? Math.round(((c.total - averagePrevious) / averagePrevious) * 100) : null,
      };
    });

    const highestExpense = this.db.prepare(`
      SELECT t.id, t.description, t.amount, t.transaction_date, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE ${monthFilter}
      ORDER BY t.amount DESC
      LIMIT 1
    `).get(...monthArgs(mKey));

    const uncategorizedCount = this.db.prepare(`
      SELECT COUNT(*) as c FROM transactions t WHERE ${monthFilter} AND t.category_id IS NULL
    `).get(...monthArgs(mKey)).c;

    const availableMonths = this.db.prepare(`
      SELECT DISTINCT month_key FROM (
        SELECT strftime('%Y-%m', transaction_date) as month_key FROM transactions
        UNION
        SELECT invoice_month as month_key FROM transactions WHERE invoice_month IS NOT NULL
      )
      WHERE month_key IS NOT NULL AND month_key <= ?
      ORDER BY month_key DESC
    `).all(currentKey).map(r => r.month_key);

    const reserve = this.getReserveStatus(mKey, savedAmount);

    const achievements = [];
    if (savingsRate >= 20) {
      achievements.push(`Você poupou ${savingsRate}% de toda a sua renda este mês.`);
    }
    if (expenseChangeMoM < 0 && !isCurrentMonth) {
      achievements.push(`Seus gastos caíram ${Math.abs(expenseChangeMoM)}% em relação ao mês anterior.`);
    }
    if (savedAmount > 0) {
      achievements.push(`Superávit acumulado de ${formatBRL(savedAmount)}.`);
    }
    if (reserve.status !== 'not_configured' && reserve.monthContribution > 0) {
      achievements.push(`Sua reserva cresceu ${formatBRL(reserve.monthContribution)} no mês.`);
    }

    const recommendations = [];
    const operationalResult = savedAmount + reserve.monthAportes - reserve.monthResgates;
    if (reserve.monthAportes > 0 || reserve.monthResgates > 0) {
      recommendations.push({
        type: operationalResult >= 0 ? 'info' : 'warning',
        text: `Movimentos da reserva no mês: ${formatBRL(reserve.monthAportes)} aplicados e ${formatBRL(reserve.monthResgates)} resgatados. Desconsiderando-os, o resultado do dia a dia foi ${formatBRL(operationalResult)}.`,
      });
    } else if (savedAmount < 0) {
      recommendations.push({
        type: 'warning',
        text: `O mês fechou em déficit de ${formatBRL(Math.abs(savedAmount))}. Evite novos parcelamentos até equilibrar o caixa.`,
      });
    }
    if (isCurrentMonth && prevExpense > 0 && projectedExpenseTotal > prevExpense * 1.1) {
      recommendations.push({
        type: 'warning',
        text: `No ritmo atual, os gastos devem fechar em ${formatBRL(projectedExpenseTotal)} — acima do mês anterior (${formatBRL(prevExpense)}).`,
      });
    }
    const overspent = topCategories
      .filter(c => c.changeVsAverage !== null && c.changeVsAverage >= 25 && c.total - c.averagePrevious >= 10000)
      .sort((a, b) => (b.total - b.averagePrevious) - (a.total - a.averagePrevious))[0];
    if (overspent) {
      recommendations.push({
        type: 'warning',
        text: `${overspent.name} ficou ${overspent.changeVsAverage}% acima da sua média dos últimos meses (${formatBRL(overspent.total - overspent.averagePrevious)} a mais).`,
      });
    }
    if (reserve.status !== 'not_configured' && reserve.suggestedContribution > 0) {
      const eta = reserve.monthsToTarget
        ? ` — nesse ritmo você atinge a meta em ~${reserve.monthsToTarget} ${reserve.monthsToTarget === 1 ? 'mês' : 'meses'}`
        : '';
      recommendations.push({
        type: 'reserve',
        text: `Separe ${formatBRL(reserve.suggestedContribution)} do superávit para a reserva${eta}.`,
      });
    } else if (reserve.status === 'complete' && savedAmount > 0) {
      recommendations.push({
        type: 'success',
        text: `Reserva completa! Os ${formatBRL(savedAmount)} de superávit podem ir para metas ou investimentos de longo prazo.`,
      });
    }
    if (uncategorizedCount > 0) {
      recommendations.push({
        type: 'info',
        text: `${uncategorizedCount} ${uncategorizedCount === 1 ? 'despesa está' : 'despesas estão'} sem categoria. Categorize para o Pigo aprender e acertar nas próximas importações.`,
      });
    }

    return {
      monthKey: mKey,
      previousMonthKey: prevKey,
      nextMonthKey: mKey < currentKey ? addMonthsToKey(mKey, 1) : null,
      isCurrentMonth,
      daysElapsed,
      daysInMonth,
      availableMonths,
      incomeTotal: income.total,
      incomeCount: income.count,
      expenseTotal: expense.total,
      expenseCount: expense.count,
      projectedExpenseTotal,
      savedAmount,
      savingsRate,
      incomeChangeMoM,
      expenseChangeMoM,
      topCategories,
      highestExpense: highestExpense ? {
        description: highestExpense.description,
        amount: highestExpense.amount,
        date: highestExpense.transaction_date,
        categoryName: highestExpense.category_name || 'Sem categoria',
      } : null,
      uncategorizedCount,
      reserve,
      achievements,
      recommendations,
    };
  }

  // Consolidated Overview for UI
  getIntelligenceOverview() {
    return {
      healthScore: this.getFinancialHealthScore(),
      forecast: this.getBalanceForecast(30),
      insights: this.getSmartInsights(),
      anomalies: this.detectAnomalies(),
      recurringCandidates: this.detectRecurringPatterns('expense'),
      cardsAnalysis: this.getCreditCardIntelligence(),
      goals: this.getGoalsIntelligence(),
      monthlyCloseout: this.getMonthlyCloseout(),
    };
  }
}

module.exports = {
  FinancialIntelligenceEngine,
  isReserveDescription,
  tokenizeText,
  cleanMerchantName,
  mean,
  stdDev,
  percentile,
  median,
};
