import React, { useState, useEffect } from 'react';
import { useFinancial } from './context/FinancialContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/Toast';
import { PinLockModal } from './components/PinLockModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { TransactionModal } from './views/TransactionModal';
import { ImportBankModal } from './views/ImportBankModal';
import { CloudAuthModal } from './views/CloudAuthModal';
import { UpdateBanner } from './components/AppUpdate';
import { PlatformTourModal, hasSeenPlatformTour } from './components/PlatformTourModal';

import { DashboardView } from './views/DashboardView';
import { TransactionsView } from './views/TransactionsView';
import { AccountsView } from './views/AccountsView';
import { CardsView } from './views/CardsView';
import { BudgetsView } from './views/BudgetsView';
import { CalendarView } from './views/CalendarView';
import { CategoriesView } from './views/CategoriesView';
import { GoalsView } from './views/GoalsView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { OnboardingView, hasCompletedMandatoryOnboarding } from './views/OnboardingView';
import { ImportView } from './views/ImportView';
import { ReserveView } from './views/ReserveView';
import { JourneyView } from './views/JourneyView';
import { HabitsView } from './views/HabitsView';
import { ToolsView } from './views/ToolsView';
import { GameCelebration } from './components/GameWidgets';
import { IntelligenceView } from './views/IntelligenceView';

export const App: React.FC = () => {
  const {
    currentView,
    activeModule,
    settings,
    isLocked,
    isLoading,
    importModalOpen,
    setImportModalOpen,
    cloudAuthModalOpen,
    setCloudAuthModalOpen,
  } = useFinancial();

  const [tourOpen, setTourOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [mandatoryDone, setMandatoryDone] = useState(() =>
    hasCompletedMandatoryOnboarding(settings?.onboardingCompleted)
  );

  useEffect(() => {
    setMandatoryDone(hasCompletedMandatoryOnboarding(settings?.onboardingCompleted));
  }, [settings?.onboardingCompleted]);

  useEffect(() => {
    const handleTour = () => setTourOpen(true);
    const handleWizard = () => setSetupWizardOpen(true);
    window.addEventListener('pigo:open-tour', handleTour);
    window.addEventListener('pigo:open-setup-wizard', handleWizard);
    return () => {
      window.removeEventListener('pigo:open-tour', handleTour);
      window.removeEventListener('pigo:open-setup-wizard', handleWizard);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0c0c0e] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Carregando Pigo...</span>
        </div>
      </div>
    );
  }

  // Mandatory 5-step Tutorial & Setup gate (locks entire app until finished)
  if ((settings && !mandatoryDone) || setupWizardOpen) {
    return (
      <>
        <ToastContainer />
        <OnboardingView
          onComplete={() => {
            setMandatoryDone(true);
            setSetupWizardOpen(false);
          }}
        />
      </>
    );
  }

  // Ambient glow color based on active module
  const ambientGlowClass =
    activeModule === 'habits'
      ? 'from-cyan-500/[0.07] via-sky-500/[0.02] to-transparent'
      : activeModule === 'journey'
      ? 'from-amber-500/[0.08] via-orange-500/[0.02] to-transparent'
      : activeModule === 'tools'
      ? 'from-fuchsia-500/[0.08] via-purple-500/[0.02] to-transparent'
      : 'from-brand-500/[0.06] via-emerald-500/[0.02] to-transparent';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0c0c0e] text-slate-100 font-sans">
      {/* PIN Security Modal */}
      {isLocked && <PinLockModal />}

      {/* Interactive Platform Onboarding Tour */}
      <PlatformTourModal isOpen={tourOpen} onClose={() => setTourOpen(false)} />

      {/* Level-up / achievement celebrations */}
      <GameCelebration />

      {/* Floating Notifications */}
      <ToastContainer />

      {/* Smart Notifications Drawer */}
      <NotificationDrawer />

      {/* Global Transaction Modal */}
      <TransactionModal />

      {/* Banking OFX / CSV Import Modal */}
      <ImportBankModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />

      {/* Cloud Supabase Sync & Auth Modal */}
      <CloudAuthModal
        isOpen={cloudAuthModalOpen}
        onClose={() => setCloudAuthModalOpen(false)}
      />

      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden bg-slate-950/40 relative">
        {/* Contextual Ambient Top Glow */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b ${ambientGlowClass} transition-colors duration-700`}
        />

        <Navbar />
        <UpdateBanner />

        <main className="flex-1 min-h-0 overflow-hidden relative z-10">
          <div key={currentView} className="h-full w-full animate-fade-in">
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'transactions' && <TransactionsView />}
            {currentView === 'accounts' && <AccountsView />}
            {currentView === 'cards' && <CardsView />}
            {currentView === 'budgets' && <BudgetsView />}
            {currentView === 'calendar' && <CalendarView />}
            {currentView === 'categories' && <CategoriesView />}
            {currentView === 'goals' && <GoalsView />}
            {currentView === 'reports' && <ReportsView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'import' && <ImportView />}
            {currentView === 'reserve' && <ReserveView />}
            {currentView.startsWith('journey') && <JourneyView />}
            {currentView.startsWith('habits') && <HabitsView />}
            {currentView === 'intelligence' && <IntelligenceView />}
            {currentView.startsWith('tools') && <ToolsView />}
          </div>
        </main>
      </div>
    </div>
  );
};
