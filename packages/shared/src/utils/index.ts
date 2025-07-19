// Shared utility functions

export function generateRequestId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2);
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.process === 'object' && 
         window.process.type === 'renderer';
}

export function formatModelName(name: string): string {
  // Convert model names to human-readable format
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseModelId(modelId: string): {
  source: string;
  peerId?: string;
  modelName: string;
} {
  const parts = modelId.split(':');
  if (parts.length === 3) {
    return {
      source: parts[0],
      peerId: parts[1],
      modelName: parts[2]
    };
  }
  return {
    source: 'local',
    modelName: modelId
  };
}

export function sanitizeDeviceId(userId: string): string {
  // Remove special characters and ensure valid device ID
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
}