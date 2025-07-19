/**
 * React hook for P2P client functionality
 */

import { useState, useEffect, useCallback } from 'react';
import p2pClientServiceV2, { 
  P2PStatus, 
  PeerInfo, 
  ModelInfo, 
  ChatRequest, 
  ChatResponse 
} from '../services/p2pClientServiceV2';

export interface P2PPeer {
  userId: string;
  models: ModelInfo[];
  connected: boolean;
}

export interface UseP2PClientReturn {
  // Status
  status: P2PStatus;
  isConnected: boolean;
  
  // Peers and models
  peers: P2PPeer[];
  allModels: Record<string, ModelInfo[]>;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  discoverPeers: () => Promise<void>;
  connectToPeer: (userId: string) => Promise<void>;
  sendChatRequest: (userId: string, request: ChatRequest) => Promise<ChatResponse>;
  refreshModels: (userId?: string) => Promise<void>;
  
  // Utilities
  findModelHost: (modelName: string) => string | null;
  getAllModelNames: () => string[];
}

export function useP2PClient(userId?: string, authToken?: string): UseP2PClientReturn {
  const [status, setStatus] = useState<P2PStatus>(p2pClientServiceV2.getStatus());
  const [peers, setPeers] = useState<P2PPeer[]>([]);
  const [allModels, setAllModels] = useState<Record<string, ModelInfo[]>>({});

  // Initialize service when user credentials are available
  useEffect(() => {
    if (userId && authToken) {
      p2pClientServiceV2.initialize(userId, authToken).catch(console.error);
    }
  }, [userId, authToken]);

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = p2pClientServiceV2.on('status', setStatus);
    return unsubscribe;
  }, []);

  // Subscribe to peer changes
  useEffect(() => {
    const peerMap = new Map<string, { info?: PeerInfo; connected: boolean; models: ModelInfo[] }>();

    const unsubscribePeer = p2pClientServiceV2.on('peer', (event) => {
      const { type, peer, userId: eventUserId } = event;
      
      if (type === 'joined' || type === 'existing') {
        if (peer) {
          peerMap.set(peer.userId, {
            info: peer,
            connected: false,
            models: []
          });
        }
      } else if (type === 'connected' && eventUserId) {
        const existing = peerMap.get(eventUserId);
        if (existing) {
          existing.connected = true;
        } else {
          peerMap.set(eventUserId, {
            connected: true,
            models: []
          });
        }
      } else if (type === 'left' && (peer?.userId || eventUserId)) {
        const userToRemove = peer?.userId || eventUserId;
        if (userToRemove) {
          peerMap.delete(userToRemove);
        }
      }

      // Update peers state
      const peerList: P2PPeer[] = Array.from(peerMap.entries()).map(([userId, data]) => ({
        userId,
        models: data.models,
        connected: data.connected
      }));
      setPeers(peerList);
    });

    return unsubscribePeer;
  }, []);

  // Subscribe to model changes
  useEffect(() => {
    const unsubscribeModels = p2pClientServiceV2.on('model', (models) => {
      setAllModels(models);
      
      // Update peer models
      setPeers(currentPeers => 
        currentPeers.map(peer => ({
          ...peer,
          models: models[peer.userId] || []
        }))
      );
    });

    return unsubscribeModels;
  }, []);

  // Actions
  const connect = useCallback(async () => {
    if (!userId || !authToken) {
      throw new Error('User credentials required');
    }
    await p2pClientServiceV2.connect();
  }, [userId, authToken]);

  const disconnect = useCallback(() => {
    p2pClientServiceV2.disconnect();
  }, []);

  const discoverPeers = useCallback(async () => {
    await p2pClientServiceV2.discoverPeers();
  }, []);

  const connectToPeer = useCallback(async (peerUserId: string) => {
    await p2pClientServiceV2.connectToPeer(peerUserId);
  }, []);

  const sendChatRequest = useCallback(async (peerUserId: string, request: ChatRequest) => {
    return p2pClientServiceV2.sendChatRequest(peerUserId, request);
  }, []);

  const refreshModels = useCallback(async (peerUserId?: string) => {
    if (peerUserId) {
      await p2pClientServiceV2.requestModelsFromPeer(peerUserId);
    } else {
      // Refresh models from all connected peers
      const connectedPeers = p2pClientServiceV2.getConnectedPeers();
      await Promise.all(
        connectedPeers.map(userId => 
          p2pClientServiceV2.requestModelsFromPeer(userId).catch(err =>
            console.error(`Failed to refresh models from ${userId}:`, err)
          )
        )
      );
    }
  }, []);

  // Utilities
  const findModelHost = useCallback((modelName: string): string | null => {
    for (const [userId, models] of Object.entries(allModels)) {
      if (models.some(model => model.name === modelName)) {
        return userId;
      }
    }
    return null;
  }, [allModels]);

  const getAllModelNames = useCallback((): string[] => {
    const modelNames = new Set<string>();
    Object.values(allModels).forEach(models => {
      models.forEach(model => modelNames.add(model.name));
    });
    return Array.from(modelNames).sort();
  }, [allModels]);

  return {
    // Status
    status,
    isConnected: status.connected,
    
    // Peers and models
    peers,
    allModels,
    
    // Actions
    connect,
    disconnect,
    discoverPeers,
    connectToPeer,
    sendChatRequest,
    refreshModels,
    
    // Utilities
    findModelHost,
    getAllModelNames
  };
}