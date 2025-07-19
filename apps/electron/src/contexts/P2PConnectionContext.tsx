import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

interface P2PStatus {
  status: string;
  message?: string;
  isHosting?: boolean;
  hostingEnabled?: boolean;
  connectedPeers?: number;
}

interface P2PConnectionContextType {
  status: P2PStatus;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  enableHosting: () => Promise<void>;
  disableHosting: () => Promise<void>;
}

const P2PConnectionContext = createContext<P2PConnectionContextType | undefined>(undefined);

export function useP2PConnection() {
  const context = useContext(P2PConnectionContext);
  if (context === undefined) {
    throw new Error('useP2PConnection must be used within a P2PConnectionProvider');
  }
  return context;
}

export function P2PConnectionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<P2PStatus>({ status: 'disconnected' });
  const [isConnected, setIsConnected] = useState(false);
  const connectionInitialized = useRef(false);
  const statusListenerAdded = useRef(false);

  // Initialize P2P connection when user is authenticated
  useEffect(() => {
    if (!user || !window.electronAPI?.p2p) return;

    const initializeConnection = async () => {
      if (connectionInitialized.current) return;
      connectionInitialized.current = true;

      try {
        // Add status listener only once
        if (!statusListenerAdded.current) {
          statusListenerAdded.current = true;
          await window.electronAPI.p2p.addStatusListener();
          
          // Set up status change listener
          window.electronAPI.p2p.onStatusChanged((_: any, data: P2PStatus) => {
            console.log('P2P status update:', data);
            setStatus(data);
            setIsConnected(data.status === 'connected' || data.status === 'hosting');
          });
        }

        // Get initial status
        const initialStatus = await window.electronAPI.p2p.getStatus();
        if (initialStatus) {
          setStatus(initialStatus);
          setIsConnected(initialStatus.status === 'connected' || initialStatus.status === 'hosting');
          
          // If not connected and should be, connect
          if (initialStatus.status === 'disconnected' && user) {
            console.log('P2P not connected, initiating connection...');
            await window.electronAPI.p2p.connect();
          }
        }
      } catch (error) {
        console.error('Failed to initialize P2P connection:', error);
      }
    };

    initializeConnection();

    // Cleanup function
    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, [user]);

  const connect = async () => {
    if (!window.electronAPI?.p2p) return;
    try {
      await window.electronAPI.p2p.connect();
    } catch (error) {
      console.error('Failed to connect P2P:', error);
    }
  };

  const disconnect = async () => {
    if (!window.electronAPI?.p2p) return;
    try {
      await window.electronAPI.p2p.disconnect();
    } catch (error) {
      console.error('Failed to disconnect P2P:', error);
    }
  };

  const enableHosting = async () => {
    if (!window.electronAPI?.p2p) return;
    try {
      await window.electronAPI.p2p.enableHosting();
    } catch (error) {
      console.error('Failed to enable hosting:', error);
    }
  };

  const disableHosting = async () => {
    if (!window.electronAPI?.p2p) return;
    try {
      await window.electronAPI.p2p.disableHosting();
    } catch (error) {
      console.error('Failed to disable hosting:', error);
    }
  };

  return (
    <P2PConnectionContext.Provider value={{
      status,
      isConnected,
      connect,
      disconnect,
      enableHosting,
      disableHosting
    }}>
      {children}
    </P2PConnectionContext.Provider>
  );
}