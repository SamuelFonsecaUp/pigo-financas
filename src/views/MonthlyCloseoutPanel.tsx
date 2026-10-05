import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  PiggyBank,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ReserveCard, monthLabel } from '../components/ReserveCard';
import { CloseoutRecommendation, MonthlyCloseoutReport } from '../types';

const ChangeBadge: React.FC<{ value: number; invert?: boolean; suffix?: string }> = ({ value, invert = false, suffix = 'vs mês anterior' }) => {
  if (!value) return <span className="text-[10px] text-slate-500 mt-1 block">Sem variação {suffix}</span>;
  const isGood = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`text-[10px] mt-1 flex items-center gap-0.5 font-semibold ${isGood ? 'text-emerald-400' : 'text-rose-400'}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(value)}% {suffix}
    </span>
  );
};

const RecommendationIcon: React.FC<{ type: CloseoutRecommendation['type'] }> = ({ type }) => {
  if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
  if (type === 'reserve') return <PiggyBank className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />;
  if (type === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
  return <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />;
};

export const MonthlyCloseoutPanel: React.FC<{ initialData: MonthlyCloseoutReport }> = ({ initialData }) => {
  const { showToast, setCurrentView } = useFinancial();
  const [data, setData] = useState<MonthlyCloseoutReport>(initialData);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const loadMonth = useCallback(async (monthKey: string) => {
    if (!window.electronAPI) return;
    setIsLoading(true);
    try {
      setData(await window.electronAPI.getMonthlyCloseout(monthKey));
    } catch (e) {
      console.error(e);
      showToast('Erro ao carregar o fechamento do mês.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const monthOptions = data.availableMonths.includes(data.monthKey)
    ? data.availableMonths
    : [data.monthKey, ...data.availableMonths].sort().reverse();

  return (
    <div className={`space-y-6 max-w-5xl transition-opacity ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Header + month navigation */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            Fechamento de {monthLabel(data.monthKey)}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {data.isCurrentMonth
              ? `Mês em andamento — dia ${data.daysElapsed} de ${data.daysInMonth}. Os números se atualizam a cada extrato importado.`
              : 'Mês encerrado: comparativos com o mês anterior e com a sua média recente.'}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => loadMonth(data.previousMonthKey)}
            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select
            value={data.monthKey}
            onChange={(e) => loadMonth(e.target.value)}
            className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-brand-500"
          >
            {monthOptions.map(key => (
              <option key={key} value={key}>{monthLabel(key)}</option>
            ))}
          </select>
          <button
            onClick={() => data.nextMonthKey && loadMonth(data.nextMonthKey)}
            disabled={!data.nextMonthKey}
            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-850">
          <span className="text-xs text-slate-400 block font-medium">Receitas</span>
          <span className="text-lg font-bold text-emerald-400 mt-1 block">{formatCurrency(data.incomeTotal)}</span>
          <ChangeBadge value={data.incomeChangeMoM} />
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-850">
          <span className="text-xs text-slate-400 block font-medium">Despesas</span>
          <span className="text-lg font-bold text-rose-400 mt-1 block">{formatCurrency(data.expenseTotal)}</span>
          <ChangeBadge value={data.expenseChangeMoM} invert suffix={data.isCurrentMonth ? 'projetado vs mês anterior' : 'vs mês anterior'} />
          {data.isCurrentMonth && data.projectedExpenseTotal > data.expenseTotal && (
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Projeção do mês: {formatCurrency(data.projectedExpenseTotal)}
            </span>
          )}
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-850">
          <span className="text-xs text-slate-400 block font-medium">Resultado</span>
          <span className={`text-lg font-bold mt-1 block ${data.savedAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(data.savedAmount)}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">{data.savedAmount >= 0 ? 'Superávit' : 'Déficit'}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-850">
          <span className="text-xs text-slate-400 block font-medium">Taxa de Poupança</span>
          <span className="text-lg font-bold text-brand-400 mt-1 block">{data.savingsRate}%</span>
          <span className="text-[10px] text-slate-500 mt-1 block">Meta saudável: ≥ 20%</span>
        </div>
      </div>

      {/* Financial reserve */}
      <ReserveCard
        reserve={data.reserve}
        mode="summary"
        onOpenDetails={() => setCurrentView('reserve')}
      />

      {/* Next steps */}
      {data.recommendations.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-850">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-3">Próximos passos</span>
          <ul className="space-y-2.5">
            {data.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                <RecommendationIcon type={rec.type} />
                <span>{rec.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Achievements */}
      {data.achievements.length > 0 && (
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Conquistas do Mês</span>
          </div>
          <ul className="space-y-1 text-xs">
            {data.achievements.map((ach, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{ach}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Categories vs recent average */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-850">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Onde o dinheiro foi</h3>
        <p className="text-[11px] text-slate-500 mb-3">Comparado com a sua média dos 3 meses anteriores.</p>
        {data.topCategories.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhuma despesa neste mês. Importe o extrato para ver a análise.</p>
        ) : (
          <div className="space-y-3">
            {data.topCategories.map((cat) => (
              <div key={cat.id} className="space-y-1">
                <div className="flex justify-between items-center text-xs gap-2">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                    {cat.changeVsAverage !== null && Math.abs(cat.changeVsAverage) >= 5 && (
                      <span className={`text-[10px] font-bold ${cat.changeVsAverage > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {cat.changeVsAverage > 0 ? '▲' : '▼'} {Math.abs(cat.changeVsAverage)}%
                      </span>
                    )}
                  </span>
                  <span className="text-slate-300 font-bold">
                    {formatCurrency(cat.total)} ({cat.percentage}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                </div>
                {cat.averagePrevious > 0 && (
                  <span className="text-[10px] text-slate-500 block">Média recente: {formatCurrency(cat.averagePrevious)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Highest single expense */}
      {data.highestExpense && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-850 flex justify-between items-center text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Maior Despesa Individual do Mês</span>
            <span className="text-sm font-bold text-white mt-0.5 block">{data.highestExpense.description}</span>
            <span className="text-slate-400">{data.highestExpense.categoryName} • {formatDate(data.highestExpense.date)}</span>
          </div>
          <span className="text-base font-bold text-rose-400">{formatCurrency(data.highestExpense.amount)}</span>
        </div>
      )}
    </div>
  );
};
