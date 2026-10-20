import React from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  Landmark,
  CreditCard,
  Target,
  Calendar,
  PiggyBank,
  Trophy,
  ShieldCheck,
  PieChart,
  Settings as SettingsIcon,
  PlusCircle,
  Lock,
  WalletCards,
  WifiOff,
  Tag,
  FileSpreadsheet,
  Sparkles,
  CheckSquare,
  Plus,
  Grid,
  ListTodo,
  SlidersHorizontal,
  Swords,
  History,
  Crown,
  FolderKanban,
  StickyNote,
  Network,
  KeyRound,
} from 'lucide-react';
import { useFinancial, AppView, AppModule } from '../context/FinancialContext';
import { useHabits } from '../context/HabitsContext';
import pigoIcon from '../assets/pigo-icon.png';

interface NavItem {
  id: AppView;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const MODULE_META: Record<
  AppModule,
  {
    index: number;
    badge: string;
    subtitle: string;
    lensGlow: string;
    lensTint: string;
    navTint: string;
    ctaGlow: string;
    badgeClass: string;
    activeIconClass: string;
    activeTextClass: string;
    badgePillClass: string;
    indicatorBarClass: string;
  }
> = {
  finance: {
    index: 0,
    badge: 'Finanças',
    subtitle: 'Gestão Patrimonial',
    lensGlow: 'rgba(16, 185, 129, 0.45)',
    lensTint: 'linear-gradient(145deg, rgba(16, 185, 129, 0.38) 0%, rgba(5, 150, 105, 0.16) 55%, rgba(255, 255, 255, 0.14) 100%)',
    navTint: 'rgba(16, 185, 129, 0.18)',
    ctaGlow: 'rgba(16, 185, 129, 0.4)',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
    activeIconClass: 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]',
    activeTextClass: 'text-white font-semibold',
    badgePillClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    indicatorBarClass: 'bg-emerald-400 shadow-[0_0_10px_#34d399]',
  },
  habits: {
    index: 1,
    badge: 'Hábitos',
    subtitle: 'Rotina & Disciplina',
    lensGlow: 'rgba(6, 182, 212, 0.5)',
    lensTint: 'linear-gradient(145deg, rgba(6, 182, 212, 0.42) 0%, rgba(14, 165, 233, 0.18) 55%, rgba(255, 255, 255, 0.15) 100%)',
    navTint: 'rgba(6, 182, 212, 0.18)',
    ctaGlow: 'rgba(6, 182, 212, 0.42)',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
    activeIconClass: 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]',
    activeTextClass: 'text-white font-semibold',
    badgePillClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
    indicatorBarClass: 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]',
  },
  tools: {
    index: 2,
    badge: 'Ferramentas',
    subtitle: 'Segundo Cérebro & Cofre',
    lensGlow: 'rgba(217, 70, 239, 0.5)',
    lensTint: 'linear-gradient(145deg, rgba(217, 70, 239, 0.42) 0%, rgba(168, 85, 247, 0.18) 55%, rgba(255, 255, 255, 0.15) 100%)',
    navTint: 'rgba(217, 70, 239, 0.18)',
    ctaGlow: 'rgba(217, 70, 239, 0.4)',
    badgeClass: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
    activeIconClass: 'text-fuchsia-300 drop-shadow-[0_0_8px_rgba(232,121,249,0.55)]',
    activeTextClass: 'text-white font-semibold',
    badgePillClass: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30',
    indicatorBarClass: 'bg-fuchsia-400 shadow-[0_0_10px_#e879f9]',
  },
  journey: {
    index: 3,
    badge: 'Jornada',
    subtitle: 'Nível & Troféus',
    lensGlow: 'rgba(245, 158, 11, 0.5)',
    lensTint: 'linear-gradient(145deg, rgba(245, 158, 11, 0.42) 0%, rgba(234, 88, 12, 0.18) 55%, rgba(255, 255, 255, 0.15) 100%)',
    navTint: 'rgba(245, 158, 11, 0.18)',
    ctaGlow: 'rgba(245, 158, 11, 0.4)',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
    activeIconClass: 'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)]',
    activeTextClass: 'text-white font-semibold',
    badgePillClass: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    indicatorBarClass: 'bg-amber-400 shadow-[0_0_10px_#fbbf24]',
  },
};

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    activeModule,
    setActiveModule,
    openNewTransaction,
    settings,
    lockApp,
    pendingImportSession,
    game,
  } = useFinancial();

  const { openNewHabitModal, overview, habits } = useHabits();

  const unlockedAchievements = game ? game.achievements.filter((a) => a.unlocked).length : 0;
  const totalAchievements = game ? game.achievements.length : 0;
  const activeMissionsCompleted = game ? game.missions.current.filter((m) => m.status === 'completed').length : 0;
  const activeMissionsTotal = game ? game.missions.current.length : 0;

  const financeSections: NavSection[] = [
    {
      title: 'Visão Geral',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'intelligence', label: 'Inteligência', icon: Sparkles },
        { id: 'reports', label: 'Relatórios', icon: PieChart },
      ],
    },
    {
      title: 'Movimentações',
      items: [
        { id: 'transactions', label: 'Lançamentos', icon: ReceiptText },
        { id: 'calendar', label: 'Calendário', icon: Calendar },
        {
          id: 'import',
          label: 'Importar Extrato',
          icon: FileSpreadsheet,
          badge: pendingImportSession ? 'Pendente' : undefined,
        },
      ],
    },
    {
      title: 'Carteira',
      items: [
        { id: 'accounts', label: 'Contas Bancárias', icon: Landmark },
        { id: 'cards', label: 'Cartões de Crédito', icon: CreditCard },
      ],
    },
    {
      title: 'Planejamento',
      items: [
        { id: 'budgets', label: 'Orçamentos', icon: Target },
        { id: 'reserve', label: 'Reserva de Emergência', icon: ShieldCheck },
        { id: 'goals', label: 'Metas Financeiras', icon: PiggyBank },
        { id: 'categories', label: 'Categorias', icon: Tag },
      ],
    },
  ];

  const habitsSections: NavSection[] = [
    {
      title: 'Execução Diária',
      items: [
        {
          id: 'habits',
          label: 'Hoje (Check-in)',
          icon: ListTodo,
          badge: overview ? `${overview.completedToday}/${overview.total}` : undefined,
        },
        {
          id: 'habits_week',
          label: 'Grade Semanal (7d)',
          icon: Calendar,
        },
      ],
    },
    {
      title: 'Evolução & Gestão',
      items: [
        {
          id: 'habits_analytics',
          label: 'Consistência & Mapas',
          icon: Grid,
          badge: overview?.bestStreak ? `${overview.bestStreak}d 🔥` : undefined,
        },
        {
          id: 'habits_manage',
          label: 'Meus Hábitos',
          icon: SlidersHorizontal,
          badge: habits.length > 0 ? `${habits.length}` : undefined,
        },
      ],
    },
  ];

  const journeySections: NavSection[] = [
    {
      title: 'Seu Progresso',
      items: [
        {
          id: 'journey',
          label: 'Visão Geral & Nível',
          icon: Crown,
          badge: game ? `Nv. ${game.level}` : undefined,
        },
        {
          id: 'journey_missions',
          label: 'Missões da Semana',
          icon: Swords,
          badge: activeMissionsTotal > 0 ? `${activeMissionsCompleted}/${activeMissionsTotal}` : undefined,
        },
      ],
    },
    {
      title: 'Sala de Troféus',
      items: [
        {
          id: 'journey_achievements',
          label: 'Conquistas',
          icon: Trophy,
          badge: totalAchievements > 0 ? `${unlockedAchievements}/${totalAchievements}` : undefined,
        },
        {
          id: 'journey_history',
          label: 'Histórico de XP',
          icon: History,
        },
      ],
    },
  ];

  const toolsSections: NavSection[] = [
    {
      title: 'Segundo Cérebro',
      items: [
        {
          id: 'tools_notes',
          label: 'Anotações & Ideias',
          icon: StickyNote,
        },
        {
          id: 'tools_mindmap',
          label: 'Mapas Mentais',
          icon: Network,
        },
      ],
    },
    {
      title: 'Segurança & Acessos',
      items: [
        {
          id: 'tools_vault',
          label: 'Cofre de Senhas',
          icon: KeyRound,
        },
      ],
    },
  ];

  const currentSections =
    activeModule === 'habits'
      ? habitsSections
      : activeModule === 'journey'
      ? journeySections
      : activeModule === 'tools'
      ? toolsSections
      : financeSections;

  const meta = MODULE_META[activeModule];

  const modules: { id: AppModule; label: string; Icon: React.FC<{ className?: string }>; glowColor: string }[] = [
    { id: 'finance', label: 'Finanças', Icon: WalletCards, glowColor: 'text-emerald-300' },
    { id: 'habits', label: 'Hábitos', Icon: CheckSquare, glowColor: 'text-cyan-300' },
    { id: 'tools', label: 'Ferramentas', Icon: FolderKanban, glowColor: 'text-fuchsia-300' },
    { id: 'journey', label: 'Jornada', Icon: Trophy, glowColor: 'text-amber-300' },
  ];

  return (
    <aside className="w-72 bg-slate-950/85 border-r border-white/[0.07] flex flex-col justify-between select-none shrink-0 h-full backdrop-blur-2xl relative overflow-hidden">
      {/* Subtle ambient light refraction in the sidebar corner */}
      <div
        className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full blur-3xl opacity-30 transition-all duration-700"
        style={{ background: meta.lensGlow }}
      />

      <div className="flex flex-col min-h-0 flex-1 relative z-10">
        {/* Brand Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between app-drag">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={pigoIcon}
                alt="Pigo Logo"
                className="w-9 h-9 rounded-xl shadow-lg object-contain shrink-0 ring-1 ring-white/20"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950 transition-colors duration-500"
                style={{ backgroundColor: activeModule === 'habits' ? '#22d3ee' : activeModule === 'journey' ? '#fbbf24' : activeModule === 'tools' ? '#e879f9' : '#34d399' }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black text-white tracking-tight leading-none">
                  PIGO
                </h1>
                <span
                  className={`text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-md border backdrop-blur-md transition-all duration-500 ${meta.badgeClass}`}
                >
                  {meta.badge}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                {meta.subtitle}
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================
            LIQUID GLASS MODULE SWITCHER (SLIDING CAPSULE LENS)
           ========================================================= */}
        <div className="px-3 pt-3.5 pb-1.5">
          <div className="liquid-glass-well p-1.5 rounded-2xl relative overflow-hidden">
            {/* Ambient background glow shifting behind the active lens */}
            <div
              className="pointer-events-none absolute top-1 bottom-1 w-[calc((100%-12px)/4)] rounded-xl blur-md opacity-60 transition-transform duration-500 ease-out"
              style={{
                transform: `translateX(${meta.index * 100}%)`,
                background: meta.lensGlow,
              }}
            />

            {/* Sliding Liquid Glass Lens */}
            <div
              className="liquid-glass-lens absolute top-1.5 bottom-1.5 left-1.5 w-[calc((100%-12px)/4)] rounded-xl pointer-events-none z-10"
              style={{
                transform: `translateX(${meta.index * 100}%)`,
                background: meta.lensTint,
                ['--lens-glow' as any]: meta.lensGlow,
              }}
            />

            {/* 4 Interactive Module Buttons side by side */}
            <div className="grid grid-cols-4 relative z-20">
              {modules.map(({ id, label, Icon, glowColor }) => {
                const isSelected = activeModule === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveModule(id)}
                    title={label}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-0.5 rounded-xl text-[9px] transition-all duration-300 ${
                      isSelected
                        ? 'text-white font-extrabold scale-[1.02]'
                        : 'text-slate-400 hover:text-slate-200 font-semibold opacity-75 hover:opacity-100'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition-transform duration-300 ${
                        isSelected ? `${glowColor} scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]` : 'text-slate-400'
                      }`}
                    />
                    <span className="tracking-tight leading-none truncate max-w-full">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Contextual Liquid Glass CTA / Hero Status */}
        <div className="px-3 py-2">
          {activeModule === 'habits' ? (
            <button
              onClick={() => openNewHabitModal()}
              style={{ ['--cta-glow' as any]: meta.ctaGlow }}
              className="liquid-glass-cta w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500/85 via-sky-500/80 to-cyan-400/85 hover:from-cyan-400 hover:to-sky-300 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 stroke-[3] drop-shadow" />
              <span className="drop-shadow-sm">Novo Hábito</span>
            </button>
          ) : activeModule === 'journey' ? (
            <div className="liquid-glass-well p-3 rounded-2xl relative overflow-hidden">
              <div
                className="pointer-events-none absolute -right-6 -top-6 w-20 h-20 rounded-full blur-xl opacity-35"
                style={{ background: meta.lensGlow }}
              />
              <div className="flex items-center justify-between text-[11px] relative z-10">
                <span className="font-bold text-amber-200 truncate">{game?.title || 'Iniciante'}</span>
                <span className="font-black text-white bg-amber-500/25 px-2 py-0.5 rounded-lg text-[10px] border border-amber-300/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                  Nv. {game?.level || 1}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-950/80 rounded-full overflow-hidden mt-2 border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 rounded-full transition-all duration-500 shadow-[0_0_10px_#f59e0b]"
                  style={{ width: `${game?.progressPercent || 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 mt-1.5 font-medium">
                <span>{game ? `${game.xpIntoLevel}/${game.xpForNext} XP` : '0 XP'}</span>
                <span className="text-amber-300/90">{unlockedAchievements}/{totalAchievements} troféus</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => openNewTransaction()}
              style={{ ['--cta-glow' as any]: meta.ctaGlow }}
              className="liquid-glass-cta w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600/90 via-brand-500/85 to-teal-500/90 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5] drop-shadow" />
              <span className="drop-shadow-sm">Novo lançamento</span>
            </button>
          )}
        </div>

        {/* Grouped Navigation Sections */}
        <nav className="px-3 py-1.5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          {currentSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500/90">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id)}
                      style={isActive ? ({ ['--nav-tint' as any]: meta.navTint } as React.CSSProperties) : undefined}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-200 relative overflow-hidden ${
                        isActive
                          ? `liquid-glass-nav-item ${meta.activeTextClass}`
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent font-medium'
                      }`}
                    >
                      {isActive && (
                        <span
                          className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${meta.indicatorBarClass}`}
                        />
                      )}
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isActive ? `${meta.activeIconClass} scale-105` : 'text-slate-400'
                        }`}
                      />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md border backdrop-blur-md ${meta.badgePillClass}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer / System status & Settings */}
      <div className="p-3 border-t border-white/[0.06] space-y-1 relative z-10">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('pigo:open-tour'))}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-all"
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="flex-1 text-left">Como Usar (Tour)</span>
        </button>

        <button
          onClick={() => setCurrentView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            currentView === 'settings'
              ? 'liquid-glass-nav-item text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <SettingsIcon className="w-4 h-4 text-slate-400" />
          <span className="flex-1 text-left">Configurações</span>
        </button>

        {settings?.pinEnabled && (
          <button
            onClick={() => lockApp()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="flex-1 text-left">Bloquear App</span>
          </button>
        )}

        {/* Offline Badge */}
        <div className="px-3 pt-1 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3 h-3 text-emerald-500" />
            <span>100% Local-First</span>
          </div>
          <span className="font-mono text-[9px]">v1.3.0</span>
        </div>
      </div>
    </aside>
  );
};
