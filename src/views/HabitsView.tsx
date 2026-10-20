import React, { useMemo } from 'react';
import { useHabits } from '../context/HabitsContext';
import { useFinancial } from '../context/FinancialContext';
import { HabitHeatmap } from '../components/HabitHeatmap';
import { HabitModal } from '../components/HabitModal';
import { Habit, HabitPeriod, HabitCategory } from '../types';
import {
  Flame,
  Check,
  Plus,
  Sparkles,
  Calendar,
  Grid,
  Filter,
  Edit2,
  Trash2,
  TrendingUp,
  ListTodo,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react';

const PERIOD_LABELS: Record<HabitPeriod, { label: string; icon: string; desc: string }> = {
  morning: { label: 'Manhã', icon: '🌅', desc: 'Comece o dia com energia' },
  afternoon: { label: 'Tarde', icon: '☀️', desc: 'Mantenha o ritmo produtivo' },
  evening: { label: 'Noite', icon: '🌙', desc: 'Desacelere e prepare o amanhã' },
  anytime: { label: 'Qualquer hora', icon: '⏰', desc: 'Flexível ao longo do dia' },
};

const CATEGORY_NAMES: Record<HabitCategory, { label: string; icon: string }> = {
  saude: { label: 'Saúde & Corpo', icon: '🍏' },
  mente: { label: 'Mente & Foco', icon: '🧠' },
  produtividade: { label: 'Produtividade', icon: '💼' },
  financas: { label: 'Finanças Pessoais', icon: '💰' },
  rotina: { label: 'Rotina & Hábitos', icon: '⚡' },
  relacionamentos: { label: 'Relações & Lazer', icon: '🤝' },
  geral: { label: 'Geral', icon: '✨' },
};

const HABIT_TEMPLATE_PACKS: {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  accentColor: string;
  items: Partial<Habit>[];
}[] = [
  {
    id: 'pack_financas',
    title: 'Kit Blindagem Financeira',
    subtitle: 'Hábitos diários que protegem seu bolso e aceleram sua liberdade financeira',
    badge: '💰 Finanças & Bolso',
    accentColor: '#10b981',
    items: [
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
      },
      {
        name: 'Estudar 15 min de Finanças & Negócios',
        description: 'Leitura ou estudo focado em educação financeira',
        category: 'financas',
        period_of_day: 'evening',
        color: '#6ee7b7',
      },
    ],
  },
  {
    id: 'pack_manha',
    title: 'Kit Manhã de Alta Performance',
    subtitle: 'Comece o dia com energia física, hidratação e clareza de prioridades',
    badge: '🌅 Energia Matinal',
    accentColor: '#38bdf8',
    items: [
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
      },
      {
        name: 'Definir as 3 Prioridades do Dia',
        description: 'Planejar as 3 entregas essenciais antes de abrir redes sociais',
        category: 'produtividade',
        period_of_day: 'morning',
        color: '#6366f1',
      },
    ],
  },
  {
    id: 'pack_mente',
    title: 'Kit Mente Blindada & Foco',
    subtitle: 'Construa concentração profunda, leitura constante e sono reparador',
    badge: '🧠 Foco & Evolução',
    accentColor: '#a855f7',
    items: [
      {
        name: 'Bloco de Foco Profundo (Sem Celular)',
        description: '90 minutos de trabalho ou estudo focado sem distrações',
        category: 'produtividade',
        period_of_day: 'afternoon',
        color: '#a855f7',
      },
      {
        name: 'Leitura Diária (10 páginas)',
        description: 'Construir o hábito da leitura constante todos os dias',
        category: 'mente',
        period_of_day: 'evening',
        color: '#c084fc',
      },
      {
        name: 'Desligar Telas 30 min Antes de Dormir',
        description: 'Garantir um sono reparador e mente descansada',
        category: 'saude',
        period_of_day: 'evening',
        color: '#818cf8',
      },
    ],
  },
];

export const HabitsView: React.FC = () => {
  const { currentView, setCurrentView } = useFinancial();
  const {
    habits,
    overview,
    loading,
    selectedPeriod,
    setSelectedPeriod,
    toggleDay,
    deleteHabit,
    installTemplateHabits,
    openNewHabitModal,
    openEditHabitModal,
  } = useHabits();

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Datas dos últimos 7 dias para a matriz rápida
  const last7Days = useMemo(() => {
    const dates: { dateStr: string; label: string; dayNumber: number; isToday: boolean }[] = [];
    const now = new Date();
    const weekDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      dates.push({
        dateStr,
        label: i === 0 ? 'Hoje' : weekDayNames[d.getDay()],
        dayNumber: d.getDate(),
        isToday: i === 0,
      });
    }
    return dates;
  }, []);

  // Filtra hábitos pelo período selecionado
  const filteredHabits = useMemo(() => {
    if (selectedPeriod === 'all') return habits;
    return habits.filter((h) => h.period_of_day === selectedPeriod);
  }, [habits, selectedPeriod]);

  // Agrupa hábitos por período do dia para a visão "Hoje"
  const groupedByPeriod = useMemo(() => {
    const order: HabitPeriod[] = ['morning', 'afternoon', 'evening', 'anytime'];
    return order
      .map((period) => ({
        period,
        meta: PERIOD_LABELS[period],
        items: filteredHabits.filter((h) => (h.period_of_day || 'anytime') === period),
      }))
      .filter((g) => g.items.length > 0);
  }, [filteredHabits]);

  // Agrupa hábitos por categoria para a visão "Meus Hábitos"
  const groupedByCategory = useMemo(() => {
    const groups: Partial<Record<HabitCategory, Habit[]>> = {};
    habits.forEach((h) => {
      const cat = h.category || 'geral';
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(h);
    });
    return groups;
  }, [habits]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 h-full">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Progresso do Dia */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/50 via-slate-900/90 to-slate-950 border border-cyan-500/25 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Progresso de Hoje</span>
            <span className="text-[11px] font-bold text-cyan-200 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/30">
              {overview?.completedToday ?? 0}/{overview?.total ?? 0}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tracking-tight">{overview?.percentToday ?? 0}%</span>
              <span className="text-xs text-slate-400 font-medium">concluído</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${overview?.percentToday ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Melhor Sequência Ativa */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-amber-400" /> Maior Sequência
            </span>
            <span className="text-[10px] text-slate-500">Em chamas</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tracking-tight">{overview?.bestStreak ?? 0}</span>
              <span className="text-xs text-slate-400 font-medium">dias seguidos</span>
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-1">
              {overview?.bestHabitName ? `Destaque: ${overview.bestHabitName}` : 'Comece seu check-in hoje!'}
            </p>
          </div>
        </div>

        {/* Força Média dos Hábitos */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Força da Rotina
            </span>
            <span className="text-[10px] text-slate-500">Consistência</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tracking-tight">{overview?.averageStrength ?? 0}%</span>
              <span className="text-xs text-slate-400 font-medium">força média</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Calculada pelos últimos 30 dias</p>
          </div>
        </div>

        {/* Sub-navegação rápida / Novo Hábito */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Construir Rotina</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <button
            onClick={() => openNewHabitModal()}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Novo Hábito
          </button>
        </div>
      </div>

      {/* Sub-navigation bar + Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
        <div className="liquid-glass-well flex items-center gap-1 p-1.5 rounded-2xl">
          {([
            ['habits', 'Hoje (Check-in)', ListTodo],
            ['habits_week', 'Grade 7 Dias', Calendar],
            ['habits_analytics', 'Mapas de Calor', Grid],
            ['habits_manage', 'Meus Hábitos', SlidersHorizontal],
          ] as const).map(([viewId, label, Icon]) => {
            const active = currentView === viewId;
            return (
              <button
                key={viewId}
                onClick={() => setCurrentView(viewId)}
                style={active ? ({ ['--tab-glow' as any]: 'rgba(6, 182, 212, 0.45)' } as React.CSSProperties) : undefined}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs transition-all duration-300 ${
                  active
                    ? 'liquid-glass-tab-active text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]' : ''}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {currentView !== 'habits_manage' && (
          <div className="flex items-center gap-1 text-xs flex-wrap">
            <span className="text-slate-500 text-[11px] font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Período:
            </span>
            {(['all', 'morning', 'afternoon', 'evening'] as const).map((p) => {
              const active = selectedPeriod === p;
              const label = p === 'all' ? 'Todos' : PERIOD_LABELS[p].label;
              const icon = p === 'all' ? '✨' : PERIOD_LABELS[p].icon;
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="mr-1">{icon}</span>
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty State with 1-Click Template Packs */}
      {habits.length === 0 ? (
        <div className="space-y-6">
          <div className="p-8 text-center rounded-3xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Comece sua rotina em 1 clique</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Cada check-in concluído rende <strong className="text-amber-300">+5 XP</strong> na sua Jornada e fechar 100% do dia libera o bônus <strong className="text-amber-300">Dia Perfeito (+25 XP)</strong>! Escolha um pacote pronto abaixo ou crie um hábito personalizado:
            </p>
            <button
              onClick={() => openNewHabitModal()}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition shadow-md shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              Criar Hábito Personalizado
            </button>
          </div>

          <TemplatePacksSection
            existingHabits={habits}
            onInstall={installTemplateHabits}
          />
        </div>
      ) : currentView === 'habits' ? (
        /* =========================================================
           SUB-PÁGINA 1: HOJE (FOCO DIÁRIO POR PERÍODO)
           ========================================================= */
        <div className="space-y-6">
          {groupedByPeriod.map(({ period, meta, items }) => {
            const doneInPeriod = items.filter((i) => i.completedToday).length;
            return (
              <div key={period} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{meta.icon}</span>
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                        {meta.label}
                      </h3>
                      <span className="text-[11px] text-slate-500">{meta.desc}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800">
                    {doneInPeriod}/{items.length} concluídos
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((habit) => {
                    const habitColor = habit.color || '#38bdf8';
                    const catInfo = CATEGORY_NAMES[habit.category] || CATEGORY_NAMES.geral;
                    const done = habit.completedToday;

                    return (
                      <div
                        key={habit.id}
                        onClick={() => toggleDay(habit.id, todayStr)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 group select-none ${
                          done
                            ? 'bg-slate-900/90 border-slate-700/80 shadow-md'
                            : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                        }`}
                        style={{
                          borderColor: done ? `${habitColor}55` : undefined,
                        }}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDay(habit.id, todayStr);
                            }}
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                              done
                                ? 'scale-100 shadow-lg'
                                : 'bg-slate-950 border-2 border-slate-700 group-hover:border-cyan-400/60'
                            }`}
                            style={{
                              backgroundColor: done ? habitColor : undefined,
                              boxShadow: done ? `0 0 16px ${habitColor}55` : undefined,
                            }}
                          >
                            <Check
                              className={`w-5 h-5 stroke-[3.5] transition-transform ${
                                done ? 'text-slate-950 scale-100' : 'text-transparent group-hover:text-slate-600'
                              }`}
                            />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-bold truncate transition ${
                                  done ? 'text-white' : 'text-slate-200'
                                }`}
                              >
                                {habit.name}
                              </span>
                              {habit.currentStreak > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                  style={{ backgroundColor: `${habitColor}20`, color: habitColor }}
                                >
                                  <Flame className="w-2.5 h-2.5" />
                                  {habit.currentStreak}d
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                              <span>
                                {catInfo.icon} {catInfo.label}
                              </span>
                              {habit.type === 'measurable' && (
                                <>
                                  <span>•</span>
                                  <span className="text-cyan-400 font-semibold">
                                    Meta: {habit.target_value} {habit.target_unit}
                                  </span>
                                </>
                              )}
                              <span>•</span>
                              <span>Força: {habit.strength}%</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditHabitModal(habit);
                          }}
                          title="Editar hábito"
                          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800/80 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : currentView === 'habits_week' ? (
        /* =========================================================
           SUB-PÁGINA 2: GRADE SEMANAL (ÚLTIMOS 7 DIAS)
           ========================================================= */
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-xl backdrop-blur-md">
          <div className="grid grid-cols-12 px-5 py-3.5 border-b border-slate-800/80 bg-slate-950/50 text-xs font-semibold text-slate-400 select-none items-center">
            <div className="col-span-5 sm:col-span-6">Hábito & Categoria</div>
            <div className="col-span-7 sm:col-span-6 flex justify-end gap-2.5 sm:gap-4 pr-1">
              {last7Days.map((d) => (
                <div
                  key={d.dateStr}
                  className={`flex flex-col items-center justify-center w-8 sm:w-10 py-1 rounded-xl transition ${
                    d.isToday ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold' : ''
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold">{d.label}</span>
                  <span className="text-xs font-black">{d.dayNumber}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-800/40">
            {filteredHabits.map((habit) => {
              const habitColor = habit.color || '#38bdf8';
              const catInfo = CATEGORY_NAMES[habit.category] || CATEGORY_NAMES.geral;
              const periodInfo = PERIOD_LABELS[habit.period_of_day] || PERIOD_LABELS.anytime;

              return (
                <div
                  key={habit.id}
                  className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-slate-850/40 transition group"
                >
                  <div className="col-span-5 sm:col-span-6 flex items-center gap-3 min-w-0 pr-2">
                    <button
                      onClick={() => openEditHabitModal(habit)}
                      className="w-3.5 h-3.5 rounded-full shrink-0 group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: habitColor }}
                      title="Editar Hábito"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-bold text-white truncate cursor-pointer hover:text-cyan-300 transition"
                          onClick={() => openEditHabitModal(habit)}
                        >
                          {habit.name}
                        </span>
                        {habit.currentStreak > 0 && (
                          <span
                            className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: `${habitColor}18`, color: habitColor }}
                          >
                            <Flame className="w-2.5 h-2.5" />
                            {habit.currentStreak}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>
                          {catInfo.icon} {catInfo.label}
                        </span>
                        <span>•</span>
                        <span>
                          {periodInfo.icon} {periodInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-7 sm:col-span-6 flex justify-end gap-2.5 sm:gap-4 pr-1 items-center">
                    {last7Days.map((d) => {
                      const isCompleted = d.isToday
                        ? habit.completedToday
                        : habit.recentHistory?.find((h) => h.date === d.dateStr)?.completed;

                      return (
                        <button
                          key={d.dateStr}
                          onClick={() => toggleDay(habit.id, d.dateStr)}
                          title={`${d.dateStr}: ${isCompleted ? 'Concluído' : 'Clique para marcar'}`}
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-all ${
                            isCompleted
                              ? 'scale-100 shadow-md'
                              : 'bg-slate-950/60 border border-slate-800 text-transparent hover:border-slate-700 hover:text-slate-600'
                          }`}
                          style={{
                            backgroundColor: isCompleted ? habitColor : undefined,
                            boxShadow: isCompleted ? `0 0 12px ${habitColor}50` : undefined,
                          }}
                        >
                          <Check className={`w-4 h-4 stroke-[3.5] ${isCompleted ? 'text-slate-950' : ''}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : currentView === 'habits_analytics' ? (
        /* =========================================================
           SUB-PÁGINA 3: CONSISTÊNCIA & MAPAS DE CALOR ANUAIS
           ========================================================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Grid className="w-4 h-4 text-cyan-400" />
                Mapas de Consistência Anuais ({new Date().getFullYear()})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Acompanhe cada check-in registrado ao longo dos 365 dias do ano
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {filteredHabits.map((habit) => (
              <HabitHeatmap key={habit.id} habit={habit} />
            ))}
          </div>
        </div>
      ) : (
        /* =========================================================
           SUB-PÁGINA 4: MEUS HÁBITOS (CATÁLOGO & GESTÃO)
           ========================================================= */
        <div className="space-y-6">
          {(Object.entries(groupedByCategory) as [HabitCategory, Habit[]][]).map(([catKey, catHabits]) => {
            const catMeta = CATEGORY_NAMES[catKey] || CATEGORY_NAMES.geral;
            return (
              <div key={catKey} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span>{catMeta.icon}</span>
                    <span>{catMeta.label}</span>
                    <span className="text-[10px] font-bold text-slate-500">({catHabits.length})</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {catHabits.map((habit) => {
                    const habitColor = habit.color || '#38bdf8';
                    const periodInfo = PERIOD_LABELS[habit.period_of_day] || PERIOD_LABELS.anytime;
                    return (
                      <div
                        key={habit.id}
                        className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-4 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-3.5 h-10 rounded-full shrink-0"
                            style={{ backgroundColor: habitColor }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white truncate">{habit.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                                {periodInfo.icon} {periodInfo.label}
                              </span>
                            </div>
                            {habit.description && (
                              <p className="text-xs text-slate-400 truncate mt-0.5">{habit.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5">
                              <span>
                                Sequência atual: <strong className="text-white">{habit.currentStreak}d</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Recorde: <strong className="text-amber-300">{habit.longestStreak}d</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Total: <strong className="text-cyan-300">{habit.totalCompleted} check-ins</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditHabitModal(habit)}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Editar Hábito"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Deseja realmente excluir o hábito "${habit.name}"?`)) {
                                deleteHabit(habit.id);
                              }
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Excluir Hábito"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="pt-4 border-t border-white/[0.06]">
            <TemplatePacksSection
              existingHabits={habits}
              onInstall={installTemplateHabits}
            />
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição */}
      <HabitModal />
    </div>
  );
};

const TemplatePacksSection: React.FC<{
  existingHabits: Habit[];
  onInstall: (templates: Partial<Habit>[], packName?: string) => Promise<number>;
}> = ({ existingHabits, onInstall }) => {
  const existingNames = useMemo(
    () => new Set(existingHabits.map((h) => h.name.toLowerCase().trim())),
    [existingHabits]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Galeria de Pacotes & Templates Prontos
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Adicione trilhas completas de hábitos financeiros, saúde e foco com 1 clique
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {HABIT_TEMPLATE_PACKS.map((pack) => {
          const allInstalled = pack.items.every(
            (i) => i.name && existingNames.has(i.name.toLowerCase().trim())
          );

          return (
            <div
              key={pack.id}
              className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800/90 flex flex-col justify-between gap-4 relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: `${pack.accentColor}15`,
                      color: pack.accentColor,
                      borderColor: `${pack.accentColor}35`,
                    }}
                  >
                    {pack.badge}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {pack.items.length} hábitos
                  </span>
                </div>

                <h4 className="text-sm font-black text-white">{pack.title}</h4>
                <p className="text-xs text-slate-400 mt-1">{pack.subtitle}</p>

                <div className="mt-4 space-y-2">
                  {pack.items.map((item) => {
                    const installed =
                      item.name ? existingNames.has(item.name.toLowerCase().trim()) : false;
                    return (
                      <div
                        key={item.name}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-200 block truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {item.description}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={installed}
                          onClick={() => onInstall([item])}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 transition ${
                            installed
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-default'
                              : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                        >
                          {installed ? '✓ Na lista' : '+ Adicionar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                disabled={allInstalled}
                onClick={() => onInstall(pack.items, pack.title)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  allInstalled
                    ? 'bg-slate-800/60 text-slate-500 cursor-default border border-slate-800'
                    : 'liquid-glass-cta text-white hover:brightness-110 active:scale-[0.98]'
                }`}
                style={
                  !allInstalled
                    ? {
                        background: `linear-gradient(135deg, ${pack.accentColor}cc, ${pack.accentColor}99)`,
                        ['--cta-glow' as any]: `${pack.accentColor}55`,
                      }
                    : undefined
                }
              >
                {allInstalled ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Pacote já instalado</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Instalar Pacote Completo ({pack.items.length})</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
