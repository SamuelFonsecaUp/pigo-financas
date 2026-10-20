import React, { useState, useEffect } from 'react';
import {
  WalletCards,
  Cloud,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Landmark,
  Tag,
  Plus,
  Trash2,
  CheckSquare,
  GraduationCap,
  Trophy,
  FileSpreadsheet,
  Zap,
  Minus,
  Square,
  X,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { useHabits } from '../context/HabitsContext';
import { AccountType, Category } from '../types';
import pigoIcon from '../assets/pigo-icon.png';

export const MANDATORY_ONBOARDING_KEY = 'pigo_mandatory_onboarding_v2';

export function hasCompletedMandatoryOnboarding(onboardingCompleted?: boolean): boolean {
  try {
    return Boolean(onboardingCompleted) && localStorage.getItem(MANDATORY_ONBOARDING_KEY) === '1';
  } catch {
    return Boolean(onboardingCompleted);
  }
}

interface DraftAccount {
  tempId: string;
  name: string;
  type: AccountType;
  color: string;
  balanceStr: string;
}

interface DraftCategory {
  id?: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  enabled: boolean;
  isNew?: boolean;
}

const BANK_PRESETS: { name: string; color: string; type: AccountType }[] = [
  { name: 'Nubank', color: '#8b5cf6', type: 'checking' },
  { name: 'Itaú', color: '#f97316', type: 'checking' },
  { name: 'Banco Inter', color: '#fb923c', type: 'checking' },
  { name: 'C6 Bank', color: '#64748b', type: 'checking' },
  { name: 'Santander', color: '#ef4444', type: 'checking' },
  { name: 'Bradesco', color: '#e11d48', type: 'checking' },
  { name: 'Caixa / BB', color: '#3b82f6', type: 'checking' },
  { name: 'Carteira Física', color: '#10b981', type: 'cash' },
];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança / Caixinha',
  investment: 'Investimentos / Corretora',
  cash: 'Dinheiro Físico',
  other: 'Outra',
};

const COLOR_SWATCHES = [
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

function formatCentsInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '0,00';
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseFormattedToCents(formatted: string): number {
  if (!formatted) return 0;
  const clean = formatted.replace(/\./g, '').replace(',', '.');
  return Math.round((parseFloat(clean) || 0) * 100);
}

interface OnboardingViewProps {
  onComplete?: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const { refreshAll, showToast, refreshCloudSession, settings, accounts, categories } =
    useFinancial();
  const { loadHabits } = useHabits();

  const [mode, setMode] = useState<'wizard' | 'cloud'>('wizard');
  const [cloudTab, setCloudTab] = useState<'signin' | 'signup'>('signin');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<number>(1);

  // Cloud form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 1: User Profile & Tutorial Read Confirmation
  const [userName, setUserName] = useState(
    settings?.userName && settings.userName !== 'Usuário' ? settings.userName : ''
  );

  // Step 2: Accounts
  const [draftAccounts, setDraftAccounts] = useState<DraftAccount[]>(() => {
    if (accounts && accounts.length > 0) {
      return accounts.map((a) => ({
        tempId: a.id,
        name: a.name,
        type: a.type,
        color: a.color || '#8b5cf6',
        balanceStr: (a.initialBalance / 100).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      }));
    }
    return [
      {
        tempId: 'acc_1',
        name: 'Nubank',
        type: 'checking',
        color: '#8b5cf6',
        balanceStr: '0,00',
      },
    ];
  });

  // Step 3: Categories
  const [draftCategories, setDraftCategories] = useState<DraftCategory[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [newCatColor, setNewCatColor] = useState('#10b981');

  useEffect(() => {
    if (categories && categories.length > 0 && draftCategories.length === 0) {
      setDraftCategories(
        categories.map((c: Category) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          color: c.color,
          icon: c.icon || 'Tag',
          enabled: true,
        }))
      );
    }
  }, [categories, draftCategories.length]);

  // Step 4: Emergency Reserve
  const [reserveTargetMonths, setReserveTargetMonths] = useState<number>(
    settings?.reserveTargetMonths || 6
  );
  const [reserveSetupMode, setReserveSetupMode] = useState<'dedicated' | 'existing'>('dedicated');
  const [dedicatedReserveName, setDedicatedReserveName] = useState(
    'Caixinha / Reserva de Emergência'
  );
  const [dedicatedReserveBalance, setDedicatedReserveBalance] = useState('0,00');
  const [selectedReserveAccTempId, setSelectedReserveAccTempId] = useState<string>('acc_1');

  // Step 5: Starter Habit Packs & Custom Specific Habits
  const [installFinanceHabits, setInstallFinanceHabits] = useState(true);
  const [installMorningHabits, setInstallMorningHabits] = useState(true);
  const [customHabitName, setCustomHabitName] = useState('');
  const [customHabitCategory, setCustomHabitCategory] = useState<string>('saude');
  const [customHabitPeriod, setCustomHabitPeriod] = useState<string>('anytime');
  const [customHabits, setCustomHabits] = useState<
    Array<{
      tempId: string;
      name: string;
      category: string;
      period_of_day: string;
      color: string;
    }>
  >([]);

  const handleAddCustomHabit = () => {
    const trimmed = customHabitName.trim();
    if (!trimmed) {
      showToast('Digite o nome do hábito para adicionar.', 'info');
      return;
    }
    if (customHabits.some((h) => h.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Esse hábito já foi adicionado na sua lista.', 'info');
      return;
    }
    const categoryColors: Record<string, string> = {
      saude: '#38bdf8',
      financas: '#10b981',
      mente: '#a855f7',
      produtividade: '#6366f1',
      rotina: '#f59e0b',
      geral: '#ec4899',
    };
    setCustomHabits((prev) => [
      ...prev,
      {
        tempId: `hab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        category: customHabitCategory,
        period_of_day: customHabitPeriod,
        color: categoryColors[customHabitCategory] || '#a855f7',
      },
    ]);
    setCustomHabitName('');
    showToast(`Hábito "${trimmed}" adicionado!`, 'success');
  };

  const removeCustomHabit = (tempId: string) => {
    setCustomHabits((prev) => prev.filter((h) => h.tempId !== tempId));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // --- Handlers for Accounts ---
  const addDraftAccount = (preset?: { name: string; color: string; type: AccountType }) => {
    setDraftAccounts((prev) => [
      ...prev,
      {
        tempId: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: preset?.name || '',
        type: preset?.type || 'checking',
        color: preset?.color || COLOR_SWATCHES[prev.length % COLOR_SWATCHES.length],
        balanceStr: '0,00',
      },
    ]);
  };

  const updateDraftAccount = (tempId: string, patch: Partial<DraftAccount>) => {
    setDraftAccounts((prev) =>
      prev.map((a) => (a.tempId === tempId ? { ...a, ...patch } : a))
    );
  };

  const removeDraftAccount = (tempId: string) => {
    if (draftAccounts.length <= 1) {
      showToast('É obrigatório manter pelo menos 1 conta bancária ou carteira.', 'info');
      return;
    }
    setDraftAccounts((prev) => prev.filter((a) => a.tempId !== tempId));
  };

  // --- Handlers for Categories ---
  const handleAddCustomCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (
      draftCategories.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.type === newCatType
      )
    ) {
      showToast('Essa categoria já existe na lista.', 'info');
      return;
    }
    setDraftCategories((prev) => [
      ...prev,
      {
        name: trimmed,
        type: newCatType,
        color: newCatColor,
        icon: newCatType === 'income' ? 'TrendingUp' : 'ShoppingBag',
        enabled: true,
        isNew: true,
      },
    ]);
    setNewCatName('');
  };

  const toggleDraftCategory = (index: number) => {
    setDraftCategories((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, enabled: !c.enabled } : c))
    );
  };

  // --- Cloud Authentication & Restore Flow ---
  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (!window.electronAPI) return;

      if (cloudTab === 'signin') {
        const res = await window.electronAPI.cloudSignIn(email, password);
        showToast(`Bem-vindo, ${res.user.email}! Restaurando seus dados da nuvem...`, 'info');
        await refreshCloudSession();

        let restoredCount: number | null = null;
        try {
          const pull = await window.electronAPI.cloudFullPull();
          restoredCount = pull.totalRestored;
        } catch (pullErr: any) {
          console.warn('Initial fullPull error:', pullErr);
          showToast(
            `Não foi possível baixar os dados da nuvem agora: ${pullErr?.message || pullErr}.`,
            'error'
          );
        }

        const restoredSettings = await window.electronAPI.getSettings();
        await window.electronAPI.updateSettings({
          ...(restoredSettings?.userName && restoredSettings.userName !== 'Usuário'
            ? {}
            : { userName: res.user.email.split('@')[0] || 'Usuário' }),
          onboardingCompleted: true,
        });

        try {
          localStorage.setItem(MANDATORY_ONBOARDING_KEY, '1');
          localStorage.setItem('pigo_platform_tour_v1_3_seen', '1');
        } catch {}

        if (restoredCount !== null) {
          showToast(
            `Dados restaurados com sucesso (${restoredCount} registros). Bem-vindo de volta!`,
            'success'
          );
        }
        await refreshAll();
        onComplete?.();
      } else {
        const res = await window.electronAPI.cloudSignUp(email, password);
        if (res.confirmed) {
          showToast('Conta criada na nuvem! Agora conclua as etapas obrigatórias.', 'success');
          await refreshCloudSession();
          setUserName(email.split('@')[0] || '');
          setMode('wizard');
        } else {
          showToast('Conta criada! Faça login para restaurar ou conectar.', 'success');
          setCloudTab('signin');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar na nuvem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Validation per Mandatory Step ---
  const validateStep = (step: number): boolean => {
    setErrorMsg('');
    if (step === 1) {
      if (!userName.trim()) {
        setErrorMsg('Etapa obrigatória: informe seu nome ou apelido para continuar.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      const validAccs = draftAccounts.filter((a) => a.name.trim().length > 0);
      if (validAccs.length === 0) {
        setErrorMsg('Etapa obrigatória: cadastre pelo menos 1 conta bancária ou carteira.');
        return false;
      }
      return true;
    }
    if (step === 3) {
      const enabledExpense = draftCategories.filter((c) => c.type === 'expense' && c.enabled);
      const enabledIncome = draftCategories.filter((c) => c.type === 'income' && c.enabled);
      if (enabledExpense.length === 0 || enabledIncome.length === 0) {
        setErrorMsg(
          'Etapa obrigatória: mantenha pelo menos 1 categoria de Despesa e 1 de Receita ativas.'
        );
        return false;
      }
      return true;
    }
    if (step === 4) {
      if (reserveSetupMode === 'dedicated' && !dedicatedReserveName.trim()) {
        setErrorMsg('Etapa obrigatória: informe o nome da sua conta/caixinha de Reserva.');
        return false;
      }
      return true;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep(wizardStep)) return;
    const next = Math.min(5, wizardStep + 1) as 1 | 2 | 3 | 4 | 5;
    setWizardStep(next);
    setMaxUnlockedStep((prev) => Math.max(prev, next));
  };

  const prevStep = () => {
    setErrorMsg('');
    if (wizardStep > 1) {
      setWizardStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  // --- Finish Mandatory Wizard & Unlock Platform ---
  const handleFinishWizard = async () => {
    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s)) {
        setWizardStep(s as 1 | 2 | 3 | 4 | 5);
        return;
      }
    }

    if (
      !installFinanceHabits &&
      !installMorningHabits &&
      customHabits.length === 0 &&
      !customHabitName.trim()
    ) {
      setErrorMsg(
        'Etapa 5 obrigatória: selecione pelo menos um pacote de hábitos ou adicione um hábito específico seu.'
      );
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (!window.electronAPI) return;

      // 1. Create or update accounts
      const existingIds = new Set((accounts || []).map((a) => a.id));
      const createdAccountIdsByTemp: Record<string, string> = {};

      for (const acc of draftAccounts) {
        if (!acc.name.trim()) continue;
        const cents = parseFormattedToCents(acc.balanceStr);
        if (existingIds.has(acc.tempId)) {
          await window.electronAPI.updateAccount(acc.tempId, {
            name: acc.name.trim(),
            type: acc.type,
            color: acc.color,
            initialBalance: cents,
          });
          createdAccountIdsByTemp[acc.tempId] = acc.tempId;
        } else {
          const created = await window.electronAPI.createAccount({
            name: acc.name.trim(),
            type: acc.type,
            initialBalance: cents,
            color: acc.color,
          });
          createdAccountIdsByTemp[acc.tempId] = created.id;
        }
      }

      // 2. Categories: create new ones, or delete disabled non-used ones
      for (const cat of draftCategories) {
        if (cat.isNew && cat.enabled) {
          await window.electronAPI.createCategory({
            name: cat.name,
            type: cat.type,
            color: cat.color,
            icon: cat.icon,
          });
        } else if (cat.id && !cat.enabled) {
          try {
            await window.electronAPI.deleteCategory(cat.id);
          } catch {}
        }
      }

      // 3. Emergency Reserve Account & Settings
      let reserveAccIds: string[] = [];
      let reserveInitialCents = 0;

      if (reserveSetupMode === 'dedicated' && dedicatedReserveName.trim()) {
        const resCents = parseFormattedToCents(dedicatedReserveBalance);
        const existingReserveAcc = (accounts || []).find(
          (a) => a.name.toLowerCase() === dedicatedReserveName.trim().toLowerCase()
        );
        if (existingReserveAcc) {
          await window.electronAPI.updateAccount(existingReserveAcc.id, {
            initialBalance: resCents,
            type: 'savings',
          });
          reserveAccIds = [existingReserveAcc.id];
        } else {
          const createdReserveAcc = await window.electronAPI.createAccount({
            name: dedicatedReserveName.trim(),
            type: 'savings',
            initialBalance: resCents,
            color: '#10b981',
          });
          reserveAccIds = [createdReserveAcc.id];
        }
        reserveInitialCents = resCents;
      } else if (reserveSetupMode === 'existing') {
        const mappedId =
          createdAccountIdsByTemp[selectedReserveAccTempId] ||
          Object.values(createdAccountIdsByTemp)[0];
        if (mappedId) {
          reserveAccIds = [mappedId];
        }
      }

      // 4. Starter Habit Packs + Custom Habit
      if (window.electronAPI.createHabit) {
        const existingHabits = await window.electronAPI.getHabits();
        const existingHabitNames = new Set(
          (existingHabits || []).map((h: any) => h.name.toLowerCase().trim())
        );

        const starterHabits: Array<{
          name: string;
          description: string;
          category: string;
          period_of_day: string;
          color: string;
        }> = [];

        if (installFinanceHabits) {
          starterHabits.push(
            {
              name: 'Dia Sem Gastos por Impulso',
              description: 'Passar o dia sem compras supérfluas ou não planejadas',
              category: 'financas',
              period_of_day: 'anytime',
              color: '#10b981',
            },
            {
              name: 'Revisar Lançamentos do Dia (2 min)',
              description: 'Conferir e categorizar os gastos do dia no Pigo',
              category: 'financas',
              period_of_day: 'evening',
              color: '#34d399',
            },
            {
              name: 'Cozinhar em Casa / Sem Delivery',
              description: 'Economizar preparando as próprias refeições',
              category: 'financas',
              period_of_day: 'evening',
              color: '#059669',
            }
          );
        }

        if (installMorningHabits) {
          starterHabits.push(
            {
              name: 'Beber 500ml de Água ao Acordar',
              description: 'Hidratar o corpo logo nos primeiros 15 minutos da manhã',
              category: 'saude',
              period_of_day: 'morning',
              color: '#38bdf8',
            },
            {
              name: 'Treino / Movimento Físico (30 min)',
              description: 'Academia, corrida, caminhada ou mobilidade diária',
              category: 'saude',
              period_of_day: 'morning',
              color: '#0ea5e9',
            }
          );
        }

        for (const ch of customHabits) {
          starterHabits.push({
            name: ch.name.trim(),
            description: 'Hábito personalizado criado no tutorial inicial',
            category: ch.category,
            period_of_day: ch.period_of_day,
            color: ch.color,
          });
        }

        if (customHabitName.trim()) {
          starterHabits.push({
            name: customHabitName.trim(),
            description: 'Hábito personalizado criado no tutorial inicial',
            category: customHabitCategory,
            period_of_day: customHabitPeriod,
            color: '#a855f7',
          });
        }

        for (const h of starterHabits) {
          if (!existingHabitNames.has(h.name.toLowerCase())) {
            await window.electronAPI.createHabit({
              ...h,
              periodOfDay: h.period_of_day,
              type: 'boolean',
              targetValue: 1,
              target_value: 1,
              frequencyType: 'daily',
              frequency_type: 'daily',
              frequencyDays: [0, 1, 2, 3, 4, 5, 6],
              frequency_days: [0, 1, 2, 3, 4, 5, 6],
              frequencyTimes: 7,
              frequency_times: 7,
            });
            existingHabitNames.add(h.name.toLowerCase());
          }
        }
        await loadHabits();
      }

      // 5. Save settings & mark mandatory onboarding completed
      await window.electronAPI.updateSettings({
        userName: userName.trim() || 'Usuário',
        currency: 'BRL',
        onboardingCompleted: true,
        reserveTargetMonths,
        reserveAccountIds: reserveAccIds,
        reserveInitialAmount: reserveInitialCents,
        reserveAutoDetect: true,
      });

      try {
        localStorage.setItem(MANDATORY_ONBOARDING_KEY, '1');
        localStorage.setItem('pigo_platform_tour_v1_3_seen', '1');
      } catch {}

      showToast('Tutorial e configuração concluídos! Plataforma liberada!', 'success');
      await refreshAll();
      onComplete?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao finalizar configuração.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabels = [
    { step: 1, label: '1. Tutorial', icon: GraduationCap },
    { step: 2, label: '2. Contas', icon: Landmark },
    { step: 3, label: '3. Categorias', icon: Tag },
    { step: 4, label: '4. Reserva', icon: ShieldCheck },
    { step: 5, label: '5. Hábitos', icon: CheckSquare },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0c0e] overflow-y-auto select-none">
      {/* Frameless Window Drag Bar */}
      <div className="h-9 w-full flex items-center justify-between px-4 shrink-0 app-drag border-b border-white/[0.04] bg-[#0c0c0e]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
          <img src={pigoIcon} alt="Pigo" className="w-4 h-4 rounded" />
          <span>Pigo • Configuração Inicial Obrigatória</span>
        </div>
        <div className="flex items-center gap-1 app-no-drag">
          <button
            type="button"
            onClick={() => window.electronAPI?.minimizeWindow()}
            title="Minimizar"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => window.electronAPI?.maximizeWindow()}
            title="Maximizar / Restaurar"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => window.electronAPI?.closeWindow()}
            title="Fechar aplicativo"
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden my-auto">
        {/* Ambient top glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5 relative z-10">
          <div className="flex items-center gap-3.5">
            <img
              src={pigoIcon}
              alt="Pigo Logo"
              className="w-11 h-11 rounded-2xl shadow-lg object-contain shrink-0 border border-white/15"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white tracking-tight">
                  Tutorial & Configuração Obrigatória
                </h1>
                <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Passo {wizardStep} de 5
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Complete as 5 etapas abaixo para destravar todos os ambientes do Pigo
              </p>
            </div>
          </div>

          {mode === 'wizard' && wizardStep === 1 && (
            <button
              type="button"
              onClick={() => {
                setMode('cloud');
                setErrorMsg('');
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-cyan-300 flex items-center gap-1.5 shrink-0 transition"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Restaurar da Nuvem</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-medium mb-4 flex items-center gap-2 relative z-10 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* =========================================================
            CLOUD RESTORE MODE
           ========================================================= */}
        {mode === 'cloud' && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                onClick={() => {
                  setMode('wizard');
                  setErrorMsg('');
                }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para o Tutorial Inicial</span>
              </button>

              <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setCloudTab('signin');
                    setErrorMsg('');
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    cloudTab === 'signin'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCloudTab('signup');
                    setErrorMsg('');
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    cloudTab === 'signup'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Criar Conta
                </button>
              </div>
            </div>

            <form onSubmit={handleCloudAuth} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Seu E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="voce@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Sua Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>
                      {cloudTab === 'signin'
                        ? 'Entrar e Restaurar Dados'
                        : 'Criar Conta na Nuvem'}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* =========================================================
            MANDATORY 5-STEP TUTORIAL & SETUP WIZARD
           ========================================================= */}
        {mode === 'wizard' && (
          <div className="space-y-5 relative z-10">
            {/* Step Progress Bar (Locked progression) */}
            <div className="grid grid-cols-5 gap-1.5 p-1.5 rounded-2xl liquid-glass-well">
              {stepLabels.map(({ step, label, icon: StepIcon }) => {
                const active = wizardStep === step;
                const done = wizardStep > step;
                const unlocked = step <= maxUnlockedStep;
                return (
                  <button
                    key={step}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      if (unlocked) setWizardStep(step as 1 | 2 | 3 | 4 | 5);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11px] font-bold transition-all ${
                      active
                        ? 'liquid-glass-tab-active text-white shadow'
                        : done
                        ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 cursor-pointer'
                        : 'text-slate-600 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <StepIcon className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="hidden sm:inline truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* =====================================================
                ETAPA 1: TUTORIAL DOS 3 AMBIENTES & SEU NOME
               ===================================================== */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.07] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                    <GraduationCap className="w-4 h-4" />
                    <span>Como funciona o Pigo (3 Ambientes Integrados)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/25 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <WalletCards className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-extrabold text-white">1. Finanças</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Controle suas contas, cartões, orçamentos, reserva de emergência e importe extratos OFX/CSV com categorização inteligente.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/25 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-extrabold text-white">2. Hábitos</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Construa disciplina diária por período (Manhã, Tarde, Noite), acompanhe a grade de 7 dias e mapas de calor anuais.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/25 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-extrabold text-white">3. Jornada</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Ganhe XP ao importar extratos, fechar meses no azul e cumprir hábitos (+5 XP/hábito e +25 XP no Dia Perfeito) rumo a 82 troféus!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <label className="block text-xs font-bold text-white mb-1.5">
                    Para começar, como você quer ser chamado no Pigo? <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Digite seu nome ou apelido..."
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* =====================================================
                ETAPA 2: CADASTRO OBRIGATÓRIO DE CONTAS
               ===================================================== */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-white block">Por que cadastrar suas contas agora?</strong>
                    Toda movimentação e importação de extrato OFX/CSV precisa estar ligada a um banco ou carteira. Adicione abaixo os bancos que você utiliza e informe o saldo atual aproximado:
                  </div>
                </div>

                {/* Quick Bank Presets */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1.5">
                    Toque para adicionar rapidamente seus bancos:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {BANK_PRESETS.map((preset) => {
                      const alreadyAdded = draftAccounts.some(
                        (a) => a.name.toLowerCase() === preset.name.toLowerCase()
                      );
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            if (!alreadyAdded) addDraftAccount(preset);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition flex items-center gap-1.5 ${
                            alreadyAdded
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-default'
                              : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: preset.color }}
                          />
                          <span>{preset.name}</span>
                          {alreadyAdded ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Plus className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Draft Accounts List */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {draftAccounts.map((acc) => (
                    <div
                      key={acc.tempId}
                      className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-5 sm:col-span-4 flex items-center gap-2">
                        <input
                          type="color"
                          value={acc.color}
                          onChange={(e) =>
                            updateDraftAccount(acc.tempId, { color: e.target.value })
                          }
                          className="w-6 h-6 rounded-lg bg-transparent border-0 cursor-pointer shrink-0"
                          title="Cor da conta"
                        />
                        <input
                          type="text"
                          placeholder="Nome do Banco"
                          value={acc.name}
                          onChange={(e) =>
                            updateDraftAccount(acc.tempId, { name: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="col-span-3 sm:col-span-4">
                        <select
                          value={acc.type}
                          onChange={(e) =>
                            updateDraftAccount(acc.tempId, {
                              type: e.target.value as AccountType,
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                        >
                          {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3 sm:col-span-3 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                          R$
                        </span>
                        <input
                          type="text"
                          value={acc.balanceStr}
                          onChange={(e) =>
                            updateDraftAccount(acc.tempId, {
                              balanceStr: formatCentsInput(e.target.value),
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                          title="Saldo inicial"
                        />
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeDraftAccount(acc.tempId)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                          title="Remover conta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addDraftAccount()}
                  className="w-full py-2 rounded-xl border border-dashed border-slate-700 hover:border-emerald-500/50 text-xs font-bold text-slate-300 hover:text-emerald-300 flex items-center justify-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Outra Conta Manualmente</span>
                </button>
              </div>
            )}

            {/* =====================================================
                ETAPA 3: REVISÃO & CRIAÇÃO DE CATEGORIAS
               ===================================================== */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-start gap-3">
                  <Tag className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-white block">Categorização Inteligente</strong>
                    Quando você categoriza um estabelecimento (ex: iFood ou Supermercado), o Pigo aprende a regra e categoriza sozinho nos próximos extratos! Revise suas categorias ou crie novas abaixo:
                  </div>
                </div>

                {/* Add New Category Bar */}
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    placeholder="Criar categoria (ex: Pet, Academia, Delivery, Dízimo...)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomCategory();
                      }
                    }}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <select
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as 'expense' | 'income')}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shrink-0 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>

                {/* Category Chips */}
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1.5">
                      Despesas (Clique para ativar/desativar)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {draftCategories.map((cat, idx) => {
                        if (cat.type !== 'expense') return null;
                        return (
                          <button
                            key={`${cat.name}_${idx}`}
                            type="button"
                            onClick={() => toggleDraftCategory(idx)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                              cat.enabled
                                ? 'bg-slate-950 text-white border-slate-700 shadow-sm'
                                : 'bg-slate-950/30 text-slate-600 border-slate-800/50 line-through'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span>{cat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1.5">
                      Receitas (Clique para ativar/desativar)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {draftCategories.map((cat, idx) => {
                        if (cat.type !== 'income') return null;
                        return (
                          <button
                            key={`${cat.name}_${idx}`}
                            type="button"
                            onClick={() => toggleDraftCategory(idx)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                              cat.enabled
                                ? 'bg-slate-950 text-white border-slate-700 shadow-sm'
                                : 'bg-slate-950/30 text-slate-600 border-slate-800/50 line-through'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span>{cat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================
                ETAPA 4: RESERVA DE EMERGÊNCIA OBRIGATÓRIA
               ===================================================== */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-white block">Sua Fortaleza Financeira</strong>
                    O Pigo monitora seus aportes e calcula quantos meses do seu custo de vida já estão protegidos. Defina abaixo sua meta e onde sua reserva fica guardada:
                  </div>
                </div>

                {/* Target Months */}
                <div>
                  <label className="block text-xs font-bold text-white mb-2">
                    1. Quantos meses de custo de vida é a sua meta de Reserva? <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 6, 9, 12].map((m) => {
                      const active = reserveTargetMonths === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setReserveTargetMonths(m)}
                          className={`p-3 rounded-2xl border text-center transition ${
                            active
                              ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-md'
                              : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="text-base font-black block">{m} meses</span>
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            {m === 3
                              ? 'Iniciante'
                              : m === 6
                              ? 'Recomendado'
                              : m === 9
                              ? 'Seguro'
                              : 'Blindado'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Where is the Reserve kept? */}
                <div className="space-y-2.5 pt-1">
                  <label className="block text-xs font-bold text-white">
                    2. Onde fica (ou ficará) guardada sua Reserva? <span className="text-rose-400">*</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setReserveSetupMode('dedicated')}
                      className={`p-3 rounded-2xl border text-left transition ${
                        reserveSetupMode === 'dedicated'
                          ? 'bg-emerald-500/15 border-emerald-400 text-white'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="text-xs font-bold block text-white">
                        Criar Caixinha / Conta de Reserva Separada
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        Ex: Caixinha Nubank, CDB Liquidez Diária ou Tesouro Selic.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReserveSetupMode('existing')}
                      className={`p-3 rounded-2xl border text-left transition ${
                        reserveSetupMode === 'existing'
                          ? 'bg-emerald-500/15 border-emerald-400 text-white'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="text-xs font-bold block text-white">
                        Vincular uma conta já criada na Etapa 2
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        Usar uma das contas que você cadastrou no passo anterior.
                      </span>
                    </button>
                  </div>

                  {reserveSetupMode === 'dedicated' ? (
                    <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Nome da Caixinha / Reserva
                        </label>
                        <input
                          type="text"
                          value={dedicatedReserveName}
                          onChange={(e) => setDedicatedReserveName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Quanto você já tem guardado nela hoje? (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                            R$
                          </span>
                          <input
                            type="text"
                            value={dedicatedReserveBalance}
                            onChange={(e) =>
                              setDedicatedReserveBalance(formatCentsInput(e.target.value))
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Selecione qual conta da Etapa 2 é a sua Reserva:
                      </label>
                      <select
                        value={selectedReserveAccTempId}
                        onChange={(e) => setSelectedReserveAccTempId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {draftAccounts.map((a) => (
                          <option key={a.tempId} value={a.tempId}>
                            {a.name || 'Conta sem nome'} (R$ {a.balanceStr})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =====================================================
                ETAPA 5: HÁBITOS INICIAIS & LIBERAÇÃO DO APP
               ===================================================== */}
            {wizardStep === 5 && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-start gap-3">
                  <Zap className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-white block">Última Etapa: Seus Hábitos Diários</strong>
                    Cada hábito concluído rende <strong className="text-amber-300">+5 XP</strong> e fechar 100% do dia rende <strong className="text-amber-300">+25 XP de Dia Perfeito</strong>. Escolha abaixo os pacotes iniciais:
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInstallFinanceHabits((v) => !v)}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      installFinanceHabits
                        ? 'bg-emerald-500/15 border-emerald-400 text-white'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-white">
                        💰 Kit Blindagem Financeira (3 hábitos)
                      </span>
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          installFinanceHabits ? 'text-emerald-400' : 'text-slate-600'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Dia Sem Gastos por Impulso, Revisar Lançamentos do Dia e Cozinhar em Casa.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInstallMorningHabits((v) => !v)}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      installMorningHabits
                        ? 'bg-cyan-500/15 border-cyan-400 text-white'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-white">
                        🌅 Kit Manhã de Alta Performance (2 hábitos)
                      </span>
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          installMorningHabits ? 'text-cyan-400' : 'text-slate-600'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Beber 500ml de Água ao Acordar e Treino / Movimento Físico (30 min).
                    </p>
                  </button>
                </div>

                {/* Custom Specific Habit Builder */}
                <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-slate-800 space-y-2.5">
                  <label className="block text-xs font-bold text-white">
                    Cadastrar Hábito Específico Personalizado:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Ler 10 páginas, Academia, Estudar Inglês..."
                      value={customHabitName}
                      onChange={(e) => setCustomHabitName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomHabit();
                        }
                      }}
                      className="sm:col-span-5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                    <select
                      value={customHabitCategory}
                      onChange={(e) => setCustomHabitCategory(e.target.value)}
                      className="sm:col-span-3 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="saude">🍏 Saúde & Corpo</option>
                      <option value="financas">💰 Finanças</option>
                      <option value="mente">🧠 Mente & Foco</option>
                      <option value="produtividade">💼 Produtividade</option>
                      <option value="rotina">⚡ Rotina</option>
                      <option value="geral">✨ Geral</option>
                    </select>
                    <select
                      value={customHabitPeriod}
                      onChange={(e) => setCustomHabitPeriod(e.target.value)}
                      className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="anytime">⏰ Livre</option>
                      <option value="morning">🌅 Manhã</option>
                      <option value="afternoon">☀️ Tarde</option>
                      <option value="evening">🌙 Noite</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCustomHabit}
                      className="sm:col-span-2 px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1 transition shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  {/* List of added specific habits */}
                  {customHabits.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block">
                        Seus hábitos específicos adicionados ({customHabits.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {customHabits.map((h) => (
                          <div
                            key={h.tempId}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-xs text-white"
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: h.color }}
                            />
                            <span className="font-semibold">{h.name}</span>
                            <span className="text-[10px] text-cyan-300/80">
                              ({h.period_of_day === 'morning'
                                ? 'Manhã'
                                : h.period_of_day === 'afternoon'
                                ? 'Tarde'
                                : h.period_of_day === 'evening'
                                ? 'Noite'
                                : 'Livre'})
                            </span>
                            <button
                              type="button"
                              onClick={() => removeCustomHabit(h.tempId)}
                              className="text-slate-400 hover:text-rose-400 transition ml-0.5"
                              title="Remover hábito"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Final Summary Card */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Resumo pronto para liberar seu Pigo:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Contas</span>
                      <strong className="text-white">
                        {draftAccounts.filter((a) => a.name.trim()).length +
                          (reserveSetupMode === 'dedicated' ? 1 : 0)}{' '}
                        contas
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Categorias</span>
                      <strong className="text-white">
                        {draftCategories.filter((c) => c.enabled).length} ativas
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Reserva</span>
                      <strong className="text-emerald-400">{reserveTargetMonths} meses</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Hábitos</span>
                      <strong className="text-cyan-300">
                        {(installFinanceHabits ? 3 : 0) +
                          (installMorningHabits ? 2 : 0) +
                          customHabits.length +
                          (customHabitName.trim() ? 1 : 0)}{' '}
                        ativos
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Wizard Footer Navigation */}
            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-3">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Etapa Anterior</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-500">
                  🔒 Conclua as 5 etapas para liberar o app
                </span>
              )}

              {wizardStep < 5 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="liquid-glass-cta px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
                >
                  <span>Confirmar e Avançar ({wizardStep}/5)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleFinishWizard}
                  className="liquid-glass-cta px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Liberando Plataforma...'
                      : 'Concluir Tutorial e Liberar o Pigo!'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
