import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Globe, 
  Wifi, 
  Shield, 
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface BrowserCapability {
  name: string;
  description: string;
  available: boolean;
  icon: React.ReactNode;
  details?: string;
}

interface SystemInfo {
  userAgent: string;
  platform: string;
  language: string;
  onLine: boolean;
  cookieEnabled: boolean;
  memory?: {
    jsHeapSizeLimit?: number;
    totalJSHeapSize?: number;
    usedJSHeapSize?: number;
  };
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
}

export const PlatformCapabilities: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [capabilities, setCapabilities] = useState<BrowserCapability[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    // Check browser capabilities
    const checkCapabilities = async () => {
      const caps: BrowserCapability[] = [];

      // WebRTC Support
      caps.push({
        name: 'WebRTC',
        description: 'Peer-to-peer communication',
        available: !!(window.RTCPeerConnection),
        icon: <Wifi className="w-4 h-4" />,
        details: 'Required for P2P model sharing'
      });

      // WebSocket Support
      caps.push({
        name: 'WebSocket',
        description: 'Real-time bidirectional communication',
        available: 'WebSocket' in window,
        icon: <Globe className="w-4 h-4" />,
        details: 'Required for signaling server connection'
      });

      // Service Worker Support
      caps.push({
        name: 'Service Worker',
        description: 'Offline caching and background sync',
        available: 'serviceWorker' in navigator,
        icon: <Shield className="w-4 h-4" />,
        details: 'Enables offline functionality'
      });

      // WebAssembly Support
      caps.push({
        name: 'WebAssembly',
        description: 'Near-native performance for compute',
        available: typeof WebAssembly === 'object',
        icon: <Zap className="w-4 h-4" />,
        details: 'Enables high-performance model inference'
      });

      // GPU Support (WebGL)
      caps.push({
        name: 'WebGL',
        description: 'Hardware-accelerated graphics',
        available: (() => {
          try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
              (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
          } catch(e) {
            return false;
          }
        })(),
        icon: <Cpu className="w-4 h-4" />,
        details: 'GPU acceleration for model inference'
      });

      // WebGPU Support (Future)
      caps.push({
        name: 'WebGPU',
        description: 'Next-gen GPU compute API',
        available: 'gpu' in navigator,
        icon: <Cpu className="w-4 h-4" />,
        details: 'Future support for advanced GPU compute'
      });

      // IndexedDB Support
      caps.push({
        name: 'IndexedDB',
        description: 'Large-scale client storage',
        available: 'indexedDB' in window,
        icon: <Shield className="w-4 h-4" />,
        details: 'For storing models and data locally'
      });

      // Notifications API
      caps.push({
        name: 'Notifications',
        description: 'Desktop notifications',
        available: 'Notification' in window,
        icon: <AlertCircle className="w-4 h-4" />,
        details: 'For model completion alerts'
      });

      setCapabilities(caps);

      // Gather system information
      const sysInfo: SystemInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        onLine: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled,
      };

      // Memory info (Chrome only)
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        sysInfo.memory = {
          jsHeapSizeLimit: memInfo.jsHeapSizeLimit,
          totalJSHeapSize: memInfo.totalJSHeapSize,
          usedJSHeapSize: memInfo.usedJSHeapSize
        };
      }

      // Connection info
      if ('connection' in navigator) {
        const conn = (navigator as any).connection;
        sysInfo.connection = {
          effectiveType: conn.effectiveType,
          downlink: conn.downlink,
          rtt: conn.rtt
        };
      }

      setSystemInfo(sysInfo);
    };

    checkCapabilities();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCapabilityColor = (available: boolean) => {
    return available ? 'text-green-500' : 'text-gray-500';
  };

  const availableCount = capabilities.filter(c => c.available).length;
  const totalCount = capabilities.length;

  return (
    <div className="bg-gray-800 rounded-lg">
      <div
        className="p-4 cursor-pointer hover:bg-gray-700 transition-colors flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold">Platform Capabilities</h3>
          <span className="text-sm text-gray-400">
            {availableCount}/{totalCount} features available
          </span>
        </div>
        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Browser Capabilities */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Browser Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {capabilities.map((cap) => (
                <div key={cap.name} className="bg-gray-900 rounded p-3">
                  <div className="flex items-start gap-2">
                    <div className={getCapabilityColor(cap.available)}>
                      {cap.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{cap.name}</span>
                        {cap.available ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <XCircle className="w-3 h-3 text-gray-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{cap.description}</p>
                      {cap.details && (
                        <p className="text-xs text-gray-500 mt-1">{cap.details}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Information */}
          {systemInfo && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">System Information</h4>
              <div className="bg-gray-900 rounded p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Platform:</span>
                    <p className="text-gray-300">{systemInfo.platform}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Language:</span>
                    <p className="text-gray-300">{systemInfo.language}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Online:</span>
                    <p className="text-gray-300">{systemInfo.onLine ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Cookies:</span>
                    <p className="text-gray-300">{systemInfo.cookieEnabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>

                {systemInfo.memory && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-2">Memory Usage</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Heap Limit:</span>
                        <span className="text-gray-300">
                          {formatBytes(systemInfo.memory.jsHeapSizeLimit || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Heap:</span>
                        <span className="text-gray-300">
                          {formatBytes(systemInfo.memory.totalJSHeapSize || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Used Heap:</span>
                        <span className="text-gray-300">
                          {formatBytes(systemInfo.memory.usedJSHeapSize || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {systemInfo.connection && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-2">Network Information</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Connection Type:</span>
                        <span className="text-gray-300">
                          {systemInfo.connection.effectiveType || 'Unknown'}
                        </span>
                      </div>
                      {systemInfo.connection.downlink && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Downlink:</span>
                          <span className="text-gray-300">
                            {systemInfo.connection.downlink} Mbps
                          </span>
                        </div>
                      )}
                      {systemInfo.connection.rtt && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">RTT:</span>
                          <span className="text-gray-300">
                            {systemInfo.connection.rtt} ms
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Browser Compatibility Notice */}
          <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-300 font-medium">Browser Compatibility</p>
                <p className="text-blue-400 text-xs mt-1">
                  For best performance, use a modern browser like Chrome, Edge, or Firefox. 
                  Some features may require specific browser support or flags.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};