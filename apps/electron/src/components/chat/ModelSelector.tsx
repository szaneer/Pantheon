import React from 'react';
import { Monitor, Globe, Wifi, WifiOff } from 'lucide-react';
import { LLMModel } from '../../types/api/models';
import { Device } from '../../services/deviceService';

interface ModelSelectorProps {
  models: LLMModel[];
  devices: Device[];
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  models, 
  devices, 
  selectedModel, 
  onModelSelect 
}) => {
  const getModelIcon = (model: LLMModel) => {
    if (model.isRemote) {
      return <Globe className="w-4 h-4 text-blue-500" />;
    }
    return <Monitor className="w-4 h-4 text-green-500" />;
  };

  const getModelStatus = (model: LLMModel) => {
    if (model.isRemote) {
      const device = devices.find(d => d.id === model.deviceId);
      if (device) {
        return device.isOnline ? (
          <Wifi className="w-3 h-3 text-green-500" />
        ) : (
          <WifiOff className="w-3 h-3 text-red-500" />
        );
      }
    }
    return null;
  };

  const isModelDisabled = (model: LLMModel) => {
    if (model.isRemote) {
      const device = devices.find(d => d.id === model.deviceId);
      return !device || !device.isOnline;
    }
    return false;
  };

  return (
    <div className="space-y-2">
      {models.length === 0 ? (
        <p className="text-gray-400 text-sm">No models available. Check device connections.</p>
      ) : (
        models.map(model => (
          <div
            key={model.id}
            onClick={() => {
              if (!isModelDisabled(model)) {
                onModelSelect(model.id);
              }
            }}
            className={`flex items-center p-2 rounded-md cursor-pointer ${
              selectedModel === model.id
                ? 'bg-blue-600 text-white'
                : isModelDisabled(model)
                ? 'text-gray-500 opacity-50 cursor-not-allowed'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {getModelIcon(model)}
            <div className="flex-1 min-w-0 ml-2">
              <p className="text-sm font-medium truncate">{model.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {model.provider} • {model.deviceName}
              </p>
              {model.isRemote && (
                <div className="flex items-center gap-1 mt-1">
                  {getModelStatus(model)}
                  <span className="text-xs text-blue-400">
                    Remote Chat Available
                  </span>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};