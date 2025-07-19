import { useState, useEffect } from 'react';
import { Server, Users, Wifi, WifiOff } from 'lucide-react';

export function ModelHostingToggle() {
  const [hostingEnabled, setHostingEnabled] = useState(false);
  const [hostingActive, setHostingActive] = useState(false);
  const [status, setStatus] = useState('disconnected');
  const [statusMessage, setStatusMessage] = useState('');
  const [models, setModels] = useState([]);
  const [localModelCount, setLocalModelCount] = useState(0);
  const [connectedPeers, setConnectedPeers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoStartHosting, setAutoStartHosting] = useState(false);

  useEffect(() => {
    const setupListeners = async () => {
      // Load auto-start preference from electron store
      try {
        const savedAutoStart = await window.electronAPI?.getStoreValue('autoStartHosting');
        if (savedAutoStart !== undefined) {
          setAutoStartHosting(savedAutoStart);
        }
      } catch (error) {
        console.warn('Failed to load auto-start preference:', error);
      }

      // Subscribe to hosting status changes
      await window.electronAPI?.p2p?.addHostingListener();
      window.electronAPI?.p2p?.onHostingChanged((event, data) => {
        setHostingEnabled(data.enabled);
        setHostingActive(data.active || false);
        if (data.models) {
          setModels(data.models);
        }
      });

      // Subscribe to status changes
      await window.electronAPI?.p2p?.addStatusListener();
      window.electronAPI?.p2p?.onStatusChanged((event, data) => {
        setStatus(data.status);
        setStatusMessage(data.message || '');
      });

      // Subscribe to peer events
      await window.electronAPI?.p2p?.addPeerListener();
      window.electronAPI?.p2p?.onPeerChanged((event, data) => {
        if (data.type === 'connected') {
          setConnectedPeers(prev => prev + 1);
        } else if (data.type === 'left') {
          setConnectedPeers(prev => Math.max(0, prev - 1));
        }
      });

      // Get initial status
      try {
        const initialStatus = await window.electronAPI?.p2p?.getStatus();
        if (initialStatus) {
          setHostingEnabled(initialStatus.hostingEnabled);
          setHostingActive(initialStatus.isHosting);
          setStatus(initialStatus.status);
          setConnectedPeers(initialStatus.connectedPeers);
        }
      } catch (error) {
        console.error('Failed to get initial P2P status:', error);
      }

      // Fetch local models count
      try {
        const localModels = await window.electronAPI?.llm?.listLocalModels();
        if (localModels && Array.isArray(localModels)) {
          setLocalModelCount(localModels.length);
        }
      } catch (error) {
        console.error('Failed to fetch local models:', error);
      }
    };

    setupListeners();

    return () => {
      window.electronAPI?.p2p?.removeHostingChanged();
      window.electronAPI?.p2p?.removeStatusChanged();
      window.electronAPI?.p2p?.removePeerChanged();
    };
  }, []);

  const handleToggleHosting = async () => {
    setLoading(true);
    try {
      if (hostingEnabled) {
        await window.electronAPI?.p2p?.disableHosting();
      } else {
        await window.electronAPI?.p2p?.enableHosting();
      }
    } catch (error) {
      console.error('Failed to toggle hosting:', error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoStartToggle = async (e) => {
    const newValue = e.target.checked;
    setAutoStartHosting(newValue);
    try {
      await window.electronAPI?.setStoreValue('autoStartHosting', newValue);
    } catch (error) {
      console.error('Failed to save auto-start preference:', error);
    }
  };

  const getStatusIcon = () => {
    if (status === 'hosting' || hostingActive) {
      return <Wifi className="w-4 h-4 text-green-500" />;
    } else if (status === 'connecting' || status === 'reconnecting') {
      return <Wifi className="w-4 h-4 text-yellow-500 animate-pulse" />;
    } else if (status === 'error') {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
    return <WifiOff className="w-4 h-4 text-gray-500" />;
  };

  const getStatusText = () => {
    if (status === 'hosting' || hostingActive) {
      return `Hosting ${localModelCount} models`;
    }
    if (statusMessage) {
      return statusMessage;
    }
    if (!status || typeof status !== 'string') {
      return 'Disconnected';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center">
        <Server className="w-5 h-5 mr-2" />
        Model Hosting
      </h3>

      {/* Compact Toggle Section */}
      <div className="bg-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-300">
              Share your local models with other devices
            </p>
            <div className="mt-1 flex items-center space-x-2 text-xs">
              {getStatusIcon()}
              <span className="text-gray-400">{getStatusText()}</span>
            </div>
          </div>
          
          <button
            onClick={handleToggleHosting}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${
              hostingEnabled 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-500 text-gray-100'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                ...
              </span>
            ) : (
              hostingEnabled ? 'Stop Hosting' : 'Start Hosting'
            )}
          </button>
        </div>
        
        {/* Auto-start checkbox */}
        <div className="flex items-center space-x-2 pt-2 border-t border-gray-600">
          <input
            type="checkbox"
            id="autoStartHosting"
            checked={autoStartHosting}
            onChange={handleAutoStartToggle}
            className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
          />
          <label htmlFor="autoStartHosting" className="text-sm text-gray-300 cursor-pointer">
            Enable hosting on startup
          </label>
        </div>
      </div>

      {/* Compact details when hosting is active */}
      {hostingActive && (
        <div className="bg-gray-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">Connected Peers</span>
            </div>
            <span className="text-white font-medium">{connectedPeers}</span>
          </div>
          
          {models.length > 0 && (
            <div className="text-xs text-gray-400">
              <span className="text-gray-300">Models:</span> {models.map(m => typeof m === 'string' ? m : m.name).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {status === 'error' && statusMessage && (
        <div className="bg-red-900 rounded-lg p-3">
          <p className="text-red-200 text-xs">{statusMessage}</p>
        </div>
      )}
    </div>
  );
}