const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, closeDatabase } = require('./database.cjs');
const { getFinancialService } = require('./services.cjs');
const { setTokenCipher } = require('./cloudAuth.cjs');

const BACKUP_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let mainWindow = null;
let service = null;
const QUIT_SYNC_TIMEOUT_MS = 8000;
let quitSyncDone = false;

// Error logging helper
function logError(error, context = '') {
  try {
    const userDataPath = app.getPath('userData');
    const logPath = path.join(userDataPath, 'app_errors.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${context}] ${error.stack || error.message || error}\n`;
    fs.appendFileSync(logPath, logEntry, 'utf8');
  } catch (e) {
    console.error('Failed to write to error log:', e);
  }
}

// Wrap IPC calls with safety and user-friendly error messages
function handleIpc(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logError(error, channel);
      // Return user-friendly error message, hiding raw technical details
      const message = error.message && !error.message.includes('SQLITE_')
        ? error.message
        : 'Não foi possível completar a operação. Verifique os dados e tente novamente.';
      throw new Error(message);
    }
  });
}

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, '../public/assets/pigo-icon.png'))
    ? path.join(__dirname, '../public/assets/pigo-icon.png')
    : path.join(__dirname, '../dist/assets/pigo-icon.png');

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 820,
    minWidth: 1060,
    minHeight: 680,
    backgroundColor: '#090d16',
    title: 'Pigo - Finanças Pessoais',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false, // Wait until ready-to-show to avoid white flicker
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Check if running in dev or production
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const devUrl = 'http://localhost:5173';

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    mainWindow.loadURL(devUrl).catch(() => {
      // Fallback to built files if dev server not active
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Envia o estado da atualização automática para a interface
function sendUpdateStatus(status) {
  mainWindow?.webContents.send('app:updateStatus', status);
}

let autoUpdater = null;
function setupAutoUpdater() {
  // Só a versão instalada (NSIS) pode se atualizar; dev e win-unpacked não
  if (!app.isPackaged) return;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    logError(e, 'autoUpdater load');
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => sendUpdateStatus({ state: 'downloading', version: info.version }));
  autoUpdater.on('update-downloaded', (info) => sendUpdateStatus({ state: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => logError(err, 'autoUpdater'));
  const check = () => autoUpdater.checkForUpdates().catch(err => logError(err, 'autoUpdater check'));
  check();
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
}

app.whenReady().then(() => {
  // Tokens da nuvem cifrados com a proteção do Windows (DPAPI)
  if (safeStorage.isEncryptionAvailable()) {
    setTokenCipher({
      encrypt: (text) => safeStorage.encryptString(text).toString('base64'),
      decrypt: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64')),
    });
  }

  // Initialize Database in user data dir with self-healing recovery
  try {
    initDatabase();
    service = getFinancialService();
  } catch (err) {
    logError(err, 'Database Initialization - Attempt 1');
    try {
      // Auto-recovery attempt: backup existing corrupted/locked db and recreate cleanly
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'meu_financeiro.sqlite');
      if (fs.existsSync(dbPath)) {
        const backupPath = path.join(userDataPath, `meu_financeiro_recovery_${Date.now()}.sqlite`);
        try { fs.copyFileSync(dbPath, backupPath); } catch (e) {}
        try { fs.unlinkSync(dbPath); } catch (e) {}
        try { fs.unlinkSync(`${dbPath}-wal`); } catch (e) {}
        try { fs.unlinkSync(`${dbPath}-shm`); } catch (e) {}
      }
      initDatabase();
      service = getFinancialService();
    } catch (retryErr) {
      logError(retryErr, 'Database Initialization - Retry Failed');
      dialog.showErrorBox(
        'Erro ao inicializar Meu Financeiro',
        'Não foi possível inicializar o banco de dados local. Por favor, reinicie a aplicação.'
      );
      app.quit();
      return;
    }
  }

  try {
    service.cloudAuth.encryptStoredTokens();
  } catch (e) {
    logError(e, 'encryptStoredTokens');
  }

  // Backup diário automático (e verificação periódica para quem deixa o app aberto)
  const runDailyBackup = () => service.runDailyBackupIfDue().catch(err => logError(err, 'daily backup'));
  runDailyBackup();
  setInterval(runDailyBackup, BACKUP_CHECK_INTERVAL_MS);

  // Register IPC Handlers

  // App version & auto-update
  handleIpc('app:getVersion', () => ({ version: app.getVersion(), canAutoUpdate: app.isPackaged }));
  handleIpc('app:checkForUpdates', async () => {
    if (!autoUpdater) return { state: 'unavailable' };
    const res = await autoUpdater.checkForUpdates();
    return { state: res?.updateInfo?.version && res.updateInfo.version !== app.getVersion() ? 'downloading' : 'up_to_date', version: res?.updateInfo?.version };
  });
  handleIpc('app:installUpdate', async () => {
    if (!autoUpdater) return false;
    // Envia alterações pendentes antes de reiniciar
    quitSyncDone = true;
    await Promise.race([
      service.triggerCloudSync().catch(err => logError(err, 'pre-update sync')),
      new Promise(resolve => setTimeout(resolve, QUIT_SYNC_TIMEOUT_MS)),
    ]);
    autoUpdater.quitAndInstall();
    return true;
  });

  // Local automatic backups
  handleIpc('backup:listLocal', () => ({ folder: service.getLocalBackupsFolder(), backups: service.listLocalBackups() }));
  handleIpc('backup:createNow', () => service.createLocalBackup('manual'));
  handleIpc('backup:openFolder', async () => {
    const folder = service.getLocalBackupsFolder();
    await shell.openPath(folder);
    return folder;
  });
  handleIpc('backup:chooseFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Escolher pasta extra para os backups automáticos',
      properties: ['openDirectory', 'createDirectory'],
    });
    return canceled || filePaths.length === 0 ? null : filePaths[0];
  });
  handleIpc('backup:restoreLocal', async (fileName) => {
    const folder = service.getLocalBackupsFolder();
    const source = path.join(folder, path.basename(String(fileName)));
    if (!fs.existsSync(source)) throw new Error('Backup não encontrado.');
    await service.createLocalBackup('pre-restore');

    const dbPath = path.join(app.getPath('userData'), 'meu_financeiro.sqlite');
    closeDatabase();
    for (const suffix of ['-wal', '-shm']) {
      try { fs.unlinkSync(`${dbPath}${suffix}`); } catch (e) {}
    }
    fs.copyFileSync(source, dbPath);
    quitSyncDone = true;
    app.relaunch();
    app.exit(0);
    return true;
  });

  // Window Controls
  handleIpc('window:minimize', () => mainWindow?.minimize());
  handleIpc('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
    return mainWindow?.isMaximized();
  });
  handleIpc('window:close', () => mainWindow?.close());
  handleIpc('window:isMaximized', () => mainWindow?.isMaximized());

  // Settings & Security
  handleIpc('settings:get', () => service.getSettings());
  handleIpc('settings:update', (data) => service.updateSettings(data));
  handleIpc('pin:set', (pin) => service.setPin(pin));
  handleIpc('pin:disable', (currentPin) => service.disablePin(currentPin));
  handleIpc('pin:verify', (pin) => service.verifyAppPin(pin));
  handleIpc('pin:isConfigured', () => service.isPinConfigured());

  // Accounts
  handleIpc('accounts:get', (includeArchived) => service.getAccounts(includeArchived));
  handleIpc('accounts:create', (data) => service.createAccount(data));
  handleIpc('accounts:update', (id, data) => service.updateAccount(id, data));
  handleIpc('accounts:delete', (id) => service.deleteAccount(id));
  handleIpc('accounts:adjustBalance', (data) => service.adjustAccountBalance(data));

  // Categories
  handleIpc('categories:get', () => service.getCategories());
  handleIpc('categories:create', (data) => service.createCategory(data));
  handleIpc('categories:update', (id, data) => service.updateCategory(id, data));
  handleIpc('categories:delete', (id) => service.deleteCategory(id));

  // Credit Cards
  handleIpc('cards:get', (includeArchived) => service.getCreditCards(includeArchived));
  handleIpc('cards:create', (data) => service.createCreditCard(data));
  handleIpc('cards:update', (id, data) => service.updateCreditCard(id, data));
  handleIpc('cards:delete', (id) => service.deleteCreditCard(id));
  handleIpc('cards:getInvoices', (cardId) => service.getCardInvoices(cardId));
  handleIpc('cards:payInvoice', (data) => service.payCardInvoice(data));

  // Transactions
  handleIpc('transactions:get', (filters) => service.getTransactions(filters));
  handleIpc('transactions:create', (data) => service.createTransaction(data));
  handleIpc('transactions:update', (id, data) => service.updateTransaction(id, data));
  handleIpc('transactions:delete', (id, deleteGroup) => service.deleteTransaction(id, deleteGroup));
  handleIpc('transactions:duplicate', (id) => service.duplicateTransaction(id));
  handleIpc('transactions:batchMove', (data) => service.batchMoveTransactions(data));

  // Category Budgets
  handleIpc('budgets:get', (monthKey) => service.getCategoryBudgets(monthKey));
  handleIpc('budgets:set', (data) => service.setCategoryBudget(data));
  handleIpc('budgets:delete', (id) => service.deleteCategoryBudget(id));

  // Smart Notifications
  handleIpc('notifications:get', () => service.getNotifications());
  handleIpc('notifications:markRead', (id) => service.markNotificationRead(id));
  handleIpc('notifications:markAllRead', () => service.markAllNotificationsRead());
  handleIpc('notifications:delete', (id) => service.deleteNotification(id));

  // Banking OFX & CSV Import & Vault
  handleIpc('banking:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar Extrato Bancário (OFX ou CSV)',
      filters: [
        { name: 'Extratos Bancários (*.ofx, *.qfx, *.csv)', extensions: ['ofx', 'qfx', 'csv'] },
        { name: 'Arquivos OFX (*.ofx, *.qfx)', extensions: ['ofx', 'qfx'] },
        { name: 'Planilhas CSV (*.csv)', extensions: ['csv'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    if (canceled || filePaths.length === 0) return { canceled: true };

    const files = filePaths.map(filePath => {
      const fileName = path.basename(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const isOfx = fileName.toLowerCase().endsWith('.ofx') || fileName.toLowerCase().endsWith('.qfx');
      const fileType = isOfx ? 'ofx' : 'csv';

      let savedStatement = null;
      try {
        savedStatement = service.saveImportedStatement({
          originalName: fileName,
          fileType,
          content,
        });
      } catch (err) {
        logError(err, 'banking:saveImportedStatement');
      }

      return {
        filePath,
        fileName,
        fileType,
        content,
        savedStatementId: savedStatement ? savedStatement.id : null,
        savedPath: savedStatement ? savedStatement.savedPath : null,
      };
    });

    const first = files[0];
    return { 
      canceled: false, 
      files,
      filePath: first.filePath, 
      fileName: files.length > 1 ? `${files.length} arquivos selecionados` : first.fileName, 
      fileType: first.fileType, 
      content: first.content, 
      savedStatementId: first.savedStatementId,
      savedPath: first.savedPath,
    };
  });
  handleIpc('banking:parseOFX', (content) => service.parseOFX(content));
  handleIpc('banking:parseCSV', (content, customMapping) => service.parseCSV(content, customMapping));
  handleIpc('banking:reconcile', (data) => service.reconcileImport(data));
  handleIpc('banking:batchImport', (data) => service.batchImportTransactions(data));
  handleIpc('banking:reassignStatementAccount', (data) => service.reassignStatementAccount(data));
  handleIpc('banking:deleteStatementTransactions', (statementId) => service.deleteStatementTransactions(statementId));
  handleIpc('banking:getSavedStatements', () => service.getImportedStatements());
  handleIpc('banking:saveStatement', (data) => service.saveImportedStatement(data));
  handleIpc('banking:updateStatementStats', (id, data) => service.updateImportedStatementStats(id, data));
  handleIpc('banking:openStatementsFolder', async () => {
    const folderPath = service.getStatementsFolderPath();
    await shell.openPath(folderPath);
    return folderPath;
  });

  // Learned Auto-Categorization Import Rules
  handleIpc('importRules:get', () => service.getImportRules());
  handleIpc('importRules:save', (data) => service.saveImportRule(data));
  handleIpc('importRules:delete', (id) => service.deleteImportRule(id));
  handleIpc('importRules:toggle', (id) => service.toggleImportRule(id));

  // Financial Calendar & Projections
  handleIpc('calendar:get', (year, month) => service.getCalendarData(year, month));

  // Goals
  handleIpc('goals:get', () => service.getGoals());
  handleIpc('goals:create', (data) => service.createGoal(data));
  handleIpc('goals:update', (id, data) => service.updateGoal(id, data));
  handleIpc('goals:delete', (id) => service.deleteGoal(id));
  handleIpc('goals:addFunds', (id, amount, accountId) => service.addFundsToGoal(id, amount, accountId));

  // Dashboard & Reports
  handleIpc('dashboard:get', () => service.getDashboardData());
  handleIpc('reports:get', (filters) => service.getReports(filters));

  // Financial Intelligence Engine (100% Local & Offline)
  handleIpc('intelligence:getOverview', () => service.getIntelligenceOverview());
  handleIpc('intelligence:getHealthScore', (targetDate) => service.getFinancialHealthScore(targetDate));
  handleIpc('intelligence:getForecast', (daysAhead) => service.getBalanceForecast(daysAhead));
  handleIpc('intelligence:getInsights', (targetMonthKey) => service.getSmartInsights(targetMonthKey));
  handleIpc('intelligence:getAnomalies', (monthsBack) => service.detectAnomalies(monthsBack));
  handleIpc('intelligence:suggestCategory', (description, amount) => service.suggestCategory(description, amount));
  handleIpc('intelligence:detectRecurring', () => service.detectRecurringPatterns());
  handleIpc('intelligence:getCardAnalysis', () => service.getCreditCardIntelligence());
  handleIpc('intelligence:getGoals', () => service.getGoalsIntelligence());
  handleIpc('intelligence:getMonthlyCloseout', (yearMonth) => service.getMonthlyCloseout(yearMonth));

  // Reserva Financeira
  handleIpc('reserve:get', (monthKey) => service.getReserveOverview(monthKey));
  handleIpc('reserve:setExcluded', (transactionId, excluded) => service.setReserveTransactionExcluded(transactionId, excluded));
  handleIpc('reserve:registerMovement', (data) => service.registerReserveMovement(data));

  // Cloud Auth & Sync (Supabase / Local-First)
  handleIpc('cloud:getSession', () => service.getCloudSession());
  handleIpc('cloud:signIn', (email, password, config) => service.cloudSignIn(email, password, config));
  handleIpc('cloud:signUp', (email, password, config) => service.cloudSignUp(email, password, config));
  handleIpc('cloud:signOut', () => service.cloudSignOut());
  handleIpc('cloud:updateConfig', (supabaseUrl, supabaseAnonKey) => service.updateCloudConfig(supabaseUrl, supabaseAnonKey));
  handleIpc('cloud:sync', async (options) => {
    if (options?.fullResync) await service.createLocalBackup('pre-resync').catch(err => logError(err, 'pre-resync backup'));
    return service.triggerCloudSync(options);
  });
  handleIpc('cloud:pendingCount', () => service.getCloudPendingCount());
  handleIpc('cloud:fullPull', async () => {
    await service.createLocalBackup('pre-restore').catch(err => logError(err, 'pre-pull backup'));
    return service.cloudFullPull();
  });

  // Backup & Restore Dialogs
  handleIpc('backup:export', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Backup Completo - Meu Financeiro',
      defaultPath: `meu_financeiro_backup_${today}.json`,
      filters: [{ name: 'Arquivo de Backup JSON (*.json)', extensions: ['json'] }],
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    const backupJson = service.exportBackup();
    fs.writeFileSync(filePath, backupJson, 'utf8');
    return { success: true, filePath };
  });

  handleIpc('backup:restore', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Restaurar Backup - Meu Financeiro',
      filters: [{ name: 'Arquivo de Backup JSON (*.json)', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (canceled || filePaths.length === 0) return { success: false, canceled: true };

    const content = fs.readFileSync(filePaths[0], 'utf8');
    await service.createLocalBackup('pre-restore');
    service.restoreBackup(content);
    return { success: true };
  });

  handleIpc('csv:export', async (filters) => {
    const today = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Lançamentos para CSV - Meu Financeiro',
      defaultPath: `meu_financeiro_lancamentos_${today}.csv`,
      filters: [{ name: 'Planilha CSV (*.csv)', extensions: ['csv'] }],
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    const csvContent = service.exportTransactionsCSV(filters);
    fs.writeFileSync(filePath, csvContent, 'utf8');
    return { success: true, filePath };
  });

  // Demo Data
  handleIpc('demo:seed', () => service.seedDemoData());
  handleIpc('demo:clear', () => service.clearDemoData());

  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Push pending local changes before quitting so the next computer sees them
app.on('before-quit', (event) => {
  if (quitSyncDone || !service) return;
  quitSyncDone = true;
  try {
    const session = service.getCloudSession();
    if (!session?.userId || service.getCloudPendingCount() === 0) return;
  } catch (e) {
    return;
  }

  event.preventDefault();
  const timeout = new Promise(resolve => setTimeout(resolve, QUIT_SYNC_TIMEOUT_MS));
  Promise.race([
    service.triggerCloudSync().catch(err => logError(err, 'before-quit sync')),
    timeout,
  ]).finally(() => app.quit());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
