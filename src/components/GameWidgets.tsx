import React from 'react';
import {
  CalendarCheck,
  Castle,
  CreditCard,
  FileUp,
  Flame,
  FolderArchive,
  GraduationCap,
  Inbox,
  Library,
  Crown,
  PartyPopper,
  PiggyBank,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Tags,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { GameRarity } from '../types';

const ICONS: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  CalendarCheck, Castle, CreditCard, FileUp, Flame, FolderArchive, GraduationCap, Inbox, Library,
  Crown, PiggyBank, Search, Shield, ShieldCheck, Sparkles, Swords, Tags, Target, TrendingUp, Trophy,
};

export const RARITY_STYLE: Record<GameRarity, { label: string; color: string }> = {
  comum: { label: 'Comum', color: '#94a3b8' },
  raro: { label: 'Rara', color: '#3b82f6' },
  epico: { label: 'Épica', color: '#a855f7' },
  lendario: { label: 'Lendária', color: '#f59e0b' },
};

export const AchievementIcon: React.FC<{ name: string; className?: string; color?: string }> = ({ name, className, color }) => {
  const Icon = ICONS[name] || Trophy;
  return <Icon className={className} style={color ? { color } : undefined} />;
};

// Nível + barra de XP no cabeçalho; abre a Jornada
export const XpPill: React.FC = () => {
  const { game, setCurrentView } = useFinancial();
  if (!game) return null;

  return (
    <button
      onClick={() => setCurrentView('journey')}
      title={`${game.title} • ${game.xpIntoLevel}/${game.xpForNext} XP para o nível ${game.level + 1}`}
      className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-all"
    >
      <span className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-400 to-orange-600 text-[11px] font-black text-white flex items-center justify-center shadow">
        {game.level}
      </span>
      <span className="hidden md:flex flex-col items-start gap-0.5">
        <span className="text-[10px] font-semibold text-slate-300 leading-none">{game.title}</span>
        <span className="w-24 h-1 rounded-full bg-slate-800 overflow-hidden">
          <span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${game.progressPercent}%` }} />
        </span>
      </span>
    </button>
  );
};

// Comemoração de subida de nível / conquista (uma de cada vez)
export const GameCelebration: React.FC = () => {
  const { celebrations, welcomeSummary, dismissCelebration, setCurrentView, isLocked } = useFinancial();
  const current = celebrations[0];
  // Nunca por cima do bloqueio por PIN: aparece depois do desbloqueio
  if (isLocked || (!welcomeSummary && !current)) return null;

  let icon: React.ReactNode;
  let kicker: string;
  let title: string;
  let subtitle: string;
  let accent = '#f59e0b';

  if (welcomeSummary) {
    icon = <PartyPopper className="w-10 h-10 text-amber-300" />;
    kicker = 'Bem-vindo à Jornada!';
    title = `Nível ${welcomeSummary.level} • ${welcomeSummary.title}`;
    subtitle = `Seu histórico já valeu ${welcomeSummary.totalXp.toLocaleString('pt-BR')} XP e ${welcomeSummary.achievements} conquistas. Daqui em diante cada extrato, aporte e mês no azul te faz evoluir.`;
  } else if (current.type === 'level') {
    icon = <Sparkles className="w-10 h-10 text-amber-300" />;
    kicker = 'Subiu de nível!';
    title = `Nível ${current.level}`;
    subtitle = current.title;
  } else {
    accent = RARITY_STYLE[current.rarity].color;
    icon = <AchievementIcon name={current.icon} className="w-10 h-10" color={accent} />;
    kicker = `Conquista ${RARITY_STYLE[current.rarity].label}`;
    title = current.name;
    subtitle = `+${current.xp} XP`;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={dismissCelebration}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[360px] max-w-[90vw] p-6 rounded-3xl bg-slate-900 border text-center shadow-2xl animate-scale-in"
        style={{ borderColor: `${accent}66`, boxShadow: `0 0 60px ${accent}33` }}
      >
        <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${accent}1f`, border: `1px solid ${accent}55` }}>
          {icon}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>{kicker}</span>
        <h3 className="text-xl font-black text-white mt-1">{title}</h3>
        <p className="text-xs text-slate-400 mt-2">{subtitle}</p>
        <div className="flex justify-center gap-2 mt-5">
          <button
            onClick={() => { dismissCelebration(); setCurrentView('journey'); }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-750"
          >
            Ver Jornada
          </button>
          <button
            onClick={dismissCelebration}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            {celebrations.length > 1 && !welcomeSummary ? `Próxima (${celebrations.length - 1})` : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
};
