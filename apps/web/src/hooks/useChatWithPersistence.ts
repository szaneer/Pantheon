import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types/api/chat';
import { LLMModel } from '../types/api/models';
import { Device, deviceService } from '../services/deviceService';
import { llmService } from '../services/llmService';
import { chatStorageService, ChatConversation } from '../services/chatStorageService';

export const useChatWithPersistence = (userId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [models, setModels] = useState<LLMModel[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  
  // Track if we're in the middle of saving to prevent loops
  const savingRef = useRef(false);

  const loadPersistedSelectedModel = async () => {
    try {
      let persistedModel = '';
      
      persistedModel = localStorage.getItem('selectedModel') || '';
      
      if (persistedModel) {
        setSelectedModel(persistedModel);
      }
    } catch (error) {
      console.warn('Failed to load persisted selected model:', error);
    }
  };

  const saveSelectedModel = async (modelId: string) => {
    try {
      localStorage.setItem('selectedModel', modelId);
    } catch (error) {
      console.warn('Failed to save selected model:', error);
    }
  };

  const loadModels = async () => {
    try {
      const availableModels = await llmService.getAllModels();
      setModels(availableModels);
      
      const selectedModelExists = selectedModel && availableModels.some(model => model.id === selectedModel);
      
      if (!selectedModelExists && availableModels.length > 0) {
        const newSelectedModel = availableModels[0].id;
        setSelectedModel(newSelectedModel);
        await saveSelectedModel(newSelectedModel);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const loadDevices = async () => {
    if (!userId) return;
    
    try {
      const userDevices = await deviceService.getDevicesForUser(userId);
      setDevices(userDevices);
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  const loadConversations = async () => {
    const chats = await chatStorageService.getConversations();
    setConversations(chats);
  };

  const loadOrCreateChat = async () => {
    // Try to load the current chat
    const savedChatId = await chatStorageService.getCurrentChatId();
    
    if (savedChatId) {
      const chat = await chatStorageService.getConversation(savedChatId);
      if (chat) {
        setCurrentChatId(chat.id);
        setMessages(chat.messages);
        if (chat.modelId) {
          setSelectedModel(chat.modelId);
        }
        return;
      }
    }
    
    // No valid current chat, create a new one
    await createNewChat();
  };

  const createNewChat = async () => {
    const newChat = await chatStorageService.createConversation('New Chat', selectedModel);
    setCurrentChatId(newChat.id);
    setMessages([]);
    await loadConversations();
  };

  const selectChat = async (chatId: string) => {
    const chat = await chatStorageService.getConversation(chatId);
    if (chat) {
      setCurrentChatId(chat.id);
      setMessages(chat.messages);
      if (chat.modelId) {
        setSelectedModel(chat.modelId);
        await saveSelectedModel(chat.modelId);
      }
      await chatStorageService.setCurrentChatId(chat.id);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDevices();
      await loadModels();
    } finally {
      setRefreshing(false);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);
    await saveSelectedModel(modelId);
    
    // Update current chat's model
    if (currentChatId) {
      await chatStorageService.updateConversation(currentChatId, { modelId });
    }
  };

  const handleSendMessage = async (messageOverride?: string) => {
    const messageContent = messageOverride || inputMessage;
    if (!messageContent.trim() || !selectedModel || loading) return;

    // Ensure we have a current chat
    if (!currentChatId) {
      await createNewChat();
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      modelId: selectedModel
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    setIsTyping(true);

    try {
      const response = await llmService.chat(selectedModel, [...messages, userMessage]);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        modelId: selectedModel
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Save both messages to storage
      if (currentChatId && !savingRef.current) {
        savingRef.current = true;
        await chatStorageService.addMessages(currentChatId, [userMessage, assistantMessage]);
        await loadConversations(); // Refresh conversation list
        savingRef.current = false;
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
        modelId: selectedModel
      };

      setMessages(prev => [...prev, errorMessage]);
      
      // Save error message too
      if (currentChatId && !savingRef.current) {
        savingRef.current = true;
        await chatStorageService.addMessages(currentChatId, [userMessage, errorMessage]);
        await loadConversations();
        savingRef.current = false;
      }
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const handleDebugOllama = async () => {
    try {
      const isDev = window.location.port === '3000' || window.location.hostname === 'localhost';
      const ollamaUrl = isDev ? '/api/ollama/api/tags' : 'http://127.0.0.1:11434/api/tags';
      
      const response = await fetch(ollamaUrl);
      const data = await response.json();
      
      const models = await llmService.getAllModels();
      
      alert(`Ollama models: ${data.models?.length || 0}\nTotal models: ${models.length}`);
    } catch (error) {
      console.error('Ollama debug failed:', error);
      alert('Ollama connection failed. Make sure Ollama is running.');
    }
  };

  useEffect(() => {
    if (userId) {
      llmService.setCurrentUserId(userId);
      deviceService.setCurrentUserId(userId);
      
      loadPersistedSelectedModel();
      loadModels();
      loadDevices();
      loadConversations();
      loadOrCreateChat();
      
      const unsubscribeDevices = deviceService.onDevicesChange(userId, (updatedDevices) => {
        setDevices(updatedDevices);
        loadModels();
      });

      // Web app doesn't have P2P status listeners

      return () => {
        unsubscribeDevices();
      };
    }
  }, [userId]);

  return {
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
  };
};