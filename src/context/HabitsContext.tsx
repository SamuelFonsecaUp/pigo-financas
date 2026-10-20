import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Habit, HabitLogEntry, HabitPeriod, HabitsOverview } from '../types';
import { useFinancial } from './FinancialContext';

interface HabitsContextType {
  habits: Habit[];
  overview: HabitsOverview | null;
  loading: boolean;
  activeTab: 'today' | 'heatmaps' | 'categories';
  setActiveTab: (tab: 'today' | 'heatmaps' | 'categories') => void;
  selectedPeriod: HabitPeriod | 'all';
  setSelectedPeriod: (period: HabitPeriod | 'all') => void;
  loadHabits: () => Promise<void>;
  createHabit: (data: any) => Promise<Habit>;
  installTemplateHabits: (templates: Partial<Habit>[], packName?: string) => Promise<number>;
  updateHabit: (id: string, data: any) => Promise<Habit>;
  deleteHabit: (id: string) => Promise<boolean>;
  toggleDay: (habitId: string, date: string, value?: number) => Promise<void>;
  getHeatmap: (habitId: string, year?: number) => Promise<Record<string, HabitLogEntry>>;
  isModalOpen: boolean;
  editingHabit: Habit | null;
  openNewHabitModal: (preset?: Partial<Habit>) => void;
  openEditHabitModal: (habit: Habit) => void;
  closeModal: () => void;
}

const HabitsContext = createContext<HabitsContextType | undefined>(undefined);

export const HabitsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { refreshGame, showToast } = useFinancial();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [overview, setOverview] = useState<HabitsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'heatmaps' | 'categories'>('today');
  const [selectedPeriod, setSelectedPeriod] = useState<HabitPeriod | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const loadHabits = useCallback(async () => {
    try {
      if (window.electronAPI?.getHabits) {
        const [loadedHabits, loadedOverview] = await Promise.all([
          window.electronAPI.getHabits(),
          window.electronAPI.getHabitsOverview(),
        ]);
        setHabits(loadedHabits);
        setOverview(loadedOverview);
      }
    } catch (err) {
      console.error('[HabitsContext] Erro ao carregar hábitos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  const createHabit = async (data: any) => {
    if (window.electronAPI?.createHabit) {
      const created = await window.electronAPI.createHabit(data);
      await loadHabits();
      await refreshGame();
      return created;
    }
    throw new Error('Electron API não disponível');
  };

  const installTemplateHabits = async (templates: Partial<Habit>[], packName?: string) => {
    if (!window.electronAPI?.createHabit) return 0;
    const existingNames = new Set(habits.map((h) => h.name.toLowerCase().trim()));
    let addedCount = 0;

    for (const tpl of templates) {
      if (!tpl.name || existingNames.has(tpl.name.toLowerCase().trim())) continue;
      await window.electronAPI.createHabit({
        name: tpl.name,
        description: tpl.description || '',
        category: tpl.category || 'geral',
        color: tpl.color || '#38bdf8',
        icon: tpl.icon || 'CheckCircle',
        type: tpl.type || 'boolean',
        target_value: tpl.target_value || 1,
        target_unit: tpl.target_unit || '',
        frequency_type: 'daily',
        frequency_days: [0, 1, 2, 3, 4, 5, 6],
        frequency_times: 7,
        period_of_day: tpl.period_of_day || 'anytime',
      });
      existingNames.add(tpl.name.toLowerCase().trim());
      addedCount++;
    }

    await loadHabits();
    await refreshGame();

    if (addedCount > 0) {
      showToast(
        packName
          ? `Pacote "${packName}" instalado (${addedCount} ${addedCount === 1 ? 'hábito adicionado' : 'hábitos adicionados'})!`
          : `Hábito adicionado com sucesso!`,
        'success'
      );
    } else {
      showToast('Todos os hábitos deste pacote já estão na sua lista!', 'info');
    }
    return addedCount;
  };

  const updateHabit = async (id: string, data: any) => {
    if (window.electronAPI?.updateHabit) {
      const updated = await window.electronAPI.updateHabit(id, data);
      await loadHabits();
      await refreshGame();
      return updated;
    }
    throw new Error('Electron API não disponível');
  };

  const deleteHabit = async (id: string) => {
    if (window.electronAPI?.deleteHabit) {
      const success = await window.electronAPI.deleteHabit(id);
      if (success) {
        setHabits((prev) => prev.filter((h) => h.id !== id));
        await loadHabits();
        await refreshGame();
      }
      return success;
    }
    return false;
  };

  const toggleDay = async (habitId: string, date: string, value?: number) => {
    const nowStr = new Date().toISOString().slice(0, 10);
    const isToday = date === nowStr;
    let markedCompleted = false;

    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const wasCompleted = isToday ? h.completedToday : h.recentHistory?.find((d) => d.date === date)?.completed;
        const newCompleted = !wasCompleted;
        markedCompleted = newCompleted;

        const updatedHistory = h.recentHistory?.map((d) =>
          d.date === date ? { ...d, completed: newCompleted, value: newCompleted ? (value ?? 1) : null } : d
        );

        return {
          ...h,
          completedToday: isToday ? newCompleted : h.completedToday,
          todayValue: isToday ? (newCompleted ? (value ?? 1) : null) : h.todayValue,
          currentStreak: newCompleted ? h.currentStreak + 1 : Math.max(0, h.currentStreak - 1),
          strength: newCompleted ? Math.min(100, h.strength + 4) : Math.max(0, h.strength - 4),
          recentHistory: updatedHistory,
        };
      })
    );

    try {
      if (window.electronAPI?.toggleHabitDay) {
        await window.electronAPI.toggleHabitDay(habitId, date, value);
        const loadedOverview = await window.electronAPI.getHabitsOverview();
        setOverview(loadedOverview);
        await refreshGame();

        if (markedCompleted) {
          if (isToday && loadedOverview && loadedOverview.total > 0 && loadedOverview.completedToday === loadedOverview.total) {
            showToast('🔥 Dia Perfeito! 100% dos hábitos concluídos (+30 XP na Jornada!)', 'success');
          } else {
            showToast('Hábito concluído! +5 XP na sua Jornada ⚡', 'success');
          }
        }
      }
    } catch (err) {
      console.error('[HabitsContext] Erro ao alternar dia do hábito:', err);
      await loadHabits();
    }
  };

  const getHeatmap = async (habitId: string, year?: number) => {
    if (window.electronAPI?.getHabitHeatmap) {
      return await window.electronAPI.getHabitHeatmap(habitId, year);
    }
    return {};
  };

  const openNewHabitModal = (preset?: Partial<Habit>) => {
    setEditingHabit(preset ? (preset as Habit) : null);
    setIsModalOpen(true);
  };

  const openEditHabitModal = (habit: Habit) => {
    setEditingHabit(habit);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHabit(null);
  };

  return (
    <HabitsContext.Provider
      value={{
        habits,
        overview,
        loading,
        activeTab,
        setActiveTab,
        selectedPeriod,
        setSelectedPeriod,
        loadHabits,
        createHabit,
        installTemplateHabits,
        updateHabit,
        deleteHabit,
        toggleDay,
        getHeatmap,
        isModalOpen,
        editingHabit,
        openNewHabitModal,
        openEditHabitModal,
        closeModal,
      }}
    >
      {children}
    </HabitsContext.Provider>
  );
};

export const useHabits = () => {
  const context = useContext(HabitsContext);
  if (!context) {
    throw new Error('useHabits deve ser usado dentro de HabitsProvider');
  }
  return context;
};
