import React, { useCallback, useEffect, useState } from 'react';
import { ArchiveRestore, ExternalLink, FolderPlus, HardDriveDownload, History, RefreshCw, X } from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { ConfirmDialog } from './ConfirmDialog';
import { LocalBackupInfo } from '../types';

const REASON_LABEL: Record<string, string> = {
  daily: 'Diário automático',
  manual: 'Manual',
  'pre-restore': 'Antes de restaurar',
  'pre-resync': 'Antes de ressincronizar',
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const LocalBackupsCard: React.FC = () => {
  const { settings, refreshAll, showToast } = useFinancial();
  const [backups, setBackups] = useState<LocalBackupInfo[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<LocalBackupInfo | null>(null);

  const load = useCallback(async () => {
    if (!window.electronAPI?.listLocalBackups) return;
    try {
      const res = await window.electronAPI.listLocalBackups();
      setBackups(res.backups);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBackupNow = async () => {
    setIsWorking(true);
    try {
      await window.electronAPI.createBackupNow();
      showToast('Backup local criado com sucesso!', 'success');
      await load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao criar backup.', 'error');
    } finally {
      setIsWorking(false);
    }
  };

  const handleChooseExtraFolder = async () => {
    const folder = await window.electronAPI.chooseBackupFolder();
    if (!folder) return;
    await window.electronAPI.updateSettings({ autoBackupEnabled: true, autoBackupDir: folder });
    await refreshAll();
    showToast('Os próximos backups também serão copiados para essa pasta.', 'success');
  };

  const handleRemoveExtraFolder = async () => {
    await window.electronAPI.updateSettings({ autoBackupEnabled: false, autoBackupDir: '' });
    await refreshAll();
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setIsWorking(true);
    try {
      // The app restarts with the restored database
      await window.electronAPI.restoreLocalBackup(restoreTarget.fileName);
    } catch (e: any) {
      showToast(e.message || 'Erro ao restaurar backup.', 'error');
      setIsWorking(false);
      setRestoreTarget(null);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-violet-400" />
            Backups Automáticos Locais
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Todo dia o Pigo guarda uma cópia completa do banco neste computador (mantém os últimos 7) e cria uma cópia extra antes de qualquer restauração ou ressincronização.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleBackupNow}
            disabled={isWorking}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {isWorking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDriveDownload className="w-3.5 h-3.5" />}
            Fazer backup agora
          </button>
          <button
            onClick={() => window.electronAPI.openBackupsFolder()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-750 rounded-xl text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir pasta
          </button>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <span className="text-slate-300">
          {settings?.autoBackupEnabled && settings.autoBackupDir
            ? <>Cópia extra em: <strong className="text-white break-all">{settings.autoBackupDir}</strong></>
            : 'Dica: escolha uma pasta do OneDrive/Google Drive ou um pendrive para ter uma cópia fora deste computador.'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleChooseExtraFolder} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-brand-300 hover:bg-brand-500/10">
            <FolderPlus className="w-3.5 h-3.5" />
            {settings?.autoBackupDir ? 'Trocar pasta' : 'Escolher pasta extra'}
          </button>
          {settings?.autoBackupEnabled && settings.autoBackupDir && (
            <button onClick={handleRemoveExtraFolder} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10" title="Parar de copiar para essa pasta">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {backups.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhum backup ainda — o primeiro é criado automaticamente hoje.</p>
      ) : (
        <div className="divide-y divide-slate-850 rounded-xl border border-slate-850 overflow-hidden">
          {backups.slice(0, 12).map(b => (
            <div key={b.fileName} className="px-3 py-2.5 flex items-center justify-between gap-3 bg-slate-950/30">
              <div className="text-xs">
                <span className="text-white font-medium">{new Date(b.createdAt).toLocaleString('pt-BR')}</span>
                <span className="text-slate-500"> • {REASON_LABEL[b.reason] || b.reason} • {formatSize(b.size)}</span>
              </div>
              <button
                onClick={() => setRestoreTarget(b)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-amber-300 hover:bg-amber-500/10"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
                Restaurar
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(restoreTarget)}
        title="Restaurar backup local?"
        message={`Os dados atuais serão substituídos pela cópia de ${restoreTarget ? new Date(restoreTarget.createdAt).toLocaleString('pt-BR') : ''}. Antes disso o Pigo guarda um backup do estado atual, e o app será reiniciado. Se você usa a nuvem, alterações mais recentes feitas em outro computador voltarão na próxima sincronização.`}
        confirmLabel="Restaurar e reiniciar"
        onConfirm={handleRestore}
        onClose={() => setRestoreTarget(null)}
        isDestructive
      />
    </div>
  );
};
