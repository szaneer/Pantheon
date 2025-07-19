import React from 'react';
import { Send, Wifi, WifiOff } from 'lucide-react';
import { LLMModel } from '../../types/api/models';
import { Device } from '../../services/deviceService';

interface MessageInputProps {
  inputMessage: string;
  selectedModel: string;
  models: LLMModel[];
  devices: Device[];
  loading: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  inputMessage,
  selectedModel,
  models,
  devices,
  loading,
  onInputChange,
  onSendMessage,
  onKeyPress
}) => {
  const isModelDisabled = (model: LLMModel | undefined) => {
    if (!model) return true;
    if (model.isRemote) {
      const device = devices.find(d => d.id === model.deviceId);
      return !device || !device.isOnline;
    }
    return false;
  };

  const getModelStatus = (model: LLMModel | undefined) => {
    if (!model || !model.isRemote) return null;
    
    const device = devices.find(d => d.id === model.deviceId);
    if (device) {
      return device.isOnline ? (
        <Wifi className="w-3 h-3 text-green-500" />
      ) : (
        <WifiOff className="w-3 h-3 text-red-500" />
      );
    }
    return null;
  };

  const selectedModelObj = models.find(m => m.id === selectedModel);
  const isDisabled = !selectedModel || loading || isModelDisabled(selectedModelObj);

  return (
    <div className="border-t border-gray-700">
      <div className="p-2 sm:p-4">
        <div className="flex space-x-2 sm:space-x-4">
          <div className="flex-1">
          <textarea
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder="Type your message..."
            disabled={isDisabled}
            className="w-full px-2 sm:px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50 text-sm sm:text-base"
            rows={1}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          </div>
          <button
            onClick={onSendMessage}
            disabled={!inputMessage.trim() || isDisabled}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      
        {selectedModel && selectedModelObj && (
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-2 overflow-hidden">
          <span className="truncate">
            Using: {selectedModelObj.name} on {selectedModelObj.deviceName}
          </span>
          {selectedModelObj.provider === 'Remote Device' && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {getModelStatus(selectedModelObj)}
              <span className="text-blue-400 hidden sm:inline">Remote Chat</span>
              </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
};