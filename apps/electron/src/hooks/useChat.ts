import { useState, useEffect } from 'react';
import { ChatMessage } from '../types/api/chat';
import { LLMModel } from '../types/api/models';
import { Device, deviceService } from '../services/deviceService';
import { llmService } from '../services/llmService';

export const useChat = (userId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [models, setModels] = useState<LLMModel[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPersistedSelectedModel = async () => {
    try {
      let persistedModel = '';
      
      if (window.electronAPI) {
        persistedModel = await window.electronAPI.getStoreValue('selectedModel') || '';
      } else {
        persistedModel = localStorage.getItem('selectedModel') || '';
      }
      
      if (persistedModel) {
        setSelectedModel(persistedModel);
      }
    } catch (error) {
      console.warn('Failed to load persisted selected model:', error);
    }
  };

  const saveSelectedModel = async (modelId: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.setStoreValue('selectedModel', modelId);
      } else {
        localStorage.setItem('selectedModel', modelId);
      }
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
  };

  const handleSendMessage = async (messageOverride?: string) => {
    const messageContent = messageOverride || inputMessage;
    if (!messageContent.trim() || !selectedModel || loading) return;

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
      // Check if streaming is available
      if (llmService.chatStream) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          modelId: selectedModel
        };

        setMessages(prev => [...prev, assistantMessage]);

        let fullContent = '';
        await llmService.chatStream(
          selectedModel, 
          [...messages, userMessage],
          (token: string) => {
            fullContent += token;
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessage.id 
                  ? { ...msg, content: fullContent }
                  : msg
              )
            );
          },
          () => {
            setIsTyping(false);
          }
        );
      } else {
        // Fallback to non-streaming
        const response = await llmService.chat(selectedModel, [...messages, userMessage]);
        
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
          modelId: selectedModel
        };

        setMessages(prev => [...prev, assistantMessage]);
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
      
      // Set up device service for current user
      
      loadPersistedSelectedModel();
      loadModels();
      loadDevices();
      
      const unsubscribeDevices = deviceService.onDevicesChange(userId, (updatedDevices) => {
        setDevices(updatedDevices);
        loadModels();
      });

      // Listen to P2P status changes to update models when P2P connection changes
      let unsubscribeP2P: (() => void) | undefined;
      if (window.electronAPI) {
        window.electronAPI.p2pOnStatus((status: any) => {
          console.log('P2P status changed:', status);
          loadModels(); // Reload models when P2P status changes
        });
        
        window.electronAPI.p2pOnPeer((peerEvent: any) => {
          console.log('P2P peer event:', peerEvent);
          loadModels(); // Reload models when peers change
        });
      }

      return () => {
        unsubscribeDevices();
        if (unsubscribeP2P) {
          unsubscribeP2P();
        }
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
    setInputMessage,
    handleSendMessage,
    handleModelSelect,
    handleRefresh,
    handleDebugOllama
  };
};