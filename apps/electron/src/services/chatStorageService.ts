/**
 * Chat Storage Service
 * Handles persistent storage of chat messages and conversations
 */

import { ChatMessage } from '../types/api/chat';

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
  modelId?: string;
}

class ChatStorageService {
  private readonly STORAGE_KEY = 'pantheon_chats';
  private readonly CURRENT_CHAT_KEY = 'pantheon_current_chat';

  /**
   * Get all conversations for the current user
   */
  async getConversations(): Promise<ChatConversation[]> {
    try {
      let data: string | null = null;
      
      if (window.electronAPI) {
        data = await window.electronAPI.getStoreValue(this.STORAGE_KEY);
      } else {
        data = localStorage.getItem(this.STORAGE_KEY);
      }
      
      if (!data) return [];
      
      const conversations = JSON.parse(data);
      // Convert date strings back to Date objects
      return conversations.map((conv: any) => ({
        ...conv,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
        messages: conv.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
    } catch (error) {
      console.error('Failed to load conversations:', error);
      return [];
    }
  }

  /**
   * Save all conversations
   */
  async saveConversations(conversations: ChatConversation[]): Promise<void> {
    try {
      const data = JSON.stringify(conversations);
      
      if (window.electronAPI) {
        await window.electronAPI.setStoreValue(this.STORAGE_KEY, data);
      } else {
        localStorage.setItem(this.STORAGE_KEY, data);
      }
    } catch (error) {
      console.error('Failed to save conversations:', error);
    }
  }

  /**
   * Get a specific conversation by ID
   */
  async getConversation(id: string): Promise<ChatConversation | null> {
    const conversations = await this.getConversations();
    return conversations.find(conv => conv.id === id) || null;
  }

  /**
   * Create a new conversation
   */
  async createConversation(title?: string, modelId?: string): Promise<ChatConversation> {
    const conversation: ChatConversation = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title || 'New Chat',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      modelId
    };

    const conversations = await this.getConversations();
    conversations.unshift(conversation); // Add to beginning
    await this.saveConversations(conversations);
    
    // Set as current chat
    await this.setCurrentChatId(conversation.id);
    
    return conversation;
  }

  /**
   * Update a conversation
   */
  async updateConversation(id: string, updates: Partial<ChatConversation>): Promise<void> {
    const conversations = await this.getConversations();
    const index = conversations.findIndex(conv => conv.id === id);
    
    if (index !== -1) {
      conversations[index] = {
        ...conversations[index],
        ...updates,
        updatedAt: new Date()
      };
      await this.saveConversations(conversations);
    }
  }

  /**
   * Add messages to a conversation
   */
  async addMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    const conversations = await this.getConversations();
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    if (conversation) {
      conversation.messages.push(...messages);
      conversation.updatedAt = new Date();
      
      // Auto-generate title from first user message if it's still "New Chat"
      if (conversation.title === 'New Chat' && conversation.messages.length > 0) {
        const firstUserMessage = conversation.messages.find(msg => msg.role === 'user');
        if (firstUserMessage) {
          conversation.title = firstUserMessage.content.slice(0, 50) + 
            (firstUserMessage.content.length > 50 ? '...' : '');
        }
      }
      
      await this.saveConversations(conversations);
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<void> {
    const conversations = await this.getConversations();
    const filtered = conversations.filter(conv => conv.id !== id);
    await this.saveConversations(filtered);
    
    // If this was the current chat, clear it
    const currentId = await this.getCurrentChatId();
    if (currentId === id) {
      await this.setCurrentChatId(null);
    }
  }

  /**
   * Get current chat ID
   */
  async getCurrentChatId(): Promise<string | null> {
    try {
      if (window.electronAPI) {
        return await window.electronAPI.getStoreValue(this.CURRENT_CHAT_KEY);
      } else {
        return localStorage.getItem(this.CURRENT_CHAT_KEY);
      }
    } catch (error) {
      console.error('Failed to get current chat ID:', error);
      return null;
    }
  }

  /**
   * Set current chat ID
   */
  async setCurrentChatId(id: string | null): Promise<void> {
    try {
      if (window.electronAPI) {
        await window.electronAPI.setStoreValue(this.CURRENT_CHAT_KEY, id);
      } else {
        if (id) {
          localStorage.setItem(this.CURRENT_CHAT_KEY, id);
        } else {
          localStorage.removeItem(this.CURRENT_CHAT_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to set current chat ID:', error);
    }
  }

  /**
   * Clear all conversations
   */
  async clearAll(): Promise<void> {
    try {
      if (window.electronAPI) {
        await window.electronAPI.setStoreValue(this.STORAGE_KEY, null);
        await window.electronAPI.setStoreValue(this.CURRENT_CHAT_KEY, null);
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.CURRENT_CHAT_KEY);
      }
    } catch (error) {
      console.error('Failed to clear conversations:', error);
    }
  }
}

export const chatStorageService = new ChatStorageService();