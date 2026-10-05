import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, CheckCircle2, Info, RefreshCw, Rocket } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { AppUpdateStatus } from '../types';

// Escuta o atualizador automático do processo principal
function useUpdateStatus(): AppUpdateStatus | null {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);
  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return;
    return window.electronAPI.onUpdateStatus(setStatus);
  }, []);
  return status;
}

const installUpdate = async () => {
  await window.electronAPI.installUpdate();
};

// Faixa no topo quando uma nova versão já foi baixada
export const UpdateBanner: React.FC = () => {
  const status = useUpdateStatus();
  const [dismissed, setDismissed] = useState(false);
  if (!status || status.state !== 'ready' || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-brand-600/20 border-b border-brand-500/30 text-xs text-brand-100">
      <span className="flex items-center gap-2">
        <Rocket className="w-4 h-4 text-brand-300" />
        A versão {status.version} do Pigo está pronta. Reinicie para atualizar (suas alterações são enviadas à nuvem antes).
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => setDismissed(true)} className="px-2 py-1 rounded-md text-brand-200 hover:bg-brand-500/20">
          Depois
        </button>
        <button onClick={installUpdate} className="px-3 py-1 rounded-md font-semibold text-white bg-brand-600 hover:bg-brand-500">
          Reiniciar e atualizar
        </button>
      </div>
    </div>
  );
};

// Cartão nas Configurações: versão atual e verificação manual
export const AppVersionCard: React.FC = () => {
  const { showToast } = useFinancial();
  const status = useUpdateStatus();
  const [info, setInfo] = useState<{ version: string; canAutoUpdate: boolean } | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then(setInfo).catch(() => {});
  }, []);

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      const res = await window.electronAPI.checkForUpdates();
      if (res.state === 'up_to_date') showToast('Você já está na versão mais recente.', 'success');
      else if (res.state === 'downloading') showToast(`Baixando a versão ${res.version}...`, 'info');
    } catch (e: any) {
      showToast(e.message || 'Não foi possível verificar atualizações agora.', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <ArrowUpCircle className="w-5 h-5 text-brand-400" />
          Versão do Pigo {info ? info.version : ''}
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          {info?.canAutoUpdate
            ? 'O Pigo se atualiza sozinho: baixa novas versões em segundo plano e avisa quando estiver pronto. Mantenha os dois computadores atualizados para a sincronização funcionar sem surpresas.'
            : 'Atualização automática disponível apenas na versão instalada (instalador "Pigo Setup"). Esta cópia é de desenvolvimento ou portátil.'}
        </p>
      </div>
      {info?.canAutoUpdate ? (
        status?.state === 'ready' ? (
          <button onClick={installUpdate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 shrink-0">
            <Rocket className="w-4 h-4" />
            Reiniciar e atualizar para {status.version}
          </button>
        ) : status?.state === 'downloading' ? (
          <span className="flex items-center gap-2 text-xs text-slate-300 shrink-0">
            <RefreshCw className="w-4 h-4 animate-spin" /> Baixando {status.version}...
          </span>
        ) : (
          <button
            onClick={handleCheck}
            disabled={isChecking}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-750 shrink-0 disabled:opacity-50"
          >
            {isChecking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            Verificar atualizações
          </button>
        )
      ) : (
        <Info className="w-5 h-5 text-slate-500 shrink-0" />
      )}
    </div>
  );
};
