import React from 'react';
import { RefreshCw } from 'lucide-react';
import { DeviceModelSelector } from './DeviceModelSelector';
import { LLMModel } from '../../types/api/models';
import { Device } from '../../services/deviceService';

interface ChatSidebarProps {
  devices: Device[];
  models: LLMModel[];
  selectedModel: string;
  refreshing: boolean;
  onModelSelect: (modelId: string) => void;
  onRefresh: () => void;
  onDebugOllama: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  devices,
  models,
  selectedModel,
  refreshing,
  onModelSelect,
  onRefresh,
  onDebugOllama
}) => {
  return (
    <>
      {/* Device and Model Selection */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-300">Available Devices</h3>
          <div className="flex gap-2">
            <button
              onClick={onDebugOllama}
              className="p-1 text-yellow-400 hover:text-yellow-300"
              title="Debug Ollama"
            >
              🔍
            </button>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-50"
              title="Refresh devices and models"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Device-based Model Selection */}
      <div className="flex-1 overflow-y-auto">
        <DeviceModelSelector
          devices={devices}
          models={models}
          selectedModel={selectedModel}
          onModelSelect={onModelSelect}
          isWebVersion={false}
        />
      </div>
    </>
  );
};