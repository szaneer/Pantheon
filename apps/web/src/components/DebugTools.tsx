import React, { useState } from 'react';
import { 
  Bug, 
  Activity, 
  Network,
  Zap,
  Terminal,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download
} from 'lucide-react';
import p2pClientServiceV2 from '../services/p2pClientServiceV2';

interface ConnectionTest {
  name: string;
  endpoint: string;
  status: 'pending' | 'testing' | 'success' | 'failed';
  latency?: number;
  error?: string;
}

interface DebugLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
}

export const DebugTools: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'connectivity' | 'p2p' | 'logs'>('connectivity');
  const [connectionTests, setConnectionTests] = useState<ConnectionTest[]>([]);
  const [testing, setTesting] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [p2pStats, setP2pStats] = useState<any>(null);

  // Test connectivity to various endpoints
  const runConnectivityTests = async () => {
    setTesting(true);
    const tests: ConnectionTest[] = [
      {
        name: 'Signaling Server',
        endpoint: import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:3001',
        status: 'pending'
      },
      {
        name: 'Firebase Auth',
        endpoint: 'https://identitytoolkit.googleapis.com/v1/accounts:lookup',
        status: 'pending'
      },
      {
        name: 'Ollama Local',
        endpoint: 'http://localhost:11434/api/tags',
        status: 'pending'
      },
      {
        name: 'STUN Server',
        endpoint: 'stun:stun.l.google.com:19302',
        status: 'pending'
      }
    ];

    setConnectionTests(tests);

    // Test each endpoint
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      
      // Update status to testing
      setConnectionTests(prev => prev.map((t, idx) => 
        idx === i ? { ...t, status: 'testing' } : t
      ));

      const startTime = Date.now();

      try {
        if (test.name === 'STUN Server') {
          // Special handling for STUN server test
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: test.endpoint }]
          });
          
          // Create a data channel to trigger ICE gathering
          pc.createDataChannel('test');
          
          // Wait for ICE gathering
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
            
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                clearTimeout(timeout);
                resolve(true);
              }
            };
            
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
          });
          
          pc.close();
          
          test.status = 'success';
          test.latency = Date.now() - startTime;
        } else {
          // HTTP endpoint test
          const response = await fetch(test.endpoint, {
            method: test.name === 'Firebase Auth' ? 'POST' : 'GET',
            mode: 'cors',
            signal: AbortSignal.timeout(5000),
            headers: test.name === 'Firebase Auth' ? {
              'Content-Type': 'application/json'
            } : undefined,
            body: test.name === 'Firebase Auth' ? JSON.stringify({ idToken: 'test' }) : undefined
          });
          
          test.status = response.ok || response.status === 400 ? 'success' : 'failed';
          test.latency = Date.now() - startTime;
          
          if (!response.ok && response.status !== 400) {
            test.error = `HTTP ${response.status}`;
          }
        }
      } catch (error) {
        test.status = 'failed';
        test.latency = Date.now() - startTime;
        test.error = error instanceof Error ? error.message : 'Unknown error';
      }

      // Update test result
      setConnectionTests(prev => prev.map((t, idx) => 
        idx === i ? test : t
      ));
    }

    setTesting(false);
    
    // Log results
    addDebugLog('info', 'Connectivity test completed', { tests });
  };

  // Get P2P stats
  const refreshP2PStats = () => {
    const status = p2pClientServiceV2.getStatus();
    const peers = p2pClientServiceV2.getConnectedPeers();
    const models = p2pClientServiceV2.getAvailableModels();
    
    const stats = {
      status: status.status,
      connected: status.connected,
      serverUrl: status.serverUrl,
      peerId: status.peerId,
      totalPeers: peers.length,
      totalModels: models.length,
      peerDetails: peers.map(peer => ({
        id: peer.id,
        name: peer.name,
        modelCount: peer.models?.length || 0,
        hosting: peer.hosting || false
      }))
    };
    
    setP2pStats(stats);
    addDebugLog('info', 'P2P stats refreshed', stats);
  };

  // Add debug log
  const addDebugLog = (level: 'info' | 'warn' | 'error', message: string, details?: any) => {
    const log: DebugLog = {
      timestamp: new Date(),
      level,
      message,
      details
    };
    
    setDebugLogs(prev => [log, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  // Export debug logs
  const exportLogs = () => {
    const logData = {
      exportDate: new Date().toISOString(),
      logs: debugLogs,
      p2pStats,
      connectionTests,
      systemInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pantheon-debug-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear logs
  const clearLogs = () => {
    setDebugLogs([]);
    addDebugLog('info', 'Debug logs cleared');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'testing':
        return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'warn':
        return <AlertCircle className="w-3 h-3 text-yellow-500" />;
      default:
        return <CheckCircle className="w-3 h-3 text-blue-500" />;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg">
      <div
        className="p-4 cursor-pointer hover:bg-gray-700 transition-colors flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold">Debug Tools</h3>
          <span className="text-sm text-gray-400">
            Diagnostics & Troubleshooting
          </span>
        </div>
        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('connectivity')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'connectivity'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4" />
                Connectivity
              </div>
            </button>
            <button
              onClick={() => setActiveTab('p2p')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'p2p'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                P2P Stats
              </div>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Logs ({debugLogs.length})
              </div>
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === 'connectivity' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">Connection Tests</h4>
                  <button
                    onClick={runConnectivityTests}
                    disabled={testing}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {testing ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                    Run Tests
                  </button>
                </div>

                {connectionTests.length > 0 ? (
                  <div className="space-y-2">
                    {connectionTests.map((test, idx) => (
                      <div key={idx} className="bg-gray-900 rounded p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(test.status)}
                            <span className="font-medium text-sm">{test.name}</span>
                          </div>
                          <div className="text-right">
                            {test.latency && (
                              <span className="text-xs text-gray-400">
                                {test.latency}ms
                              </span>
                            )}
                            {test.error && (
                              <p className="text-xs text-red-400 mt-1">{test.error}</p>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{test.endpoint}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    Click "Run Tests" to check connectivity to various services
                  </p>
                )}
              </div>
            )}

            {activeTab === 'p2p' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">P2P Statistics</h4>
                  <button
                    onClick={refreshP2PStats}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-2"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>

                {p2pStats ? (
                  <div className="space-y-3">
                    <div className="bg-gray-900 rounded p-3">
                      <h5 className="text-sm font-medium mb-2">Connection Status</h5>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <p className="text-gray-300">{p2pStats.status}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Connected:</span>
                          <p className="text-gray-300">{p2pStats.connected ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Peers:</span>
                          <p className="text-gray-300">{p2pStats.totalPeers}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Models:</span>
                          <p className="text-gray-300">{p2pStats.totalModels}</p>
                        </div>
                      </div>
                    </div>

                    {p2pStats.peerDetails.length > 0 && (
                      <div className="bg-gray-900 rounded p-3">
                        <h5 className="text-sm font-medium mb-2">Connected Peers</h5>
                        <div className="space-y-2">
                          {p2pStats.peerDetails.map((peer: any) => (
                            <div key={peer.id} className="text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-300">{peer.name}</span>
                                <span className="text-gray-500">
                                  {peer.modelCount} models
                                </span>
                              </div>
                              <p className="text-gray-500 font-mono">{peer.id.substring(0, 20)}...</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    Click "Refresh" to get current P2P statistics
                  </p>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">Debug Logs</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={clearLogs}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                    >
                      Clear
                    </button>
                    <button
                      onClick={exportLogs}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                  </div>
                </div>

                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {debugLogs.length > 0 ? (
                    debugLogs.map((log, idx) => (
                      <div key={idx} className="bg-gray-900 rounded p-2 text-xs">
                        <div className="flex items-start gap-2">
                          {getLogIcon(log.level)}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-300">{log.message}</span>
                              <span className="text-gray-500">
                                {log.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            {log.details && (
                              <pre className="text-gray-500 mt-1 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">No debug logs yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};