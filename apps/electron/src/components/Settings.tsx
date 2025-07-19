import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ModelHostingToggle } from './ModelHostingToggle';
import { AppleModelsSection } from './AppleModelsSection';
import { OllamaManager } from './OllamaManager';
import { MacOSModels } from './MacOSModels';
import { Monitor, Wifi, Globe, Server, Users, AlertCircle, CheckCircle, Clock, XCircle, ChevronDown, ChevronRight, Info } from 'lucide-react';

interface P2PStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connected: boolean;
  peerId?: string;
  deviceInfo?: any;
  error?: string;
  serverUrl?: string;
  message?: string;
  connectedPeerIds?: string[];
}

interface ConnectedPeer {
  id: string;
  name: string;
  deviceType: string;
  models?: string[];
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [platform, setPlatform] = useState<string>('');
  
  // P2P state
  const [p2pStatus, setP2pStatus] = useState<P2PStatus>({
    status: 'disconnected',
    connected: false
  });
  const [p2pLoading, setP2pLoading] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<ConnectedPeer[]>([]);
  
  // Collapsible sections
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMacModels, setShowMacModels] = useState(false);

  useEffect(() => {
    // Get platform info
    if (window.electronAPI?.getPlatform) {
      window.electronAPI.getPlatform().then(p => setPlatform(p));
    }
    
    if (user) {
      // Initialize P2P service
      initializeP2P();

      return () => {
        cleanupP2P();
      };
    }
  }, [user]);

  // P2P initialization and cleanup
  const initializeP2P = async () => {
    if (!window.electronAPI?.p2p) {
      console.warn('P2P API not available');
      return;
    }

    try {
      // Note: Don't call setCurrentUserId here - AuthContext handles authentication
      // Just get the current status
      const status = await window.electronAPI.p2p.getStatus();
      setP2pStatus(status);
      updateConnectedPeers(status);
      
      // Set up status listener
      window.electronAPI.p2p.onStatusChanged((event: any, status: P2PStatus) => {
        setP2pStatus(status);
        updateConnectedPeers(status);
      });
      
      // Set up peer listener
      window.electronAPI.p2p.onPeerChanged((event: any, data: any) => {
        // Refresh status to get updated peer list
        window.electronAPI.p2p.getStatus().then((status: P2PStatus) => {
          setP2pStatus(status);
          updateConnectedPeers(status);
        });
      });
      
      // Add listeners to the service
      await window.electronAPI.p2p.addStatusListener();
      await window.electronAPI.p2p.addPeerListener();
      
    } catch (error) {
      console.error('Failed to initialize P2P service:', error);
    }
  };
  
  const updateConnectedPeers = (status: any) => {
    if (status.connectedPeerIds && Array.isArray(status.connectedPeerIds)) {
      const peers: ConnectedPeer[] = status.connectedPeerIds.map((peerId: string) => {
        // Extract device type from peerId (format: userId_deviceType)
        const parts = peerId.split('_');
        const deviceType = parts[parts.length - 1] || 'unknown';
        const userId = parts.slice(0, -1).join('_');
        
        return {
          id: peerId,
          name: `${userId}'s ${deviceType}`,
          deviceType: deviceType,
          models: [] // Will be populated from peer model events
        };
      });
      setConnectedPeers(peers);
    }
  };

  const cleanupP2P = () => {
    if (window.electronAPI?.p2p) {
      window.electronAPI.p2p.removeStatusChanged();
      window.electronAPI.p2p.removePeerChanged();
    }
  };

  // Get connection status display
  const getConnectionStatusDisplay = () => {
    if (p2pStatus.status === 'connected') {
      return {
        icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        text: 'Connected',
        color: 'text-green-500',
        description: `Connected to P2P network${connectedPeers.length > 0 ? ` • ${connectedPeers.length} device${connectedPeers.length !== 1 ? 's' : ''} available` : ''}`
      };
    } else if (p2pStatus.status === 'connecting') {
      return {
        icon: <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />,
        text: 'Connecting',
        color: 'text-yellow-500',
        description: 'Establishing connection to P2P network...'
      };
    } else if (p2pStatus.status === 'error') {
      return {
        icon: <XCircle className="w-5 h-5 text-red-500" />,
        text: 'Connection Error',
        color: 'text-red-500',
        description: p2pStatus.error || 'Unable to connect to P2P network'
      };
    } else {
      return {
        icon: <AlertCircle className="w-5 h-5 text-gray-500" />,
        text: 'Not Connected',
        color: 'text-gray-500',
        description: 'Connect to share models with other devices'
      };
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4">
          <h3 className="text-yellow-200 font-medium mb-2">Sign in Required</h3>
          <p className="text-sm text-yellow-300">
            Please sign in to access settings and manage your devices.
          </p>
        </div>
      </div>
    );
  }

  const connectionStatus = getConnectionStatusDisplay();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

      {/* Model Hosting - TOP PRIORITY */}
      <div className="bg-gray-800 rounded-lg p-6">
        <ModelHostingToggle />
      </div>

      {/* Ollama Management - SECOND PRIORITY */}
      <div className="bg-gray-800 rounded-lg p-6">
        <OllamaManager />
      </div>


      {/* Connection Status - Simplified View */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Globe className="w-5 h-5 mr-2" />
          Network Status
        </h2>
        
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {connectionStatus.icon}
              <div>
                <p className={`font-medium ${connectionStatus.color}`}>
                  {connectionStatus.text}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {connectionStatus.description}
                </p>
              </div>
            </div>
          </div>
          
          {/* Connected Devices - Only show if connected */}
          {p2pStatus.status === 'connected' && connectedPeers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-600">
              <p className="text-sm font-medium text-gray-300 mb-3">Connected Devices:</p>
              <div className="space-y-2">
                {connectedPeers.map(peer => (
                  <div key={peer.id} className="flex items-center space-x-3 text-sm">
                    <Monitor className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300">{peer.name}</span>
                    <Wifi className="w-3 h-3 text-green-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* macOS Specific Features - Collapsible */}
      {platform === 'darwin' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <button
            onClick={() => setShowMacModels(!showMacModels)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-xl font-semibold text-white flex items-center">
              {showMacModels ? <ChevronDown className="w-5 h-5 mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
              macOS AI Models
            </h2>
            <span className="text-sm text-gray-400">
              {showMacModels ? 'Hide' : 'Show'} Options
            </span>
          </button>
          
          {showMacModels && (
            <div className="mt-6 space-y-6">
              <AppleModelsSection />
              <div className="border-t border-gray-700 pt-6">
                <MacOSModels />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Settings - Collapsible */}
      <div className="bg-gray-800 rounded-lg p-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-left"
        >
          <h2 className="text-xl font-semibold text-white flex items-center">
            {showAdvanced ? <ChevronDown className="w-5 h-5 mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
            Advanced Settings
          </h2>
          <span className="text-sm text-gray-400">
            {showAdvanced ? 'Hide' : 'Show'} Details
          </span>
        </button>
        
        {showAdvanced && (
          <div className="mt-6 space-y-4">
            {/* P2P Details */}
            {p2pStatus.peerId && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Info className="w-4 h-4 mr-1" />
                  P2P Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Peer ID:</span>
                    <span className="text-gray-300 font-mono">
                      {p2pStatus.peerId.substring(0, 12)}...
                    </span>
                  </div>
                  {p2pStatus.serverUrl && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Server:</span>
                      <span className="text-gray-300 font-mono text-xs">
                        {p2pStatus.serverUrl}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* User Info */}
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                <Info className="w-4 h-4 mr-1" />
                Account Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Email:</span>
                  <span className="text-gray-300">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">User ID:</span>
                  <span className="text-gray-300 font-mono text-xs">
                    {user.uid.substring(0, 12)}...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-md ${
          message.includes('successfully')
            ? 'bg-green-900/50 border border-green-700 text-green-200' 
            : 'bg-red-900/50 border border-red-700 text-red-200'
        }`}>
          {message}
        </div>
      )}
      </div>
    </div>
  );
};

export default Settings;