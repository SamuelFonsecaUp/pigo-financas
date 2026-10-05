import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { Modal } from '../components/Modal';
import { ReserveCard, monthLabel } from '../components/ReserveCard';
import { formatCurrency, formatDate, getTodayDateString, parseCurrencyInputToCents } from '../utils/formatters';
import { ReserveMovement, ReserveStatus } from '../types';

const SOURCE_LABEL: Record<ReserveMovement['source'], string> = {
  category: 'Categoria',
  detected: 'Detectado no extrato',
  transfer: 'Transferência',
};

function addMonths(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const ReserveView: React.FC = () => {
  const { accounts, showToast, refreshAll } = useFinancial();
  const currentKey = getTodayDateString().slice(0, 7);
  const [monthKey, setMonthKey] = useState(currentKey);
  const [reserve, setReserve] = useState<ReserveStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalKind, setModalKind] = useState<'aporte' | 'resgate' | null>(null);

  const load = useCallback(async () => {
    if (!window.electronAPI) return;
    setIsLoading(true);
    try {
      setReserve(await window.electronAPI.getReserveOverview(monthKey));
    } catch (e) {
      console.error(e);
      showToast('Erro ao calcular a reserva financeira.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [monthKey, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExcluded = async (movement: ReserveMovement) => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.setReserveTransactionExcluded(movement.id, !movement.excluded);
      await load();
    } catch (e) {
      showToast('Não foi possível atualizar o lançamento.', 'error');
    }
  };

  if (isLoading && !reserve) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Calculando sua reserva...</span>
      </div>
    );
  }
  if (!reserve) return null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className={`max-w-5xl space-y-6 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Reserva Financeira
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Seu colchão de segurança, calculado a partir dos extratos importados: aplicações, resgates e contas de reserva.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMonthKey(k => addMonths(k, -1))}
                className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-white min-w-[130px] text-center">{monthLabel(monthKey)}</span>
              <button
                onClick={() => setMonthKey(k => addMonths(k, 1))}
                disabled={monthKey >= currentKey}
                className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setModalKind('aporte')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Registrar aporte
            </button>
            <button
              onClick={() => setModalKind('resgate')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 bg-slate-850 hover:bg-slate-800 border border-slate-750 transition-all"
            >
              <ArrowDownCircle className="w-4 h-4 text-rose-400" />
              Registrar resgate
            </button>
          </div>
        </div>

        <ReserveCard reserve={reserve} mode="full" onChanged={load} />

        {/* Movements */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-850">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">Movimentações da reserva</h3>
          <p className="text-[11px] text-slate-500 mb-4">
            Aplicações e resgates encontrados nos seus lançamentos. Se algum não for reserva, clique em "Ignorar" e o Pigo deixa de contar.
          </p>
          {reserve.movements.length === 0 ? (
            <p className="text-xs text-slate-400">
              Nenhuma movimentação encontrada até {monthLabel(monthKey)}. Importe extratos com aplicações/resgates ou registre um aporte.
            </p>
          ) : (
            <div className="divide-y divide-slate-850">
              {reserve.movements.map(m => (
                <div key={m.id} className={`py-2.5 flex items-center justify-between gap-3 ${m.excluded ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {m.kind === 'aporte'
                      ? <ArrowUpCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      : <ArrowDownCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                    <div className="min-w-0">
                      <span className={`text-xs font-semibold text-white block truncate ${m.excluded ? 'line-through' : ''}`}>
                        {m.description.split('\n')[0]}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {formatDate(m.date)} • {m.accountName || 'Conta'} • {SOURCE_LABEL[m.source]}
                        {m.categoryName ? ` • ${m.categoryName}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-bold ${m.kind === 'aporte' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {m.kind === 'aporte' ? '+' : '-'} {formatCurrency(Math.abs(m.amount))}
                    </span>
                    {m.source !== 'transfer' && (
                      <button
                        onClick={() => toggleExcluded(m)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                        title={m.excluded ? 'Voltar a contar na reserva' : 'Não é movimento da reserva'}
                      >
                        {m.excluded ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {m.excluded ? 'Contar' : 'Ignorar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalKind && (
        <ReserveMovementModal
          kind={modalKind}
          reserve={reserve}
          accounts={accounts.filter(a => a.active)}
          onClose={() => setModalKind(null)}
          onSaved={async () => {
            setModalKind(null);
            await refreshAll();
            await load();
          }}
        />
      )}
    </div>
  );
};

interface ReserveMovementModalProps {
  kind: 'aporte' | 'resgate';
  reserve: ReserveStatus;
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const ReserveMovementModal: React.FC<ReserveMovementModalProps> = ({ kind, reserve, accounts, onClose, onSaved }) => {
  const { showToast } = useFinancial();
  const reserveAccounts = reserve.accounts.filter(a => a.isReserve);
  const reserveCategories = reserve.categories.filter(c => c.isReserve);
  const regularAccounts = accounts.filter(a => !reserveAccounts.some(r => r.id === a.id));

  const [amountInput, setAmountInput] = useState(
    kind === 'aporte' && reserve.suggestedContribution > 0
      ? (reserve.suggestedContribution / 100).toFixed(2).replace('.', ',')
      : ''
  );
  const [date, setDate] = useState(getTodayDateString());
  const [accountId, setAccountId] = useState(regularAccounts[0]?.id || '');
  // 'outside:<categoryId>' = reserva fora do app (CDB, caixinha); senão id da conta de reserva
  const [destination, setDestination] = useState(
    reserveAccounts[0]?.id || `outside:${reserveCategories[0]?.id || 'cat_investimentos'}`
  );
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electronAPI) return;
    const amount = parseCurrencyInputToCents(amountInput);
    if (amount <= 0) {
      showToast('Informe um valor maior que zero.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const outside = destination.startsWith('outside:');
      await window.electronAPI.registerReserveMovement({
        kind,
        amount,
        date,
        accountId,
        reserveAccountId: outside ? null : destination,
        categoryId: outside ? destination.slice('outside:'.length) : null,
        description: description.trim() || undefined,
      });
      showToast(kind === 'aporte' ? 'Aporte registrado na reserva!' : 'Resgate registrado.', 'success');
      await onSaved();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível registrar o movimento.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = 'w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={kind === 'aporte' ? 'Registrar aporte na reserva' : 'Registrar resgate da reserva'}
      subtitle="Use quando o movimento ainda não veio em um extrato importado."
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Valor (R$)</label>
            <input autoFocus inputMode="decimal" placeholder="0,00" value={amountInput} onChange={e => setAmountInput(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            {kind === 'aporte' ? 'Saindo da conta' : 'Entrando na conta'}
          </label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputClass} required>
            {regularAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            {kind === 'aporte' ? 'Para onde vai' : 'De onde vem'}
          </label>
          <select value={destination} onChange={e => setDestination(e.target.value)} className={inputClass}>
            {reserveAccounts.map(a => <option key={a.id} value={a.id}>Conta: {a.name}</option>)}
            {(reserveCategories.length > 0 ? reserveCategories : [{ id: 'cat_investimentos', name: 'Investimentos' }]).map(c => (
              <option key={c.id} value={`outside:${c.id}`}>Investimento fora do app (categoria {c.name})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Descrição (opcional)</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={kind === 'aporte' ? 'Ex.: Aplicação CDB Nubank' : 'Ex.: Resgate caixinha'}
            className={inputClass}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving || !accountId}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
