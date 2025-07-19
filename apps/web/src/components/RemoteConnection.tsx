import React, { useState, useEffect } from 'react';
import { apiRemoteService, RemoteDevice } from '../services/apiRemoteService';
import { tunnelAuthService } from '../services/tunnelAuthService';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Server, Key, Globe, AlertCircle, CheckCircle, Loader2, Shield } from 'lucide-react';

interface RemoteConnectionProps {
  onDevicesChange?: (devices: RemoteDevice[]) => void;
}

export const RemoteConnection: React.FC<RemoteConnectionProps> = ({ onDevicesChange }) => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [authStatuses, setAuthStatuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    const connectedDevices = apiRemoteService.getDevices();
    setDevices(connectedDevices);
    onDevicesChange?.(connectedDevices);
    
    // Check authentication status for each device
    if (user) {
      await checkAuthStatuses(connectedDevices);
    }
  };

  const checkAuthStatuses = async (deviceList: RemoteDevice[]) => {
    if (!user) return;
    
    const statuses: Record<string, boolean> = {};
    
    for (const device of deviceList) {
      try {
        const deviceId = tunnelAuthService.getDeviceIdFromEndpoint(device.endpoint);
        const isAuthenticated = await tunnelAuthService.validateStoredAuth(
          device.endpoint, 
          user.uid, 
          deviceId
        );
        statuses[device.id] = isAuthenticated;
      } catch (error) {
        console.error('Failed to check auth status for device:', device.id, error);
        statuses[device.id] = false;
      }
    }
    
    setAuthStatuses(statuses);
  };

  const handleAddDevice = async () => {
    if (!tunnelUrl.trim() || !apiKey.trim()) {
      setMessage('❌ Please enter both tunnel URL and API key');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const device = await apiRemoteService.connectToTunnelUrl(
        tunnelUrl.trim(),
        apiKey.trim(),
        deviceName.trim() || undefined
      );

      setMessage('✅ Device connected successfully!');
      
      // Reset form
      setTunnelUrl('');
      setApiKey('');
      setDeviceName('');
      setShowAddForm(false);
      
      // Reload devices
      loadDevices();
      
    } catch (error) {
      console.error('Failed to add device:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      
      // Check if it's a 511 auth error and provide helpful guidance
      if (errorMessage.includes('browser authentication')) {
        setMessage(`⚠️ ${errorMessage}`);
        // Auto-open the tunnel URL to help with authentication
        try {
          let endpoint = tunnelUrl.trim();
          if (endpoint.endsWith('/')) {
            endpoint = endpoint.slice(0, -1);
          }
          if (endpoint.includes('loca.lt') && !endpoint.startsWith('https://')) {
            endpoint = endpoint.replace('http://', 'https://');
          }
          window.open(endpoint, '_blank');
        } catch (e) {
          console.error('Failed to open tunnel URL:', e);
        }
      } else {
        setMessage(`❌ ${errorMessage}`);
      }
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleTestConnection = async () => {
    if (!tunnelUrl.trim() || !apiKey.trim()) {
      setMessage('❌ Please enter both tunnel URL and API key');
      return;
    }

    setTestingConnection(true);
    setMessage('');

    try {
      let endpoint = tunnelUrl.trim();
      if (endpoint.endsWith('/')) {
        endpoint = endpoint.slice(0, -1);
      }
      
      // Ensure HTTPS for tunnel URLs
      if (endpoint.includes('loca.lt') && !endpoint.startsWith('https://')) {
        endpoint = endpoint.replace('http://', 'https://');
      }

      const testResult = await apiRemoteService.testApiKey(endpoint, apiKey.trim());
      
      if (testResult.success) {
        setMessage('✅ Connection test successful!');
      } else if (testResult.needsAuth) {
        setMessage(`⚠️ ${testResult.error}`);
        // Auto-open the tunnel URL in a new tab to help with authentication
        window.open(endpoint, '_blank');
      } else {
        setMessage(`❌ ${testResult.error}`);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setMessage('❌ Connection test failed - check URL and API key');
    } finally {
      setTestingConnection(false);
      setTimeout(() => setMessage(''), 8000); // Longer timeout for auth messages
    }
  };

  const handleRemoveDevice = (deviceId: string) => {
    apiRemoteService.removeDevice(deviceId);
    loadDevices();
    setMessage('✅ Device removed');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleClearApiKey = () => {
    apiRemoteService.clearApiKey();
    setDevices([]);
    onDevicesChange?.([]);
    setMessage('✅ All devices disconnected');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Remote Devices</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Device
          </button>
          {devices.length > 0 && (
            <button
              onClick={handleClearApiKey}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.includes('❌') ? 'bg-red-900 border border-red-700' :
          'bg-green-900 border border-green-700'
        }`}>
          <p className="text-white">{message}</p>
        </div>
      )}

      {/* Add Device Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Connect to Remote Device</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Server URL *
              </label>
              <input
                type="url"
                value={tunnelUrl}
                onChange={(e) => setTunnelUrl(e.target.value)}
                placeholder="https://your-domain.com or http://192.168.1.100:8080"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400"
                disabled={loading}
              />
              <p className="text-xs text-gray-400 mt-1">
                The public URL or local network address of the hosting device
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key *
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pk_..."
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 font-mono"
                disabled={loading}
              />
              <p className="text-xs text-gray-400 mt-1">
                The API key from the hosting device settings
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Device Name (optional)
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="My Remote Device"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400"
                disabled={loading}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTestConnection}
                disabled={loading || testingConnection || !tunnelUrl.trim() || !apiKey.trim()}
                className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </button>

              <button
                onClick={handleAddDevice}
                disabled={loading || !tunnelUrl.trim() || !apiKey.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Connect
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setShowAddForm(false)}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-md transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Connected Devices */}
      {devices.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Connected Devices</h3>
          {devices.map((device) => (
            <div key={device.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {device.isOnline ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <Server className="w-5 h-5 text-blue-500" />
                    {authStatuses[device.id] && (
                      <Shield className="w-4 h-4 text-green-500" title="Tunnel authenticated automatically" />
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-white">{device.name}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {new URL(device.endpoint).hostname}
                      </span>
                      <span>{device.models.length} models</span>
                      <span className={device.isOnline ? 'text-green-400' : 'text-red-400'}>
                        {device.isOnline ? 'Online' : 'Offline'}
                      </span>
                      {authStatuses[device.id] && (
                        <span className="text-green-400 flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Auto-authenticated
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveDevice(device.id)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900 rounded-md transition-colors"
                  title="Remove device"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Models List */}
              {device.models.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-sm text-gray-400 mb-2">Available Models:</p>
                  <div className="flex flex-wrap gap-2">
                    {device.models.map((model) => (
                      <span
                        key={model}
                        className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !showAddForm && (
        <div className="text-center py-12">
          <Server className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Remote Devices</h3>
          <p className="text-gray-400 mb-6">
            Connect to devices that are hosting models to access them remotely.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition-colors flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Add Your First Device
          </button>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-500" />
          How to Connect
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>1. Start hosting on your main device (desktop app)</p>
          <p>2. Copy the server URL and API key from the hosting settings</p>
          <p>3. Enter them here to connect and access remote models</p>
          <p>4. Authentication is handled automatically using your account</p>
          <p>5. Once connected, models will appear in the sidebar for chat</p>
        </div>
      </div>

      {/* Troubleshooting Section */}
      <div className="bg-yellow-900 rounded-lg p-6 border border-yellow-700">
        <h3 className="text-lg font-semibold text-yellow-200 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          Troubleshooting Connections
        </h3>
        <div className="space-y-3 text-sm text-yellow-100">
          <div>
            <p className="font-medium text-yellow-200">For domain-based connections (HTTPS):</p>
            <div className="mt-1 pl-4 space-y-1">
              <p>• Ensure your domain points to the hosting device</p>
              <p>• Use the full domain URL (https://yourdomain.com)</p>
              <p>• Certificate setup is automatic with Caddy</p>
            </div>
          </div>
          <div>
            <p className="font-medium text-yellow-200">For local network connections:</p>
            <div className="mt-1 pl-4 space-y-1">
              <p>• Use the local IP address and port (http://192.168.1.100:8080)</p>
              <p>• Ensure both devices are on the same network</p>
              <p>• Check that the hosting device firewall allows connections</p>
            </div>
          </div>
          <div>
            <p className="font-medium text-yellow-200">If connection still fails:</p>
            <div className="mt-1 pl-4 space-y-1">
              <p>• Ensure the hosting device is online</p>
              <p>• Verify the API key matches exactly</p>
              <p>• Try restarting hosting on the main device</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};