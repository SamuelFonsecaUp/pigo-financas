import React from 'react';
import { AlertTriangle, Cloud, CloudOff, KeyRound, RefreshCw } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';

export const SyncStatusBadge: React.FC = () => {
  const { cloudSession, syncStatus, syncMessage, pendingSyncCount, isSyncing, setCloudAuthModalOpen } = useFinancial();

  if (!cloudSession || !cloudSession.userId) {
    return (
      <button
        onClick={() => setCloudAuthModalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
        title="Conectar com o Supabase para sincronizar entre computadores"
      >
        <Cloud className="w-3.5 h-3.5 text-slate-400" />
        <span className="hidden sm:inline">Nuvem:</span> Conectar
      </button>
    );
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
        <span className="hidden sm:inline">Sincronizando...</span>
      </div>
    );
  }

  const pendingLabel = pendingSyncCount > 0
    ? ` • ${pendingSyncCount} ${pendingSyncCount === 1 ? 'alteração pendente' : 'alterações pendentes'}`
    : '';

  if (syncStatus === 'auth_expired') {
    return (
      <button
        onClick={() => setCloudAuthModalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
        title={`${syncMessage || 'Sessão expirada.'}${pendingLabel}`}
      >
        <KeyRound className="w-3.5 h-3.5 text-rose-400" />
        Entrar novamente
      </button>
    );
  }

  if (syncStatus === 'error') {
    return (
      <button
        onClick={() => setCloudAuthModalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
        title={`${syncMessage || 'Falha na sincronização.'}${pendingLabel}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden sm:inline">Nuvem:</span> Falha
      </button>
    );
  }

  if (syncStatus === 'offline') {
    return (
      <button
        onClick={() => setCloudAuthModalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-sky-300 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
        title={`Sem internet no momento. Operando 100% offline.${pendingLabel}`}
      >
        <CloudOff className="w-3.5 h-3.5 text-sky-400" />
        <span className="hidden sm:inline">100%</span> Offline
        {pendingSyncCount > 0 && (
          <span className="px-1.5 rounded bg-sky-500/20 text-[10px] font-bold">{pendingSyncCount}</span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => setCloudAuthModalOpen(true)}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
      title={`Sincronizado com o Supabase (${cloudSession.email})${pendingLabel}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span className="hidden sm:inline">Nuvem:</span> Sincronizado
    </button>
  );
};
