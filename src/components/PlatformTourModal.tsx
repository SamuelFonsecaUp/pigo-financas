import React, { useState, useEffect } from 'react';
import {
  WalletCards,
  CheckSquare,
  Trophy,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Zap,
  FileSpreadsheet,
  Flame,
  X,
} from 'lucide-react';
import { useFinancial, AppModule, AppView } from '../context/FinancialContext';
import pigoIcon from '../assets/pigo-icon.png';

const TOUR_STORAGE_KEY = 'pigo_platform_tour_v1_3_seen';

interface TourSlide {
  badge: string;
  title: string;
  subtitle: string;
  accentColor: string;
  glowClass: string;
  Icon: React.FC<{ className?: string }>;
  highlights: {
    icon: React.FC<{ className?: string }>;
    title: string;
    desc: string;
  }[];
  actionLabel?: string;
  targetModule?: AppModule;
  targetView?: AppView;
}

const SLIDES: TourSlide[] = [
  {
    badge: 'Bem-vindo ao Novo Pigo 1.3',
    title: '3 Ambientes Integrados em um Só Lugar',
    subtitle:
      'Use o seletor Liquid Glass no topo da barra lateral para alternar instantaneamente entre sua vida financeira, sua rotina diária e seu progresso.',
    accentColor: '#10b981',
    glowClass: 'from-emerald-500/20 via-cyan-500/10 to-amber-500/10',
    Icon: Sparkles,
    highlights: [
      {
        icon: WalletCards,
        title: '1. Pigo Finanças (Esmeralda)',
        desc: 'Dashboard, lançamentos, cartões, reserva de emergência, metas e inteligência financeira.',
      },
      {
        icon: CheckSquare,
        title: '2. Pigo Hábitos (Ciano)',
        desc: 'Check-ins diários por período (Manhã, Tarde, Noite), grade de 7 dias e mapas de calor anuais.',
      },
      {
        icon: Trophy,
        title: '3. Pigo Jornada (Âmbar)',
        desc: 'Seu nível, missões semanais automáticas e sala com 82 troféus desbloqueáveis.',
      },
    ],
  },
  {
    badge: 'Ambiente 1 • Pigo Finanças',
    title: 'Controle Financeiro Sem Esforço Manual',
    subtitle:
      'Organizado em 4 grupos claros (Visão Geral, Movimentações, Carteira e Planejamento) para você encontrar tudo em segundos.',
    accentColor: '#22c55e',
    glowClass: 'from-emerald-500/25 via-emerald-500/5 to-transparent',
    Icon: WalletCards,
    highlights: [
      {
        icon: FileSpreadsheet,
        title: 'Importação Inteligente (OFX / CSV)',
        desc: 'Arraste o extrato do seu banco: o Pigo agrupa estabelecimentos e aprende suas categorias.',
      },
      {
        icon: Sparkles,
        title: 'Inteligência & Reserva',
        desc: 'Detecta assinaturas recorrentes sozinho e calcula quantos meses de custo de vida sua reserva cobre.',
      },
      {
        icon: CheckCircle2,
        title: '100% Local-First + Nuvem Opcional',
        desc: 'Seus dados ficam salvos no seu computador com velocidade instantânea e sincronização segura.',
      },
    ],
    actionLabel: 'Explorar Finanças',
    targetModule: 'finance',
    targetView: 'dashboard',
  },
  {
    badge: 'Ambiente 2 • Pigo Hábitos',
    title: 'Construa Disciplina Diária em 1 Clique',
    subtitle:
      'Inspirado nos melhores rastreadores do mundo, dividido em 4 sub-páginas dedicadas para não poluir sua visão.',
    accentColor: '#06b6d4',
    glowClass: 'from-cyan-500/25 via-sky-500/5 to-transparent',
    Icon: CheckSquare,
    highlights: [
      {
        icon: Sparkles,
        title: 'Pacotes Prontos de 1 Clique',
        desc: 'Instale o "Kit Blindagem Financeira", "Manhã de Alta Performance" ou "Mente Blindada" instantaneamente.',
      },
      {
        icon: Flame,
        title: 'Check-in Diário & Grade de 7 Dias',
        desc: 'Marque seus hábitos de hoje ou preencha dias anteriores rapidamente na matriz semanal.',
      },
      {
        icon: Zap,
        title: 'Conectado ao seu XP',
        desc: 'Cada hábito concluído soma +5 XP na hora, e fechar 100% do dia libera +25 XP de Bônus Dia Perfeito!',
      },
    ],
    actionLabel: 'Ir para Meus Hábitos',
    targetModule: 'habits',
    targetView: 'habits',
  },
  {
    badge: 'Ambiente 3 • Pigo Jornada',
    title: 'Suba de Nível na Vida Real',
    subtitle:
      'Seu esforço financeiro e sua disciplina diária se transformam em XP, níveis, títulos e 82 conquistas.',
    accentColor: '#f59e0b',
    glowClass: 'from-amber-500/25 via-orange-500/5 to-transparent',
    Icon: Trophy,
    highlights: [
      {
        icon: Zap,
        title: 'Missões Semanais Personalizadas',
        desc: 'Toda segunda-feira o Pigo gera 3 desafios baseados nos seus próprios padrões financeiros.',
      },
      {
        icon: Trophy,
        title: '82 Conquistas em 10 Categorias',
        desc: 'De "Primeiro Extrato" e "Caixa Zero" até "Regra dos 21 Dias" e "Ano de Ouro".',
      },
      {
        icon: CheckCircle2,
        title: 'XP Retroativo e Justo',
        desc: 'Conquistas calibradas (15 a 150 XP) que valorizam a sua constância ao longo dos meses.',
      },
    ],
    actionLabel: 'Ver Minha Jornada',
    targetModule: 'journey',
    targetView: 'journey',
  },
];

interface PlatformTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlatformTourModal: React.FC<PlatformTourModalProps> = ({ isOpen, onClose }) => {
  const { setActiveModule, setCurrentView } = useFinancial();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const handleFinish = (goToModule?: AppModule, goToView?: AppView) => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, '1');
    } catch {}
    if (goToModule) setActiveModule(goToModule);
    if (goToView) setCurrentView(goToView);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden relative animate-scale-in">
        {/* Top ambient glow */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b ${slide.glowClass} transition-all duration-500`}
        />

        {/* Close button */}
        <button
          type="button"
          onClick={() => handleFinish()}
          className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 transition"
          title="Fechar guia"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-7 relative z-10 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4 pr-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-lg"
              style={{
                backgroundColor: `${slide.accentColor}18`,
                borderColor: `${slide.accentColor}40`,
                color: slide.accentColor,
              }}
            >
              {step === 0 ? (
                <img src={pigoIcon} alt="Pigo" className="w-10 h-10 object-contain rounded-xl" />
              ) : (
                <slide.Icon className="w-7 h-7" />
              )}
            </div>
            <div>
              <span
                className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border inline-block mb-1.5"
                style={{
                  backgroundColor: `${slide.accentColor}15`,
                  borderColor: `${slide.accentColor}35`,
                  color: slide.accentColor,
                }}
              >
                {slide.badge}
              </span>
              <h2 className="text-xl font-black text-white tracking-tight leading-snug">
                {slide.title}
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{slide.subtitle}</p>
            </div>
          </div>

          {/* 3 Feature Highlight Cards */}
          <div className="space-y-2.5">
            {slide.highlights.map((item, idx) => {
              const ItemIcon = item.icon;
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-950/75 border border-white/[0.07] flex items-start gap-3.5"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border"
                    style={{
                      backgroundColor: `${slide.accentColor}14`,
                      borderColor: `${slide.accentColor}30`,
                      color: slide.accentColor,
                    }}
                  >
                    <ItemIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white">{item.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Navigation & Step Dots */}
          <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between gap-3">
            {/* Step indicators + Quick Setup Wizard trigger */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {SLIDES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setStep(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === step ? 'w-7 bg-white' : 'w-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  handleFinish();
                  window.dispatchEvent(new CustomEvent('pigo:open-setup-wizard'));
                }}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
              >
                Assistente de Contas & Reserva
              </button>
            </div>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
              )}

              {slide.targetModule && !isLast && (
                <button
                  type="button"
                  onClick={() => handleFinish(slide.targetModule, slide.targetView)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  {slide.actionLabel}
                </button>
              )}

              {isLast ? (
                <button
                  type="button"
                  onClick={() => handleFinish()}
                  className="liquid-glass-cta px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Começar a Usar!</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="liquid-glass-cta px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <span>Próximo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function hasSeenPlatformTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
