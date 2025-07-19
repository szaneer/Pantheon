import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Download, Trash2, RefreshCw, Copy, CheckCircle } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

export const DebugLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Store logs in sessionStorage for persistence
  const storeLogs = (newLogs: LogEntry[]) => {
    sessionStorage.setItem('debugLogs', JSON.stringify(newLogs));
    setLogs(newLogs);
  };

  // Load logs from sessionStorage on mount
  useEffect(() => {
    const storedLogs = sessionStorage.getItem('debugLogs');
    if (storedLogs) {
      setLogs(JSON.parse(storedLogs));
    }
  }, []);

  // Custom logging function for web
  const addLog = (level: string, message: string, data?: any) => {
    const newLog: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    setLogs(prev => {
      const updated = [...prev, newLog].slice(-500); // Keep last 500 logs
      sessionStorage.setItem('debugLogs', JSON.stringify(updated));
      return updated;
    });
  };

  // Override console methods to capture logs
  useEffect(() => {
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    console.log = (...args) => {
      originalConsole.log(...args);
      addLog('info', args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '));
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      addLog('error', args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '));
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      addLog('warn', args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '));
    };

    console.info = (...args) => {
      originalConsole.info(...args);
      addLog('info', args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '));
    };

    console.debug = (...args) => {
      originalConsole.debug(...args);
      addLog('debug', args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '));
    };

    // Capture WebRTC events
    const captureWebRTCEvents = () => {
      // Capture RTCPeerConnection events
      if (window.RTCPeerConnection) {
        const OriginalRTCPeerConnection = window.RTCPeerConnection;
        window.RTCPeerConnection = function(...args) {
          const pc = new OriginalRTCPeerConnection(...args);
          
          pc.addEventListener('iceconnectionstatechange', () => {
            addLog('info', `ICE Connection State: ${pc.iceConnectionState}`);
          });
          
          pc.addEventListener('connectionstatechange', () => {
            addLog('info', `Connection State: ${pc.connectionState}`);
          });
          
          pc.addEventListener('signalingstatechange', () => {
            addLog('info', `Signaling State: ${pc.signalingState}`);
          });
          
          return pc;
        };
        window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
      }
    };

    captureWebRTCEvents();

    return () => {
      // Restore original console methods
      Object.assign(console, originalConsole);
    };
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleClearLogs = () => {
    storeLogs([]);
  };

  const handleExportLogs = () => {
    const logText = logs.map(log => 
      `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}${
        log.data ? ` ${JSON.stringify(log.data)}` : ''
      }`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pantheon-debug-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLogs = async () => {
    const logText = logs.map(log => 
      `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}${
        log.data ? ` ${JSON.stringify(log.data)}` : ''
      }`
    ).join('\n');
    
    try {
      await navigator.clipboard.writeText(logText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy logs:', error);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!filter) return true;
    return log.message.toLowerCase().includes(filter.toLowerCase()) ||
           (log.data && JSON.stringify(log.data).toLowerCase().includes(filter.toLowerCase()));
  });

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      case 'debug': return 'text-gray-400';
      default: return 'text-gray-300';
    }
  };

  // Add system info on mount
  useEffect(() => {
    const addSystemInfo = () => {
      addLog('info', 'Debug Console Initialized');
      addLog('info', `User Agent: ${navigator.userAgent}`);
      addLog('info', `Platform: ${navigator.platform}`);
      addLog('info', `Language: ${navigator.language}`);
      addLog('info', `Online: ${navigator.onLine}`);
      
      // Check WebRTC support
      if (window.RTCPeerConnection) {
        addLog('info', 'WebRTC is supported');
      } else {
        addLog('warn', 'WebRTC is not supported');
      }
      
      // Check WebSocket support
      if (window.WebSocket) {
        addLog('info', 'WebSocket is supported');
      } else {
        addLog('warn', 'WebSocket is not supported');
      }
    };

    addSystemInfo();

    // Monitor online/offline events
    const handleOnline = () => addLog('info', 'Network: Online');
    const handleOffline = () => addLog('warn', 'Network: Offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold">Debug Console</h2>
          <span className="text-xs text-gray-500">({filteredLogs.length} logs)</span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded transition-colors ${
              autoRefresh ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={autoRefresh ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>

          {/* Copy Logs */}
          <button
            onClick={handleCopyLogs}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title="Copy logs to clipboard"
          >
            {copied ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Export Logs */}
          <button
            onClick={handleExportLogs}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title="Export logs"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Clear Logs */}
          <button
            onClick={handleClearLogs}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="p-3 bg-gray-800 border-b border-gray-700">
        <input
          type="text"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            No logs to display
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-gray-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`font-semibold uppercase ${getLogColor(log.level)}`}>
                  [{log.level}]
                </span>
                <span className="flex-1 whitespace-pre-wrap break-all">
                  {log.message}
                  {log.data && (
                    <span className="text-gray-500 ml-2">
                      {JSON.stringify(log.data)}
                    </span>
                  )}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Footer with shortcuts */}
      <div className="p-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        <span>Tip: Open browser console for full debugging capabilities</span>
      </div>
    </div>
  );
};