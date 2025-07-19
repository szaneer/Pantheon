import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Download, Trash2, FolderOpen, RefreshCw } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

export const DebugLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logLevel, setLogLevel] = useState<string>('info');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = async () => {
    try {
      const logEntries = await window.electronAPI.logging.getLogs(null, 500);
      setLogs(logEntries);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  useEffect(() => {
    fetchLogs();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 2000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  useEffect(() => {
    if (autoRefresh && logsContainerRef.current && logsEndRef.current) {
      // Scroll within the container instead of the whole page
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleClearLogs = async () => {
    try {
      await window.electronAPI.logging.clearLogs();
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const handleOpenLogsFolder = async () => {
    try {
      await window.electronAPI.logging.openLogsFolder();
    } catch (error) {
      console.error('Failed to open logs folder:', error);
    }
  };

  const handleSetLogLevel = async (level: string) => {
    try {
      await window.electronAPI.logging.setLevel(level);
      setLogLevel(level);
    } catch (error) {
      console.error('Failed to set log level:', error);
    }
  };

  const getLogFile = async () => {
    try {
      const logFile = await window.electronAPI.logging.getLogFile();
      console.log('Log file:', logFile);
    } catch (error) {
      console.error('Failed to get log file:', error);
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

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold">Debug Logs</h2>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Log Level Selector */}
          <select
            value={logLevel}
            onChange={(e) => handleSetLogLevel(e.target.value)}
            className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded transition-colors ${
              autoRefresh ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </button>

          {/* Clear Logs */}
          <button
            onClick={handleClearLogs}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Open Logs Folder */}
          <button
            onClick={handleOpenLogsFolder}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title="Open logs folder"
          >
            <FolderOpen className="w-4 h-4" />
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
      <div className="flex-1 overflow-hidden">
        <div ref={logsContainerRef} className="h-full overflow-y-auto p-4 font-mono text-xs">
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
      </div>
    </div>
  );
};