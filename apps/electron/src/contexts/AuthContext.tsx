import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  uid: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (authKey?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const initAuth = async () => {
      const savedUserId = await window.electronAPI?.getStoreValue('currentUserId');
      const savedAuthKey = await window.electronAPI?.getStoreValue('authKey');
      
      if (savedUserId) {
        const restoredUser = { uid: savedUserId };
        setUser(restoredUser);
        localStorage.setItem('currentUserId', savedUserId);
        
        // Initialize P2P service
        try {
          console.log('🌐 Initializing P2P service...');
          await window.electronAPI?.p2p?.setCurrentUserId(savedUserId, savedAuthKey || undefined);
          console.log('✅ P2P service initialized');
        } catch (error) {
          console.error('❌ Failed to initialize P2P service:', error);
        }
      }
      
  }, []);

  const signIn = async (authKey?: string) => {
    // Generate a unique device ID if not exists
    let userId = await window.electronAPI?.getStoreValue('currentUserId');
    if (!userId) {
      userId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await window.electronAPI?.setStoreValue('currentUserId', userId);
    }
    
    // Store auth key if provided
    if (authKey) {
      await window.electronAPI?.setStoreValue('authKey', authKey);
    }
    
    const user = { uid: userId };
    setUser(user);
    localStorage.setItem('currentUserId', userId);
    
    // Initialize P2P service
    try {
      console.log('🌐 Initializing P2P service...');
      await window.electronAPI?.p2p?.setCurrentUserId(userId, authKey);
      console.log('✅ P2P service initialized');
      
      // Check if auto-start hosting is enabled
      const autoStartHosting = await window.electronAPI?.getStoreValue('autoStartHosting');
      if (autoStartHosting) {
        console.log('🚀 Auto-starting model hosting...');
        try {
          await window.electronAPI?.p2p?.enableHosting();
          console.log('✅ Model hosting auto-started');
        } catch (error) {
          console.error('Failed to auto-start hosting:', error);
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to initialize P2P service:', error);
      throw error;
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('currentUserId');
    await window.electronAPI?.setStoreValue('currentUserId', null);
    await window.electronAPI?.setStoreValue('authKey', null);
    await window.electronAPI?.p2p?.setCurrentUserId(null);
  };

  const value = {
    user,
    loading,
    signIn,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 