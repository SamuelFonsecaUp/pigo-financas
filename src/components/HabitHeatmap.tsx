import React, { useEffect, useState, useMemo } from 'react';
import { Habit, HabitLogEntry } from '../types';
import { useHabits } from '../context/HabitsContext';
import { Flame, Trophy, Award, TrendingUp } from 'lucide-react';

interface HabitHeatmapProps {
  habit: Habit;
  year?: number;
}

export const HabitHeatmap: React.FC<HabitHeatmapProps> = ({ habit, year = new Date().getFullYear() }) => {
  const { getHeatmap } = useHabits();
  const [logs, setLogs] = useState<Record<string, HabitLogEntry>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getHeatmap(habit.id, year).then((data) => {
      if (alive) {
        setLogs(data);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [habit.id, year, getHeatmap]);

  // Gera todas as semanas e dias do ano
  const { weeks, monthLabels, totalCompletions } = useMemo(() => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const dayList: { dateStr: string; date: Date; completed: boolean }[] = [];

    let count = 0;
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const completed = Boolean(logs[dateStr]?.completed);
      if (completed) count++;
      dayList.push({ dateStr, date: new Date(cur), completed });
      cur.setDate(cur.getDate() + 1);
    }

    // Organiza por semanas (colunas)
    const weeksArr: { dateStr: string; completed: boolean; inYear: boolean }[][] = [];
    let currentWeek: { dateStr: string; completed: boolean; inYear: boolean }[] = [];

    // Preenche dias antes do início do ano na primeira semana para alinhar na Segunda-feira (1)
    const firstDayOfWeek = (startDate.getDay() + 6) % 7; // 0 = Seg, 6 = Dom
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ dateStr: '', completed: false, inYear: false });
    }

    dayList.forEach((day) => {
      currentWeek.push({ dateStr: day.dateStr, completed: day.completed, inYear: true });
      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ dateStr: '', completed: false, inYear: false });
      }
      weeksArr.push(currentWeek);
    }

    // Rótulos de meses
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthLabelsArr: { name: string; weekIndex: number }[] = [];
    let lastMonth = -1;

    weeksArr.forEach((w, idx) => {
      const firstValidDay = w.find((d) => d.inYear && d.dateStr);
      if (firstValidDay) {
        const m = parseInt(firstValidDay.dateStr.slice(5, 7), 10) - 1;
        if (m !== lastMonth) {
          monthLabelsArr.push({ name: months[m], weekIndex: idx });
          lastMonth = m;
        }
      }
    });

    return { weeks: weeksArr, monthLabels: monthLabelsArr, totalCompletions: count };
  }, [year, logs]);

  const habitColor = habit.color || '#38bdf8';

  return (
    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-3">
      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: habitColor }}
          />
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">{habit.name}</h3>
            {habit.description && (
              <p className="text-xs text-slate-400 line-clamp-1">{habit.description}</p>
            )}
          </div>
        </div>

        {/* Badges de estatística */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: `${habitColor}18`, color: habitColor }}
            title="Sequência de dias atual"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{habit.currentStreak} dias</span>
          </div>

          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20"
            title="Melhor sequência histórica"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Recorde: {habit.longestStreak}</span>
          </div>

          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
            title="Força do Hábito (algoritmo Loop Habit Tracker)"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>{habit.strength}% força</span>
          </div>
        </div>
      </div>

      {/* Grade Heatmap Anual */}
      <div className="overflow-x-auto pb-1 pt-1">
        <div className="inline-block min-w-full">
          {/* Meses */}
          <div className="flex text-[10px] text-slate-400 mb-1 pl-6">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                style={{
                  position: 'relative',
                  left: `${m.weekIndex * 13}px`,
                  marginRight: i === monthLabels.length - 1 ? 0 : '16px',
                }}
              >
                {m.name}
              </span>
            ))}
          </div>

          <div className="flex items-start gap-1">
            {/* Dias da semana (Seg, Qua, Sex) */}
            <div className="flex flex-col gap-1 text-[9px] text-slate-400 pr-1 select-none font-medium">
              <span className="h-[10px] leading-[10px]">S</span>
              <span className="h-[10px] leading-[10px] opacity-0">T</span>
              <span className="h-[10px] leading-[10px]">Q</span>
              <span className="h-[10px] leading-[10px] opacity-0">Q</span>
              <span className="h-[10px] leading-[10px]">S</span>
              <span className="h-[10px] leading-[10px] opacity-0">S</span>
              <span className="h-[10px] leading-[10px]">D</span>
            </div>

            {/* Colunas de Semanas */}
            <div className="flex gap-[3px]">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px]">
                  {week.map((day, dIdx) => {
                    if (!day.inYear) {
                      return <div key={dIdx} className="w-[10px] h-[10px] rounded-[2px] opacity-0" />;
                    }

                    return (
                      <div
                        key={dIdx}
                        title={day.dateStr ? `${day.dateStr}: ${day.completed ? 'Concluído' : 'Não realizado'}` : undefined}
                        className="w-[10px] h-[10px] rounded-[2px] transition-colors"
                        style={{
                          backgroundColor: day.completed ? habitColor : 'rgba(30, 41, 59, 0.45)',
                          boxShadow: day.completed ? `0 0 6px ${habitColor}40` : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé do Card com Legenda e Total */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/50">
        <span>Total de dias no ano: <strong className="text-white">{totalCompletions} dias</strong></span>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span>Menos</span>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-slate-800/80" />
          <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: `${habitColor}60` }} />
          <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: habitColor }} />
          <span>Mais</span>
        </div>
      </div>
    </div>
  );
};
