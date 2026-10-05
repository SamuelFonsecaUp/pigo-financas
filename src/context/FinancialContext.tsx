import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Account,
  Category,
  CreditCard,
  Goal,
  Settings,
  DashboardData,
  Transaction,
  CategoryBudget,
  NotificationItem,
  PendingImportSession,
  CloudSession,
  SyncResult,
  SyncStatus,
} from '../types';

// Intervalo da sincronização automática em segundo plano
const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 1000;

export type AppView =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'reserve'
  | 'cards'
  | 'budgets'
  | 'calendar'
  | 'categories'
  | 'goals'
  | 'reports'
  | 'settings'
  | 'import'
  | 'intelligence';

interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface FinancialContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  isLocked: boolean;
  unlockApp: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  settings: Settings | null;
  accounts: Account[];
  categories: Category[];
  creditCards: CreditCard[];
  goals: Goal[];
  budgets: CategoryBudget[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  refreshNotifications: () => Promise<void>;
  dashboardData: DashboardData | null;
  isLoading: boolean;
  refreshAll: () => Promise<void>;
  toasts: ToastInfo[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;

  // Global modals control
  transactionModalOpen: boolean;
  setTransactionModalOpen: (open: boolean) => void;
  editingTransaction: Transaction | null;
  openNewTransaction: (initial?: Partial<Transaction>) => void;
  openEditTransaction: (tx: Transaction) => void;
  closeTransactionModal: () => void;

  // Banking import modal & full-page view
  importModalOpen: boolean;
  setImportModalOpen: (open: boolean) => void;
  pendingImportSession: PendingImportSession | null;
  saveImportSession: (session: PendingImportSession) => void;
  clearImportSession: () => void;
  resumeImportSession: () => void;

  // Navigation with filter
  filterAccountId: string | null;
  setFilterAccountId: (id: string | null) => void;
  navigateToAccountTransactions: (accountId: string) => void;

  // Theme (Dark / Light)
  theme: 'dark' | 'light';
  toggleTheme: () => Promise<void>;

  // Cloud Auth & Sync (Supabase / Local-First)
  cloudSession: CloudSession | null;
  syncStatus: SyncStatus;
  syncMessage: string | null;
  pendingSyncCount: number;
  cloudFeaturesMissing: string[];
  isSyncing: boolean;
  cloudAuthModalOpen: boolean;
  setCloudAuthModalOpen: (open: boolean) => void;
  refreshCloudSession: () => Promise<void>;
  triggerSync: (options?: { fullResync?: boolean; silent?: boolean }) => Promise<SyncResult | null>;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const applyTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    if (t === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  };

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    if (window.electronAPI) {
      try {
        await window.electronAPI.updateSettings({ theme: next });
      } catch (e) {
        console.error('Failed to save theme preference:', e);
      }
    }
  }, [theme]);

  // Transaction Modal State
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Bank Import Modal & Draft State
  const [importModalOpen, setImportModalOpenState] = useState(false);

  // Pending import session draft state with localStorage caching
  const [pendingImportSession, setPendingImportSession] = useState<PendingImportSession | null>(() => {
    try {
      const saved = localStorage.getItem('meu_financeiro_import_draft');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const saveImportSession = useCallback((session: PendingImportSession) => {
    setPendingImportSession(session);
    try {
      localStorage.setItem('meu_financeiro_import_draft', JSON.stringify(session));
    } catch {}
  }, []);

  const clearImportSession = useCallback(() => {
    setPendingImportSession(null);
    try {
      localStorage.removeItem('meu_financeiro_import_draft');
    } catch {}
  }, []);

  const setImportModalOpen = useCallback((open: boolean) => {
    if (open) {
      setCurrentView('import');
    }
    setImportModalOpenState(false);
  }, []);

  const resumeImportSession = useCallback(() => {
    setCurrentView('import');
  }, []);

  // Filtered navigation state
  const [filterAccountId, setFilterAccountId] = useState<string | null>(null);

  const navigateToAccountTransactions = useCallback((accId: string) => {
    setFilterAccountId(accId);
    setCurrentView('transactions');
  }, []);

  // Cloud Auth & Sync (Supabase / Local-First)
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local_only');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [cloudFeaturesMissing, setCloudFeaturesMissing] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudAuthModalOpen, setCloudAuthModalOpen] = useState(false);
  // refreshAll is declared later; the ref lets triggerSync reload the UI after a pull
  const refreshAllRef = useRef<() => Promise<void>>(async () => {});
  const syncInFlightRef = useRef(false);

  const refreshCloudSession = useCallback(async () => {
    if (!window.electronAPI?.getCloudSession) return;
    try {
      const s = await window.electronAPI.getCloudSession();
      setCloudSession(s);
      if (!s?.userId) {
        setSyncStatus('local_only');
      }
      if (window.electronAPI.getCloudPendingCount) {
        setPendingSyncCount(await window.electronAPI.getCloudPendingCount());
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const triggerSync = useCallback(async (
    options: { fullResync?: boolean; silent?: boolean } = {}
  ): Promise<SyncResult | null> => {
    if (!window.electronAPI?.triggerCloudSync || syncInFlightRef.current) return null;
    syncInFlightRef.current = true;
    if (!options.silent) {
      setIsSyncing(true);
      setSyncStatus('syncing');
    }
    try {
      const res = await window.electronAPI.triggerCloudSync({ fullResync: options.fullResync });
      if (res.status !== 'syncing') {
        setSyncStatus(res.status);
        setSyncMessage(res.message || null);
      }
      if (typeof res.pendingCount === 'number') setPendingSyncCount(res.pendingCount);
      if (Array.isArray(res.featuresMissing)) setCloudFeaturesMissing(res.featuresMissing);
      if ((res.pulledCount || 0) > 0 || (res.deletedCount || 0) > 0 || options.fullResync) {
        await refreshAllRef.current();
      }
      await refreshCloudSession();
      return res;
    } catch (e: any) {
      setSyncStatus('error');
      setSyncMessage(e?.message || 'Falha ao sincronizar.');
      return null;
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshCloudSession]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.getNotifications();
      setNotifications(res.notifications);
      setUnreadNotificationsCount(res.unreadCount);
    } catch (e) {
      console.error('Error refreshing notifications:', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      if (!window.electronAPI) return;

      const [s, accs, cats, cards, gls, bdgs, notifs, dash] = await Promise.all([
        window.electronAPI.getSettings(),
        window.electronAPI.getAccounts(true),
        window.electronAPI.getCategories(),
        window.electronAPI.getCreditCards(true),
        window.electronAPI.getGoals(),
        window.electronAPI.getCategoryBudgets(),
        window.electronAPI.getNotifications(),
        window.electronAPI.getDashboardData(),
      ]);

      setSettings(s);
      setAccounts(accs);
      setCategories(cats);
      setCreditCards(cards);
      setGoals(gls);
      setBudgets(bdgs);
      setNotifications(notifs.notifications);
      setUnreadNotificationsCount(notifs.unreadCount);
      setDashboardData(dash);

      if (window.electronAPI.getCloudPendingCount) {
        window.electronAPI.getCloudPendingCount().then(setPendingSyncCount).catch(() => {});
      }

      // Apply theme
      const currentTheme = s?.theme === 'light' ? 'light' : 'dark';
      applyTheme(currentTheme);
    } catch (err: any) {
      console.error('Error refreshing data:', err);
      showToast(err.message || 'Erro ao carregar dados do banco local.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Initial load & PIN check
  useEffect(() => {
    async function init() {
      if (!window.electronAPI) {
        setIsLoading(false);
        return;
      }
      try {
        const pinConfigured = await window.electronAPI.isPinConfigured();
        if (pinConfigured) {
          setIsLocked(true);
        }
        await refreshAll();
        await refreshCloudSession();
        // Background sync on startup: pulls what other computers changed
        triggerSync({ silent: true });
      } catch (e: any) {
        console.error('Init error:', e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [refreshAll, refreshCloudSession, triggerSync]);

  useEffect(() => {
    refreshAllRef.current = refreshAll;
  }, [refreshAll]);

  // Keep computers in sync: periodic cycle, on window focus and when the network returns
  useEffect(() => {
    if (!cloudSession?.userId) return;
    const runSilent = () => { triggerSync({ silent: true }); };
    const interval = setInterval(runSilent, AUTO_SYNC_INTERVAL_MS);
    window.addEventListener('focus', runSilent);
    window.addEventListener('online', runSilent);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', runSilent);
      window.removeEventListener('online', runSilent);
    };
  }, [cloudSession?.userId, triggerSync]);

  // Global Keyboard Shortcuts (Desktop Productivity)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLocked) return;

      // Ctrl+N -> New Transaction
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingTransaction(null);
        setTransactionModalOpen(true);
      }
      // Ctrl+F -> Search Focus
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setCurrentView('transactions');
        setTimeout(() => {
          const searchInput = document.querySelector('input[placeholder*="Pesquisar"]') as HTMLInputElement;
          if (searchInput) searchInput.focus();
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked]);

  const unlockApp = async (pin: string): Promise<boolean> => {
    if (!window.electronAPI) return true;
    try {
      const valid = await window.electronAPI.verifyPin(pin);
      if (valid) {
        setIsLocked(false);
        showToast('Aplicativo desbloqueado.', 'info');
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const lockApp = () => {
    if (settings?.pinEnabled) {
      setIsLocked(true);
    }
  };

  const openNewTransaction = (initial?: Partial<Transaction>) => {
    setEditingTransaction(initial as Transaction || null);
    setTransactionModalOpen(true);
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setTransactionModalOpen(true);
  };

  const closeTransactionModal = () => {
    setEditingTransaction(null);
    setTransactionModalOpen(false);
  };

  return (
    <FinancialContext.Provider
      value={{
        currentView,
        setCurrentView,
        isLocked,
        unlockApp,
        lockApp,
        settings,
        accounts,
        categories,
        creditCards,
        goals,
        budgets,
        notifications,
        unreadNotificationsCount,
        notificationsOpen,
        setNotificationsOpen,
        refreshNotifications,
        dashboardData,
        isLoading,
        refreshAll,
        toasts,
        showToast,
        dismissToast,
        transactionModalOpen,
        setTransactionModalOpen,
        editingTransaction,
        openNewTransaction,
        openEditTransaction,
        closeTransactionModal,
        importModalOpen,
        setImportModalOpen,
        pendingImportSession,
        saveImportSession,
        clearImportSession,
        resumeImportSession,
        filterAccountId,
        setFilterAccountId,
        navigateToAccountTransactions,
        theme,
        toggleTheme,
        cloudSession,
        syncStatus,
        syncMessage,
        pendingSyncCount,
        cloudFeaturesMissing,
        isSyncing,
        cloudAuthModalOpen,
        setCloudAuthModalOpen,
        refreshCloudSession,
        triggerSync,
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
};

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial must be used within a FinancialProvider');
  }
  return context;
};
