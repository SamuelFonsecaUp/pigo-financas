import React, { useState } from 'react';
import {
  Cloud,
  Lock,
  Mail,
  RefreshCw,
  LogOut,
  AlertCircle,
  DownloadCloud,
  Shield,
  WifiOff,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFinancial } from '../context/FinancialContext';

interface CloudAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({ isOpen, onClose }) => {
  const {
    cloudSession,
    refreshCloudSession,
    triggerSync,
    isSyncing,
    syncStatus,
    syncMessage,
    pendingSyncCount,
    cloudFeaturesMissing,
    showToast,
    refreshAll,
  } = useFinancial();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Session expired: show the login form again (local pending changes are kept)
  const needsReauth = syncStatus === 'auth_expired';
  const isLoggedIn = Boolean(cloudSession?.userId) && !needsReauth;
  const loginEmail = email || (needsReauth ? cloudSession?.email || '' : '');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (!window.electronAPI) return;
      const res = await window.electronAPI.cloudSignIn(loginEmail, password);

      showToast(`Bem-vindo, ${res.user.email}! Carregando seus dados...`, 'info');
      await refreshCloudSession();
      // Download everything from the cloud, then upload what only exists here
      const syncRes = await triggerSync({ fullResync: true });
      await refreshAll();
      if (syncRes?.status === 'synced') {
        showToast('Nuvem conectada e dados sincronizados com sucesso!', 'success');
      } else if (syncRes?.message) {
        showToast(syncRes.message, 'error');
      }
      setPassword('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (!window.electronAPI) return;
      const res = await window.electronAPI.cloudSignUp(loginEmail, password);

      if (res.confirmed) {
        showToast('Conta criada com sucesso e conectada!', 'success');
        await refreshCloudSession();
        await triggerSync();
        await refreshAll();
        onClose();
      } else {
        showToast(res.message || 'Verifique seu e-mail para confirmar a conta.', 'info');
        setMode('signin');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao registrar conta.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.cloudSignOut();
      showToast('Desconectado da nuvem. O aplicativo continua funcionando 100% offline.', 'info');
      await refreshCloudSession();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFullResync = async () => {
    setLoading(true);
    try {
      const res = await triggerSync({ fullResync: true });
      if (res?.status === 'synced') {
        showToast(`Ressincronização completa! ${res.pulledCount || 0} registros conferidos com a nuvem.`, 'success');
      } else if (res?.message) {
        showToast(res.message, res.status === 'offline' ? 'info' : 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sincronização em Nuvem" maxWidth="lg">
      <div className="space-y-5">
        {/* Offline First Guarantee Banner */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3 text-xs text-slate-300">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white block">Arquitetura Local-First (Offline First)</span>
            Seu app funciona 100% no seu SQLite local. A nuvem é usada apenas para backup e para você acessar seus dados em outro computador.
          </div>
        </div>

        {isLoggedIn ? (
          /* Logged In View */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Conectado à Nuvem
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {cloudSession?.lastSyncAt
                    ? `Último sync: ${new Date(cloudSession.lastSyncAt).toLocaleString('pt-BR')}`
                    : 'Ainda não sincronizado'}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">Conta Vinculada</span>
                <span className="text-sm font-bold text-white">{cloudSession?.email}</span>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs text-emerald-400/90">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Conexão criptografada e segura com a nuvem</span>
              </div>

              <div className="text-[11px] text-slate-400">
                {pendingSyncCount > 0
                  ? `${pendingSyncCount} ${pendingSyncCount === 1 ? 'alteração aguardando' : 'alterações aguardando'} envio. Sincroniza automaticamente a cada 3 minutos e ao fechar o app.`
                  : 'Tudo enviado. Sincroniza automaticamente a cada 3 minutos e ao fechar o app.'}
              </div>
            </div>

            {cloudFeaturesMissing.length > 0 && (
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
                <span>
                  Sincronização de {cloudFeaturesMissing.map(f => (f === 'user_settings' ? 'configurações' : 'arquivos de extrato')).join(' e ')} desativada:
                  rode uma vez o arquivo <strong>supabase/migrations/20261005_sync_melhorias.sql</strong> no SQL Editor do Supabase.
                </span>
              </div>
            )}

            {syncStatus === 'error' && syncMessage && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span className="break-words">{syncMessage}</span>
              </div>
            )}

            {/* Actions for Logged In User */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                disabled={isSyncing || loading}
                onClick={async () => {
                  const res = await triggerSync();
                  if (res?.status === 'synced') {
                    showToast('Sincronização concluída com sucesso!', 'success');
                    await refreshAll();
                  } else if (res?.status === 'offline') {
                    showToast('Sem conexão de internet no momento.', 'info');
                  } else if (res?.message) {
                    showToast(res.message, 'error');
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
              </button>

              <button
                disabled={isSyncing || loading}
                onClick={handleFullResync}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-850 hover:bg-slate-800 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold border border-slate-750 transition-all"
                title="Confere todos os registros com a nuvem: baixa o que falta aqui e envia o que só existe neste computador"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-brand-400" />
                Ressincronizar Tudo
              </button>
            </div>

            <div className="pt-2 border-t border-slate-850 flex justify-end">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Desconectar Conta
              </button>
            </div>
          </div>
        ) : (
          /* Login / Register Form */
          <div className="space-y-4">
            {needsReauth && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>
                  Sua sessão na nuvem expirou. Entre novamente para voltar a sincronizar.
                  {pendingSyncCount > 0 && ` Suas ${pendingSyncCount} alterações locais estão guardadas e serão enviadas.`}
                </span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-850">
              <button
                type="button"
                onClick={() => { setMode('signin'); setErrorMsg(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'signin'
                    ? 'bg-brand-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setErrorMsg(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'signup'
                    ? 'bg-brand-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Criar Conta
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Autenticação direta e protegida com criptografia</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2"
              >
                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {mode === 'signin' ? 'Entrar e Sincronizar' : 'Criar Conta no Supabase'}
              </button>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
};
