import React, { useEffect, useState } from 'react';
import { ArrowRight, PiggyBank, Settings2, ShieldCheck } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, parseCurrencyInputToCents } from '../utils/formatters';
import { ReserveStatus } from '../types';

const TARGET_MONTH_OPTIONS = [3, 6, 9, 12];

export const RESERVE_STATUS_STYLE: Record<ReserveStatus['status'], { label: string; color: string }> = {
  not_configured: { label: 'Não configurada', color: '#94a3b8' },
  critical: { label: 'Crítica', color: '#ef4444' },
  building: { label: 'Em construção', color: '#f59e0b' },
  good: { label: 'Boa', color: '#3b82f6' },
  complete: { label: 'Completa', color: '#10b981' },
};

export function monthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  if (style === 'short') {
    return date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  }
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface ReserveCardProps {
  reserve: ReserveStatus;
  // 'full': configuração + gráfico (tela Reserva); 'summary': indicadores + atalho (fechamento)
  mode: 'full' | 'summary';
  onChanged?: () => Promise<void> | void;
  onOpenDetails?: () => void;
}

export const ReserveCard: React.FC<ReserveCardProps> = ({ reserve, mode, onChanged, onOpenDetails }) => {
  const { showToast } = useFinancial();
  const [showConfig, setShowConfig] = useState(mode === 'full' && reserve.status === 'not_configured');
  const [isSaving, setIsSaving] = useState(false);
  const [initialAmountInput, setInitialAmountInput] = useState('');
  const style = RESERVE_STATUS_STYLE[reserve.status];

  const selectedAccountIds = reserve.accounts.filter(a => a.isReserve).map(a => a.id);
  const selectedCategoryIds = reserve.categories.filter(c => c.isReserve).map(c => c.id);

  useEffect(() => {
    setInitialAmountInput(
      reserve.initialAmount > 0 && !reserve.initialAmountEstimated
        ? (reserve.initialAmount / 100).toFixed(2).replace('.', ',')
        : ''
    );
  }, [reserve.initialAmount, reserve.initialAmountEstimated]);

  const saveConfig = async (changes: {
    targetMonths?: number;
    accountIds?: string[];
    categoryIds?: string[];
    initialAmount?: number;
    autoDetect?: boolean;
  }) => {
    if (!window.electronAPI) return;
    setIsSaving(true);
    try {
      await window.electronAPI.updateSettings({
        reserveTargetMonths: changes.targetMonths ?? reserve.targetMonths,
        reserveAccountIds: changes.accountIds ?? selectedAccountIds,
        reserveCategoryIds: changes.categoryIds ?? selectedCategoryIds,
        reserveInitialAmount: changes.initialAmount ?? (reserve.initialAmountEstimated ? 0 : reserve.initialAmount),
        reserveAutoDetect: changes.autoDetect ?? reserve.autoDetect,
      });
      await onChanged?.();
    } catch (e) {
      console.error(e);
      showToast('Não foi possível salvar a configuração da reserva.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const commitInitialAmount = () => {
    const cents = parseCurrencyInputToCents(initialAmountInput);
    const current = reserve.initialAmountEstimated ? 0 : reserve.initialAmount;
    if (cents !== current) saveConfig({ initialAmount: cents });
  };

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/80 border border-slate-800 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl border" style={{ backgroundColor: `${style.color}1a`, borderColor: `${style.color}4d`, color: style.color }}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Reserva Financeira</h3>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                style={{ backgroundColor: `${style.color}1a`, borderColor: `${style.color}4d`, color: style.color }}
              >
                {style.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">{reserve.message}</p>
          </div>
        </div>
        {mode === 'full' ? (
          <button
            onClick={() => setShowConfig(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all shrink-0 ${
              showConfig
                ? 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                : 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border-slate-800'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Configurar
          </button>
        ) : (
          onOpenDetails && (
            <button
              onClick={onOpenDetails}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border-slate-800 transition-all shrink-0"
            >
              Abrir Reserva
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )
        )}
      </div>

      {/* Configuration */}
      {mode === 'full' && showConfig && (
        <div className={`p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-5 ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}>
          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-2">Meta de proteção (meses de custo de vida)</span>
            <div className="flex flex-wrap gap-1.5">
              {TARGET_MONTH_OPTIONS.map(months => (
                <button
                  key={months}
                  onClick={() => saveConfig({ targetMonths: months })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    reserve.targetMonths === months
                      ? 'bg-brand-600 text-white border-brand-500'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {months} meses
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={reserve.autoDetect}
              onChange={(e) => saveConfig({ autoDetect: e.target.checked })}
              className="accent-brand-500 mt-0.5"
            />
            <span>
              <span className="text-xs font-semibold text-slate-200 block">Detectar aplicações e resgates pelos extratos</span>
              <span className="text-[11px] text-slate-500">
                Lançamentos com "Aplicação", "Resgate", "CDB", "Caixinha", "Renda Fixa", "Tesouro"... entram automaticamente como movimento da reserva.
              </span>
            </span>
          </label>

          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-1">Contas que são reserva</span>
            <span className="text-[11px] text-slate-500 block mb-2">
              {reserve.usingDefaultAccounts
                ? 'Por padrão, contas do tipo poupança e investimento. Marque/desmarque para personalizar.'
                : 'Seleção personalizada.'}
            </span>
            {reserve.accounts.length === 0 ? (
              <span className="text-xs text-slate-400">Nenhuma conta cadastrada.</span>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {reserve.accounts.map(acc => (
                  <label
                    key={acc.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                      acc.isReserve ? 'bg-brand-500/10 border-brand-500/30' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs text-white font-medium">
                      <input
                        type="checkbox"
                        checked={acc.isReserve}
                        onChange={() => saveConfig({ accountIds: toggle(selectedAccountIds, acc.id) })}
                        className="accent-brand-500"
                      />
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                      {acc.name}
                    </span>
                    <span className="text-xs text-slate-400">{formatCurrency(acc.balance)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-1">Categorias de aporte</span>
            <span className="text-[11px] text-slate-500 block mb-2">
              Saídas nessas categorias contam como aporte e entradas como resgate; não entram no custo de vida.
              {reserve.usingDefaultCategories && ' Detectadas automaticamente pelo nome.'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {reserve.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => saveConfig({ categoryIds: toggle(selectedCategoryIds, cat.id) })}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                    cat.isReserve
                      ? 'bg-brand-500/15 border-brand-500/40 text-white font-semibold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-1">Saldo guardado antes dos extratos</span>
            <span className="text-[11px] text-slate-500 block mb-2">
              {reserve.initialAmountEstimated
                ? `Estimado em ${formatCurrency(reserve.initialAmount)} pelos resgates encontrados. Informe o valor real se souber.`
                : 'Quanto você já tinha investido antes do primeiro extrato importado.'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">R$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder={reserve.initialAmountEstimated ? (reserve.initialAmount / 100).toFixed(2).replace('.', ',') : '0,00'}
                value={initialAmountInput}
                onChange={(e) => setInitialAmountInput(e.target.value)}
                onBlur={commitInitialAmount}
                onKeyDown={(e) => { if (e.key === 'Enter') commitInitialAmount(); }}
                className="w-40 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>
      )}

      {reserve.status !== 'not_configured' && (
        <>
          {/* Balance & progress */}
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">Saldo da reserva</span>
                <span className="text-2xl font-bold text-white">{formatCurrency(reserve.balance)}</span>
                {reserve.initialAmountEstimated && (
                  <span className="text-[10px] text-slate-500 block">inclui {formatCurrency(reserve.initialAmount)} estimados de antes dos extratos</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">
                  Meta: {formatCurrency(reserve.targetAmount)} ({reserve.targetMonths} meses)
                </span>
                <span className="text-xs font-bold" style={{ color: style.color }}>
                  {reserve.coverageMonths} {reserve.coverageMonths === 1 ? 'mês coberto' : 'meses cobertos'}
                </span>
              </div>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${reserve.progressPercent}%`, backgroundColor: style.color }} />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">{reserve.progressPercent}% da meta</span>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-850">
              <span className="text-[11px] text-slate-400 block">Variação no mês</span>
              <span className={`text-sm font-bold mt-0.5 block ${reserve.monthContribution >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(reserve.monthContribution, true)}
              </span>
              {(reserve.monthAportes > 0 || reserve.monthResgates > 0) && (
                <span className="text-[10px] text-slate-500 block">
                  +{formatCurrency(reserve.monthAportes)} / -{formatCurrency(reserve.monthResgates)}
                </span>
              )}
            </div>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-850">
              <span className="text-[11px] text-slate-400 block">Média últimos 3 meses</span>
              <span className="text-sm font-bold text-white mt-0.5 block">{formatCurrency(reserve.averageContribution, true)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-850">
              <span className="text-[11px] text-slate-400 block">Custo de vida mensal</span>
              <span className="text-sm font-bold text-white mt-0.5 block">{formatCurrency(reserve.monthlyCost)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-850">
              <span className="text-[11px] text-slate-400 block">{reserve.gap === 0 ? 'Meta atingida' : 'Previsão para completar'}</span>
              <span className="text-sm font-bold text-white mt-0.5 block">
                {reserve.gap === 0
                  ? '✓'
                  : reserve.estimatedCompletion
                    ? monthLabel(reserve.estimatedCompletion)
                    : 'Sem aportes recentes'}
              </span>
            </div>
          </div>

          {reserve.suggestedContribution > 0 && (
            <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/30 text-xs text-brand-200 flex items-start gap-2">
              <PiggyBank className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <span>
                Sugestão para {monthLabel(reserve.monthKey)}: aplicar <strong className="text-white">{formatCurrency(reserve.suggestedContribution)}</strong> na reserva.
                {reserve.gap > 0 && ` Faltam ${formatCurrency(reserve.gap)} para a meta.`}
              </span>
            </div>
          )}

          {/* Evolution chart */}
          {mode === 'full' && (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={reserve.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reserveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={style.color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={style.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="monthKey" tickFormatter={(k) => monthLabel(k, 'short')} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tickFormatter={(v) => `R$ ${Math.round(v / 100).toLocaleString('pt-BR')}`}
                  />
                  <Tooltip
                    formatter={(v: any, name: any) => {
                      const labels: Record<string, string> = { balance: 'Saldo', aportes: 'Aportes', resgates: 'Resgates' };
                      return [formatCurrency(Number(v)), labels[String(name)] || String(name)];
                    }}
                    labelFormatter={(k: any) => monthLabel(String(k))}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12 }}
                  />
                  {reserve.targetAmount > 0 && (
                    <ReferenceLine
                      y={reserve.targetAmount}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{ value: 'Meta', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }}
                    />
                  )}
                  <Bar dataKey="aportes" fill="#10b981" opacity={0.6} barSize={10} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="resgates" fill="#f43f5e" opacity={0.6} barSize={10} radius={[3, 3, 0, 0]} />
                  <Area type="monotone" dataKey="balance" stroke={style.color} strokeWidth={2} fill="url(#reserveGradient)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
};
