import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Clock, 
  Search,
  MoreVertical,
  Edit2
} from 'lucide-react';
import { ChatConversation, chatStorageService } from '../../services/chatStorageService';

interface ChatHistoryProps {
  currentChatId: string | null;
  conversations: ChatConversation[];
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onConversationsChange: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  currentChatId,
  conversations,
  onSelectChat,
  onNewChat,
  onConversationsChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chat?')) {
      await chatStorageService.deleteConversation(chatId);
      onConversationsChange();
      
      // If we deleted the current chat, create a new one
      if (chatId === currentChatId) {
        onNewChat();
      }
    }
  };

  const handleRenameChat = async (chatId: string, newTitle: string) => {
    if (newTitle.trim()) {
      await chatStorageService.updateConversation(chatId, { title: newTitle.trim() });
      onConversationsChange();
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const startEditing = (chatId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(chatId);
    setEditingTitle(currentTitle);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.messages.some(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? 'Just now' : `${minutes}m ago`;
      }
      return `${hours}h ago`;
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Chat History</h2>
          <button
            onClick={onNewChat}
            className="p-2 hover:bg-gray-700 rounded-md transition-colors"
            title="New Chat"
          >
            <Plus className="w-5 h-5 text-gray-300" />
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelectChat(conv.id)}
                className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                  currentChatId === conv.id
                    ? 'bg-blue-600 bg-opacity-20 border border-blue-500'
                    : 'hover:bg-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <MessageSquare className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {editingId === conv.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleRenameChat(conv.id, editingTitle)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameChat(conv.id, editingTitle);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                          autoFocus
                        />
                      ) : (
                        <>
                          <h3 className="font-medium text-white truncate">
                            {conv.title}
                          </h3>
                          {conv.messages.length > 0 && (
                            <p className="text-sm text-gray-400 truncate mt-1">
                              {conv.messages[conv.messages.length - 1].content}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      {formatDate(conv.updatedAt)}
                    </span>
                    
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                      <button
                        onClick={(e) => startEditing(conv.id, conv.title, e)}
                        className="p-1 hover:bg-gray-600 rounded"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteChat(conv.id, e)}
                        className="p-1 hover:bg-gray-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {conv.messages.length > 0 && (
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>{conv.messages.length} messages</span>
                    {conv.modelId && (
                      <span className="truncate">{conv.modelId}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onNewChat}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>
    </div>
  );
};