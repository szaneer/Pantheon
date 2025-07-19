import React, { useState } from 'react';
import { Monitor, Globe, Wifi, WifiOff, ChevronDown, ChevronRight } from 'lucide-react';
import { LLMModel } from '../../types/api/models';
import { Device } from '../../services/deviceService';

interface DeviceModelSelectorProps {
  devices: Device[];
  models: LLMModel[];
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
  isWebVersion?: boolean;
}

interface DeviceWithModels {
  device: Device;
  models: LLMModel[];
  isLocal: boolean;
}

export const DeviceModelSelector: React.FC<DeviceModelSelectorProps> = ({
  devices,
  models,
  selectedModel,
  onModelSelect,
  isWebVersion = false
}) => {
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());

  // Group models by device
  const deviceGroups: DeviceWithModels[] = React.useMemo(() => {
    const groups: DeviceWithModels[] = [];
    
    // Add local device for non-web version
    if (!isWebVersion) {
      const localModels = models.filter(model => !model.isRemote);
      if (localModels.length > 0) {
        groups.push({
          device: {
            id: 'local',
            name: 'This Device',
            userId: '',
            endpoint: '',
            isOnline: true,
            lastSeen: new Date(),
            models: localModels.map(m => m.name),
            platform: 'local'
          },
          models: localModels,
          isLocal: true
        });
      }
    }
    
    // Add remote devices
    devices.forEach(device => {
      if (!device.isOnline) return; // Skip offline devices
      
      const deviceModels = models.filter(model => 
        model.isRemote && model.deviceId === device.id
      );
      
      if (deviceModels.length > 0) {
        groups.push({
          device,
          models: deviceModels,
          isLocal: false
        });
      }
    });
    
    return groups;
  }, [devices, models, isWebVersion]);

  const toggleDeviceExpansion = (deviceId: string) => {
    setExpandedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  };

  const getDeviceIcon = (deviceGroup: DeviceWithModels) => {
    if (deviceGroup.isLocal) {
      return <Monitor className="w-4 h-4 text-green-500" />;
    }
    return <Globe className="w-4 h-4 text-blue-500" />;
  };

  const getDeviceStatus = (deviceGroup: DeviceWithModels) => {
    if (deviceGroup.isLocal) {
      return null; // Local device is always available
    }
    
    return deviceGroup.device.isOnline ? (
      <Wifi className="w-3 h-3 text-green-500" />
    ) : (
      <WifiOff className="w-3 h-3 text-red-500" />
    );
  };

  const isModelDisabled = (model: LLMModel, deviceGroup: DeviceWithModels) => {
    if (deviceGroup.isLocal) {
      return false; // Local models are always available
    }
    return !deviceGroup.device.isOnline;
  };

  // Auto-expand devices that have the selected model
  React.useEffect(() => {
    const selectedModelObj = models.find(m => m.id === selectedModel);
    if (selectedModelObj) {
      const deviceId = selectedModelObj.isRemote ? selectedModelObj.deviceId : 'local';
      setExpandedDevices(prev => new Set([...prev, deviceId]));
    }
  }, [selectedModel, models]);

  if (deviceGroups.length === 0) {
    return (
      <div className="p-4">
        <p className="text-gray-400 text-sm">
          {isWebVersion 
            ? 'No remote devices available. Add remote devices in Settings to see models.' 
            : 'No models available. Check Ollama installation and device connections.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {deviceGroups.map(deviceGroup => {
        const isExpanded = expandedDevices.has(deviceGroup.device.id);
        const hasSelectedModel = deviceGroup.models.some(m => m.id === selectedModel);
        
        return (
          <div key={deviceGroup.device.id} className="border-b border-gray-700 last:border-b-0">
            {/* Device Header */}
            <div
              onClick={() => toggleDeviceExpansion(deviceGroup.device.id)}
              className="flex items-center p-3 cursor-pointer hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center flex-1 min-w-0">
                {getDeviceIcon(deviceGroup)}
                <div className="flex-1 min-w-0 ml-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {deviceGroup.device.name}
                    </p>
                    {getDeviceStatus(deviceGroup)}
                  </div>
                  <p className="text-xs text-gray-400">
                    {deviceGroup.models.length} model{deviceGroup.models.length !== 1 ? 's' : ''}
                    {!deviceGroup.isLocal && ` • ${deviceGroup.device.platform}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasSelectedModel && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Models List */}
            {isExpanded && (
              <div className="pb-2">
                {deviceGroup.models.map(model => (
                  <div
                    key={model.id}
                    onClick={() => {
                      if (!isModelDisabled(model, deviceGroup)) {
                        onModelSelect(model.id);
                      }
                    }}
                    className={`flex items-center px-6 py-2 cursor-pointer ${
                      selectedModel === model.id
                        ? 'bg-blue-600 text-white'
                        : isModelDisabled(model, deviceGroup)
                        ? 'text-gray-500 opacity-50 cursor-not-allowed'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{model.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {model.provider}
                        {model.isRemote && (
                          <span className="ml-1 text-blue-400">• Remote</span>
                        )}
                      </p>
                    </div>
                    {selectedModel === model.id && (
                      <div className="w-2 h-2 bg-white rounded-full ml-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};