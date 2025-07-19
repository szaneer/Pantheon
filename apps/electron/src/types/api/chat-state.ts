import { ChatMessage } from './chat';
import { LLMModel } from './models';
import { Device } from '../../services/deviceService';

export interface ChatState {
  messages: ChatMessage[];
  selectedModel: string;
  models: LLMModel[];
  devices: Device[];
  loading: boolean;
  isTyping: boolean;
  refreshing: boolean;
  isSidebarOpen: boolean;
}