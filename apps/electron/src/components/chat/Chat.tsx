import React, { useState } from 'react';
import { Menu, X, History } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChatWithPersistence } from '../../hooks/useChatWithPersistence';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessages } from './ChatMessages';
import { MessageInput } from './MessageInput';
import { ChatHistory } from './ChatHistory';
import { chatStorageService } from '../../services/chatStorageService';

interface ChatProps {
  userId: string;
}

export const Chat: React.FC<ChatProps> = () => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const {
    messages,
    inputMessage,
    selectedModel,
    models,
    devices,
    loading,
    isTyping,
    refreshing,
    currentChatId,
    conversations,
    setInputMessage,
    handleSendMessage,
    handleModelSelect,
    handleRefresh,
    handleDebugOllama,
    createNewChat,
    selectChat
  } = useChatWithPersistence(user?.uid || null);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };


  return (
    <div className="flex h-[calc(100vh-4rem)] sm:h-[calc(100vh-8rem)] bg-gray-900 relative">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-20 left-4 z-50 p-2 bg-gray-800 border border-gray-700 rounded-md text-gray-300 hover:text-white hover:bg-gray-700"
      >
        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      
      {/* Mobile History Toggle */}
      <button
        onClick={() => setIsHistoryOpen(!isHistoryOpen)}
        className="md:hidden fixed top-20 right-4 z-50 p-2 bg-gray-800 border border-gray-700 rounded-md text-gray-300 hover:text-white hover:bg-gray-700"
      >
        {isHistoryOpen ? <X className="w-5 h-5" /> : <History className="w-5 h-5" />}
      </button>

      {/* Mobile Overlays */}
      {(isSidebarOpen || isHistoryOpen) && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => {
            setIsSidebarOpen(false);
            setIsHistoryOpen(false);
          }}
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
          onDebugOllama={handleDebugOllama}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col md:ml-0">
        <ChatMessages
          messages={messages}
          models={models}
          devices={devices}
          isTyping={isTyping}
        />
        
        <MessageInput
          inputMessage={inputMessage}
          selectedModel={selectedModel}
          models={models}
          devices={devices}
          loading={loading}
          onInputChange={setInputMessage}
          onSendMessage={() => handleSendMessage(inputMessage)}
          onKeyPress={handleKeyPress}
        />
      </div>
      
      {/* Chat History Sidebar */}
      <div className={`${
        isHistoryOpen ? 'translate-x-0' : 'translate-x-full'
      } md:translate-x-0 fixed md:relative z-40 w-80 md:w-72 lg:w-80 bg-gray-800 border-l border-gray-700 flex flex-col transition-transform duration-300 ease-in-out h-full right-0`}>
        <ChatHistory
          currentChatId={currentChatId}
          conversations={conversations}
          onSelectChat={selectChat}
          onNewChat={createNewChat}
          onConversationsChange={async () => {
            const chats = await chatStorageService.getConversations();
            // This will trigger a re-render with updated conversations
            handleRefresh();
          }}
        />
      </div>
    </div>
  );
};

export default Chat;