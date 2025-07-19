import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import p2pClientServiceV2, { P2PStatus } from '../services/p2pClientServiceV2';
import { Globe, CheckCircle, XCircle, Clock, AlertCircle, Users, Monitor, Wifi, ChevronDown, ChevronRight, Info, RefreshCw } from 'lucide-react';
import { webDeviceService } from '../services/webDeviceService';
import { handleAuthError } from '../utils/authErrorHandler';

interface ConnectedDevice {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeen?: Date;
  modelCount?: number;
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // P2P state
  const [p2pStatus, setP2pStatus] = useState<P2PStatus>({
    status: 'disconnected',
    connected: false,
    serverUrl: ''
  });
  const [p2pLoading, setP2pLoading] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (user) {
      // Set user ID in P2P service and try to get auth token
      const setP2PUser = async () => {
        try {
          // Try to get Firebase auth token for P2P authentication
          const token = await user.getIdToken();
          await p2pClientServiceV2.initialize(user.uid, token);
        } catch (error) {
          console.error('Failed to initialize P2P service:', error);
          await handleAuthError(error);
        }
      };
      setP2PUser();
      
      // Load connected devices
      loadConnectedDevices();
    }
  }, [user]);

  // Initialize P2P status listener
  useEffect(() => {
    const removeListener = p2pClientServiceV2.on('status', (status) => {
      setP2pStatus(status);
    });

    // Get initial status
    setP2pStatus(p2pClientServiceV2.getStatus());

    return removeListener;
  }, []);
  
  // Load connected devices
  const loadConnectedDevices = async () => {
    try {
      // Get devices from Firebase
      const devices = await webDeviceService.getDevicesForUser(user!.uid);
      
      // Get P2P peers if connected
      let p2pDevices: ConnectedDevice[] = [];
      if (p2pStatus.status === 'connected') {
        try {
          // Get all available models from connected peers
          const allPeerModels = p2pClientServiceV2.getAllAvailableModels();
          
          // Convert to device list
          p2pDevices = Object.entries(allPeerModels).map(([peerId, models]) => ({
            id: peerId,
            name: `P2P Device (${peerId.substring(0, 8)}...)`,
            isOnline: true,
            modelCount: models.length
          }));
        } catch (error) {
          console.error('Failed to get P2P peers:', error);
        }
      }
      
      // Combine and deduplicate devices
      const allDevices = [...devices.map(d => ({
        id: d.id,
        name: d.name,
        isOnline: d.isOnline,
        lastSeen: d.lastSeen,
        modelCount: 0
      })), ...p2pDevices];
      
      // Remove duplicates by ID
      const uniqueDevices = Array.from(new Map(allDevices.map(d => [d.id, d])).values());
      setConnectedDevices(uniqueDevices);
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  // P2P functions
  const handleP2PConnect = async () => {
    setP2pLoading(true);
    setMessage('');
    try {
      await p2pClientServiceV2.connect();
      setMessage('Successfully connected! Looking for devices...');
      // Reload devices after connection
      setTimeout(loadConnectedDevices, 1000);
    } catch (error) {
      console.error('P2P connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      if (errorMessage.includes('Network')) {
        setMessage('Network error - please check your internet connection');
      } else if (errorMessage.includes('Auth')) {
        setMessage('Authentication error - please sign out and sign back in');
      } else {
        setMessage('Unable to connect - please try again later');
      }
    } finally {
      setP2pLoading(false);
    }
  };

  const handleP2PDisconnect = () => {
    setP2pLoading(true);
    try {
      p2pClientServiceV2.disconnect();
      setMessage('Disconnected from network');
      setConnectedDevices([]);
    } catch (error) {
      console.error('P2P disconnection failed:', error);
      setMessage('Disconnection failed');
    } finally {
      setP2pLoading(false);
    }
  };
  
  const handleRefreshDevices = async () => {
    setLoading(true);
    setMessage('');
    try {
      await loadConnectedDevices();
      // Also trigger P2P discovery
      if (p2pStatus.status === 'connected') {
        await p2pClientServiceV2.discoverPeers();
      }
      setMessage('Devices refreshed successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to refresh devices');
    } finally {
      setLoading(false);
    }
  };

  // Get connection status display
  const getConnectionStatusDisplay = () => {
    const onlineDevices = connectedDevices.filter(d => d.isOnline).length;
    
    if (p2pStatus.status === 'connected') {
      return {
        icon: <CheckCircle className="w-6 h-6 text-green-500" />,
        title: 'Connected',
        subtitle: onlineDevices > 0 
          ? `${onlineDevices} device${onlineDevices !== 1 ? 's' : ''} available`
          : 'Looking for devices...',
        color: 'text-green-500'
      };
    } else if (p2pStatus.status === 'connecting') {
      return {
        icon: <Clock className="w-6 h-6 text-yellow-500 animate-pulse" />,
        title: 'Connecting',
        subtitle: 'Establishing connection...',
        color: 'text-yellow-500'
      };
    } else if (p2pStatus.status === 'error') {
      return {
        icon: <XCircle className="w-6 h-6 text-red-500" />,
        title: 'Connection Error',
        subtitle: 'Unable to connect to network',
        color: 'text-red-500'
      };
    } else {
      return {
        icon: <AlertCircle className="w-6 h-6 text-gray-500" />,
        title: 'Not Connected',
        subtitle: 'Connect to access AI models from other devices',
        color: 'text-gray-500'
      };
    }
  };

  const connectionStatus = getConnectionStatusDisplay();

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">Settings</h1>

      {/* Connection Status - Main Focus */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Globe className="w-5 h-5 mr-2" />
          Network Connection
        </h2>
        
        <div className="bg-gray-700/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              {connectionStatus.icon}
              <div>
                <p className={`text-lg font-medium ${connectionStatus.color}`}>
                  {connectionStatus.title}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {connectionStatus.subtitle}
                </p>
              </div>
            </div>
            
            {/* Connection Button */}
            {p2pStatus.status === 'connected' ? (
              <button
                onClick={handleP2PDisconnect}
                disabled={p2pLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {p2pLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            ) : (
              <button
                onClick={handleP2PConnect}
                disabled={p2pLoading || p2pStatus.status === 'connecting'}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {p2pLoading || p2pStatus.status === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
          
          {/* Connected Devices */}
          {p2pStatus.status === 'connected' && (
            <div className="border-t border-gray-600 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-300">Available Devices</p>
                <button
                  onClick={handleRefreshDevices}
                  disabled={loading}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center space-x-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
              
              {connectedDevices.length > 0 ? (
                <div className="space-y-2">
                  {connectedDevices.filter(d => d.isOnline).map(device => (
                    <div key={device.id} className="flex items-center justify-between py-2 px-3 bg-gray-600/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Monitor className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-200">{device.name}</p>
                          {device.modelCount && device.modelCount > 0 && (
                            <p className="text-xs text-gray-400">
                              {device.modelCount} model{device.modelCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <Wifi className="w-4 h-4 text-green-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  No devices found. Make sure other devices are running Pantheon with hosting enabled.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Web Client Info */}
      <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-blue-200 font-medium mb-1">Web Client</h3>
            <p className="text-blue-300 text-sm">
              You're using the web version of Pantheon. You can access AI models hosted on other devices, 
              but cannot host models yourself. To host models, download the desktop app.
            </p>
          </div>
        </div>
      </div>


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
            {/* Connection Details */}
            {p2pStatus.status === 'connected' && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Connection Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Server URL:</span>
                    <span className="text-gray-300 font-mono text-xs">
                      {p2pStatus.serverUrl}
                    </span>
                  </div>
                  {p2pStatus.peerId && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Client ID:</span>
                      <span className="text-gray-300 font-mono text-xs">
                        {p2pStatus.peerId.substring(0, 12)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Account Info */}
            {user && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Account Info</h3>
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
            )}
            
            {/* App Version */}
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">App Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Version:</span>
                  <span className="text-gray-300">1.0.0 (Web)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Platform:</span>
                  <span className="text-gray-300">Web Browser</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg flex items-start space-x-3 ${
          message.includes('success') || message.includes('Successfully') || message.includes('Connected')
            ? 'bg-green-900/50 border border-green-700' 
            : message.includes('error') || message.includes('failed') || message.includes('Unable')
            ? 'bg-red-900/50 border border-red-700'
            : 'bg-blue-900/50 border border-blue-700'
        }`}>
          {message.includes('success') || message.includes('Successfully') || message.includes('Connected') ? (
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          ) : message.includes('error') || message.includes('failed') || message.includes('Unable') ? (
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${
            message.includes('success') || message.includes('Successfully') || message.includes('Connected')
              ? 'text-green-200'
              : message.includes('error') || message.includes('failed') || message.includes('Unable')
              ? 'text-red-200'
              : 'text-blue-200'
          }`}>
            {message}
          </p>
        </div>
      )}
    </div>
  );
};

export default Settings;