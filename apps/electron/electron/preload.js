const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Device management
  getDeviceId: () => ipcRenderer.invoke('store-get-device-id'),
  getStoreValue: (key) => ipcRenderer.invoke('store-get', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('store-set', key, value),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // Store API
  store: {
    get: (key) => ipcRenderer.invoke('store-get', key),
    set: (key, value) => ipcRenderer.invoke('store-set', key, value),
  },
  
  // Crypto API
  crypto: {
    generateSecureId: (length) => ipcRenderer.invoke('crypto-generate-secure-id', length),
  },
  
  // Window management
  isWindowVisible: () => ipcRenderer.invoke('is-window-visible'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  
  // Navigation
  onNavigateTo: (callback) => ipcRenderer.on('navigate-to', callback),
  removeNavigateTo: () => ipcRenderer.removeAllListeners('navigate-to'),
  
  // Network interface detection
  getNetworkInterfaces: () => ipcRenderer.invoke('get-network-interfaces'),
  
  // Battery state
  getBatteryState: () => ipcRenderer.invoke('get-battery-state'),
  
  // P2P coordination service
  p2p: {
    getStatus: () => ipcRenderer.invoke('p2p-get-status'),
    connect: () => ipcRenderer.invoke('p2p-connect'),
    disconnect: () => ipcRenderer.invoke('p2p-disconnect'),
    setCurrentUserId: (userId, authToken) => ipcRenderer.invoke('p2p-set-user-id', userId, authToken),
    setAuthToken: (token) => ipcRenderer.invoke('p2p-set-auth-token', token),
    enableHosting: () => ipcRenderer.invoke('p2p-enable-hosting'),
    disableHosting: () => ipcRenderer.invoke('p2p-disable-hosting'),
    addStatusListener: () => ipcRenderer.invoke('p2p-add-status-listener'),
    addHostingListener: () => ipcRenderer.invoke('p2p-add-hosting-listener'),
    addPeerListener: () => ipcRenderer.invoke('p2p-add-peer-listener'),
    onStatusChanged: (callback) => ipcRenderer.on('p2p-status-changed', callback),
    onHostingChanged: (callback) => ipcRenderer.on('p2p-hosting-changed', callback),
    onPeerChanged: (callback) => ipcRenderer.on('p2p-peer-changed', callback),
    removeStatusChanged: () => ipcRenderer.removeAllListeners('p2p-status-changed'),
    removeHostingChanged: () => ipcRenderer.removeAllListeners('p2p-hosting-changed'),
    removePeerChanged: () => ipcRenderer.removeAllListeners('p2p-peer-changed')
  },
  
  // Additional P2P methods for model detection
  p2pGetStatus: () => ipcRenderer.invoke('p2p-get-status'),
  p2pGetPeers: () => ipcRenderer.invoke('p2p-get-peers'),
  p2pOnStatus: (callback) => ipcRenderer.on('p2p-status-changed', callback),
  p2pOnPeer: (callback) => ipcRenderer.on('p2p-peer-changed', callback),
  
  // Apple Foundation Models
  appleModels: {
    isSupported: () => ipcRenderer.invoke('apple-models-supported'),
    initialize: () => ipcRenderer.invoke('apple-models-initialize'),
    getModels: () => ipcRenderer.invoke('apple-models-get-models'),
    chat: (request) => ipcRenderer.invoke('apple-models-chat', request),
    getSystemRequirements: () => ipcRenderer.invoke('apple-models-get-requirements')
  },
  
  // macOS ML Models (Available Today)
  getMacOSModels: () => ipcRenderer.invoke('macos-ml-get-models'),
  testMacOSML: (request) => ipcRenderer.invoke('macos-ml-test', request),

  // Ollama Manager
  ollama: {
    checkInstallation: () => ipcRenderer.invoke('ollama-check-installation'),
    openDownloadPage: () => ipcRenderer.invoke('ollama-open-download-page'),
    initialize: () => ipcRenderer.invoke('ollama-initialize'),
    download: () => ipcRenderer.invoke('ollama-download'),
    start: () => ipcRenderer.invoke('ollama-start'),
    stop: () => ipcRenderer.invoke('ollama-stop'),
    isRunning: () => ipcRenderer.invoke('ollama-is-running'),
    listModels: () => ipcRenderer.invoke('ollama-list-models'),
    pullModel: (modelName) => ipcRenderer.invoke('ollama-pull-model', modelName),
    deleteModel: (modelName) => ipcRenderer.invoke('ollama-delete-model', modelName),
    getModelInfo: (modelName) => ipcRenderer.invoke('ollama-get-model-info', modelName),
    onDownloadProgress: (callback) => ipcRenderer.on('ollama-download-progress', callback),
    onPullProgress: (callback) => ipcRenderer.on('ollama-pull-progress', callback),
    removeDownloadProgress: () => ipcRenderer.removeAllListeners('ollama-download-progress'),
    removePullProgress: () => ipcRenderer.removeAllListeners('ollama-pull-progress')
  },
  
  // LLM API
  llm: {
    listLocalModels: () => ipcRenderer.invoke('llm-list-local-models')
  },
  
  // Logging
  logging: {
    getLogs: (level, limit) => ipcRenderer.invoke('logging-get-logs', level, limit),
    getLogFile: () => ipcRenderer.invoke('logging-get-log-file'),
    getLogsDirectory: () => ipcRenderer.invoke('logging-get-logs-directory'),
    clearLogs: () => ipcRenderer.invoke('logging-clear-logs'),
    setLevel: (level) => ipcRenderer.invoke('logging-set-level', level),
    openLogsFolder: () => ipcRenderer.invoke('logging-open-logs-folder')
  }
});