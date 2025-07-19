import React, { createContext, useContext, useEffect, useState } from 'react';
import p2pClientServiceV2 from '../services/p2pClientServiceV2';

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
    const savedUserId = localStorage.getItem('currentUserId');
    const savedAuthKey = localStorage.getItem('authKey');
    
    if (savedUserId) {
      const restoredUser = { uid: savedUserId };
      setUser(restoredUser);
      
      // Initialize P2P service
      console.log('🌐 Initializing P2P service...');
      p2pClientServiceV2.initialize(savedUserId, savedAuthKey || undefined)
        .then(() => console.log('✅ P2P service initialized'))
        .catch((error: any) => console.error('❌ Failed to initialize P2P service:', error));
    }
    
    setLoading(false);
          
          // Check if the error is due to the account being deleted or permissions
          if (error.code === 'auth/user-not-found' || 
  }, []);

  const signIn = async (authKey?: string) => {
    // Generate a unique device ID if not exists
    let userId = localStorage.getItem('currentUserId');
    if (!userId) {
      userId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('currentUserId', userId);
    }
    
    // Store auth key if provided
    if (authKey) {
      localStorage.setItem('authKey', authKey);
    }
    
    const user = { uid: userId };
    setUser(user);
    
    // Initialize P2P service
    try {
      console.log('🌐 Initializing P2P service...');
      await p2pClientServiceV2.initialize(userId, authKey);
      console.log('✅ P2P service initialized');
    } catch (error: any) {
      console.error('❌ Failed to initialize P2P service:', error);
      throw error;
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('authKey');
    p2pClientServiceV2.disconnect();
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