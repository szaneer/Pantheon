import React, { useState, useEffect } from 'react';
import { Menu, X, Globe, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebChat } from '../hooks/useWebChat';
import { ChatSidebar } from './chat/ChatSidebar';
import { ChatMessages } from './chat/ChatMessages';
import { MessageInput } from './chat/MessageInput';

export const WebChat: React.FC = () => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showMixedContentWarning, setShowMixedContentWarning] = useState(false);
  
  const {
    messages,
    inputMessage,
    selectedModel,
    models,
    devices,
    loading,
    isTyping,
    refreshing,
    setInputMessage,
    handleSendMessage,
    handleModelSelect,
    handleRefresh
  } = useWebChat(user?.uid || null);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Check for mixed content issues
  useEffect(() => {
    const isHttps = window.location.protocol === 'https:';
    const hasHttpDevices = devices.some(device => 
      device.endpoint.startsWith('http:') && !device.tunnelUrl
    );
    
    setShowMixedContentWarning(isHttps && hasHttpDevices);
  }, [devices]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Mixed Content Warning */}
      {showMixedContentWarning && (
        <div className="bg-orange-600 text-white px-4 py-2 text-sm text-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Some HTTP devices may not be accessible from HTTPS. Use tunnel URLs or access via HTTP for full compatibility.
        </div>
      )}
      
      <div className="flex flex-1 relative overflow-hidden">

        {/* Mobile Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden absolute top-4 left-4 z-50 p-2 bg-gray-800 border border-gray-700 rounded-md text-gray-300 hover:text-white hover:bg-gray-700"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-40 w-80 md:w-72 lg:w-80 bg-gray-800 border-r border-gray-700 flex flex-col transition-transform duration-300 ease-in-out h-full`}>
        <ChatSidebar
          devices={devices}
          models={models}
          selectedModel={selectedModel}
          refreshing={refreshing}
          onModelSelect={handleModelSelect}
          onRefresh={handleRefresh}
          onDebugOllama={() => {}} // Not applicable for web version
          isWebVersion={true}
        />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
        <ChatMessages
          messages={messages}
          models={models}
          devices={devices}
          isTyping={isTyping}
        />
        
        <MessageInput
          inputMessage={inputMessage}
          selectedModel={selectedModel?.id || ''}
          models={models}
          devices={devices}
          loading={loading}
          onInputChange={setInputMessage}
          onSendMessage={handleSendMessage}
          onKeyPress={handleKeyPress}
        />
        </div>
      </div>
    </div>
  );
};

export default WebChat;