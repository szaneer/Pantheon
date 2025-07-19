import React, { useRef, useEffect, useState } from 'react';
import { Bot, User, Globe, Brain, Copy, Check } from 'lucide-react';
import { ChatMessage } from '../../types/api/chat';
import { LLMModel } from '../../types/api/models';
import { Device } from '../../services/deviceService';
import { parseMessageContent } from '../../utils/messageParser';

interface ChatMessagesProps {
  messages: ChatMessage[];
  models: LLMModel[];
  devices: Device[];
  isTyping: boolean;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  models,
  devices,
  isTyping
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const isModelDisabled = (model: LLMModel | undefined) => {
    if (!model) return true;
    if (model.isRemote) {
      const device = devices.find(d => d.id === model.deviceId);
      return !device || !device.isOnline;
    }
    return false;
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="text-center text-gray-400 mt-8">
          <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Start a conversation with your selected model</p>
          <p className="text-sm mt-2 text-gray-500">
            {models.length > 0 ? `${models.filter(m => !isModelDisabled(m)).length} models available` : 'Loading models...'}
          </p>
        </div>
      ) : (
        messages.map(message => {
          const parsedContent = parseMessageContent(message.content);
          
          return (
            <div key={message.id} className="space-y-2">
              {/* Thinking bubble (only for assistant messages with thinking content) */}
              {message.role === 'assistant' && parsedContent.thinking && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-gray-300">
                    <div className="flex items-start space-x-2">
                      <Brain className="w-4 h-4 mt-1 flex-shrink-0 text-purple-400" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-purple-400 mb-1">Thinking...</p>
                        <p className="text-sm whitespace-pre-wrap italic">{parsedContent.thinking}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Main message bubble */}
              {parsedContent.mainContent && (
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                  <div className="flex items-start space-x-2">
                    <div
                      className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-200'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.role === 'assistant' && (
                          <Bot className="w-4 h-4 mt-1 flex-shrink-0" />
                        )}
                        {message.role === 'user' && (
                          <User className="w-4 h-4 mt-1 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm whitespace-pre-wrap select-text">{parsedContent.mainContent}</p>
                          
                          <p className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Copy button */}
                    <button
                      onClick={() => copyToClipboard(parsedContent.mainContent, message.id)}
                      className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded hover:bg-gray-600 ${
                        message.role === 'user' ? 'text-blue-300 hover:text-blue-200' : 'text-gray-400 hover:text-gray-300'
                      }`}
                      title="Copy message"
                    >
                      {copiedMessageId === message.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
      
      {isTyping && (
        <div className="flex justify-start">
          <div className="bg-gray-700 text-gray-200 px-4 py-2 rounded-lg">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4" />
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};