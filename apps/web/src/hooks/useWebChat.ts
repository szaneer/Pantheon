import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '../types/api/chat';
import { LLMModel } from '../types/api/models';
import { Device, webDeviceService } from '../services/webDeviceService';
import { webLLMService } from '../services/webLLMService';
import p2pClientServiceV2 from '../services/p2pClientServiceV2';

export const useWebChat = (userId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Set user ID in device service
  useEffect(() => {
    if (userId) {
      webDeviceService.setCurrentUserId(userId);
    }
  }, [userId]);


  // Load devices and models
  const loadModels = useCallback(async () => {
    if (!userId) {
      console.log('⚠️ No userId provided to loadModels');
      return;
    }
    
    try {
      setRefreshing(true);
      console.log('🔄 Loading remote devices and models for user:', userId);
      
      const remoteDevices = await webDeviceService.getDevicesForUser(userId);
      console.log('📱 Remote devices loaded:', remoteDevices);
      
      // Also get P2P devices
      const p2pDevices: Device[] = [];
      const p2pStatus = p2pClientServiceV2.getStatus();
      if (p2pStatus.connected) {
        const peerModels = p2pClientServiceV2.getAllAvailableModels();
        for (const [peerId, models] of Object.entries(peerModels)) {
          if (models && models.length > 0) {
            p2pDevices.push({
              id: `p2p_${peerId}`,
              name: `P2P Device (${peerId.substring(0, 8)}...)`,
              userId: userId,
              endpoint: `p2p://${peerId}`,
              isOnline: true,
              lastSeen: new Date(),
              models: models.map(m => m.name),
              platform: 'P2P',
              isHosting: true
            });
          }
        }
      }
      console.log('🌐 P2P devices:', p2pDevices);
      
      // Combine remote and P2P devices
      const allDevices = [...remoteDevices, ...p2pDevices];
      setDevices(allDevices);
      
      const availableModels = await webLLMService.getModels(remoteDevices, userId);
      console.log('🤖 Available models received:', availableModels.length, 'models');
      console.log('📋 Model details:', availableModels);
      setModels(availableModels);
      
      // Auto-select first available model if none selected
      if (!selectedModel && availableModels.length > 0) {
        setSelectedModel(availableModels[0]);
        console.log('🎯 Auto-selected first available model:', availableModels[0].name);
      }
      
      console.log('✅ Models loaded successfully:', {
        deviceCount: allDevices.length,
        modelCount: availableModels.length,
        p2pModelCount: availableModels.filter(m => m.isP2P).length
      });
    } catch (error) {
      console.error('❌ Failed to load models:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      // Set empty arrays to prevent UI issues
      setModels([]);
      setDevices([]);
    } finally {
      setRefreshing(false);
    }
  }, [userId]); // Removed selectedModel to prevent infinite loops

  // Set up real-time device updates
  useEffect(() => {
    if (!userId) return;

    console.log('👂 Setting up real-time device updates for web chat');
    const unsubscribe = webDeviceService.onDevicesChange(userId, async (updatedDevices) => {
      console.log('🔄 Devices updated, refreshing models...');
      setDevices(updatedDevices);
      
      const availableModels = await webLLMService.getModels(updatedDevices, userId);
      setModels(availableModels);
      
      // If selected model is no longer available, clear selection
      if (selectedModel && !availableModels.find(m => 
        m.name === selectedModel.name && m.deviceId === selectedModel.deviceId
      )) {
        console.log('⚠️ Selected model no longer available, clearing selection');
        setSelectedModel(null);
      }
    });

    return unsubscribe;
  }, [userId, selectedModel]);

  // Set up P2P status listener to refresh models when connection changes
  useEffect(() => {
    const removeListener = p2pClientServiceV2.on('status', (status) => {
      if (status.status === 'connected') {
        console.log('🌐 P2P connected, refreshing models to include P2P devices...');
        loadModels();
      } else if (status.status === 'disconnected') {
        console.log('🔌 P2P disconnected, refreshing models to remove P2P devices...');
        loadModels();
      }
    });

    return removeListener;
  }, [loadModels]);

  // Set up P2P peer list listener to refresh models when peers change
  useEffect(() => {
    const removeListener = p2pClientServiceV2.on('peer', (event) => {
      console.log('👥 P2P peer event:', event.type, 'refreshing models...');
      loadModels();
    });

    return removeListener;
  }, [loadModels]);

  // Set up P2P model listener to refresh when models change
  useEffect(() => {
    const removeListener = p2pClientServiceV2.on('model', (models) => {
      console.log('📦 P2P models updated, refreshing devices...');
      loadModels();
    });

    return removeListener;
  }, [loadModels]);

  // Initial load
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !selectedModel || loading) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    setIsTyping(true);

    try {
      const chatHistory = [...messages, userMessage].map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      let assistantResponse = '';
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      // Add empty assistant message that will be updated
      setMessages(prev => [...prev, assistantMessage]);

      await webLLMService.generateResponse(
        selectedModel,
        chatHistory,
        (token: string) => {
          assistantResponse += token;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: assistantResponse }
                : msg
            )
          );
        },
        () => {
          setIsTyping(false);
          setLoading(false);
          console.log('✅ Response complete');
        }
      );
    } catch (error) {
      console.error('❌ Failed to generate response:', error);
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to generate response'}`,
        timestamp: new Date()
      }]);
      setIsTyping(false);
      setLoading(false);
    }
  }, [inputMessage, selectedModel, loading, messages]);

  const handleModelSelect = useCallback((modelId: string | LLMModel) => {
    if (typeof modelId === 'string') {
      const model = models.find(m => m.id === modelId);
      if (model) {
        console.log('🎯 Selected model by ID:', modelId);
        console.log('🎯 Found model:', `${model.name} (${model.deviceName})`);
        setSelectedModel(model);
      } else {
        console.warn('⚠️ Model not found for ID:', modelId);
        console.log('📋 Available model IDs:', models.map(m => m.id));
      }
    } else {
      console.log('🎯 Selected model object:', `${modelId.name} (${modelId.deviceName})`);
      setSelectedModel(modelId);
    }
  }, [models]);

  const handleRefresh = useCallback(() => {
    console.log('🔄 Manual refresh requested');
    loadModels();
  }, [loadModels]);

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
    handleRefresh
  };
};