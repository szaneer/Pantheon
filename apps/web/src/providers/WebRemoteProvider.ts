// axios import removed - using fetch instead
import { LLMModel } from '../types/api/models';

export class RemoteProvider {
  async generateResponse(
    model: LLMModel,
    messages: Array<{ role: string; content: string }>,
    onToken?: (token: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (!model.endpoint || !model.apiSecret) {
      throw new Error('Remote model configuration is incomplete');
    }

    try {
      console.log('🚀 Sending request to remote device:', model.endpoint);
      
      // Extract the actual model name from the model ID
      // Format: firebase_${device.id}_${modelName} or remote_${host}_${port}_${modelName}
      let actualModelName = model.name;
      if (model.id.startsWith('firebase_')) {
        const parts = model.id.split('_');
        actualModelName = parts.slice(2).join('_'); // Everything after "firebase_deviceId_"
      } else if (model.id.startsWith('remote_')) {
        const parts = model.id.split('_');
        actualModelName = parts.slice(3).join('_'); // Everything after "remote_host_port_"
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout for chat
      
      const response = await fetch(`${model.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-secret': model.apiSecret
        },
        body: JSON.stringify({
          model: actualModelName,
          messages: messages,
          stream: false
        }),
        // Allow mixed content (HTTP from HTTPS)
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Remote API error response:', errorText);
        throw new Error(`Remote API responded with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📥 Remote API response:', data);

      if (data.choices && data.choices[0] && data.choices[0].message) {
        // OpenAI-compatible format
        const message = data.choices[0].message.content;
        if (message) {
          onToken?.(message);
        }
        onComplete?.();
      } else {
        throw new Error(`Invalid response format: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('❌ Remote generation failed:', error);
      
      // Provide specific error message for mixed content issues
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const isHttpsToHttp = window.location.protocol === 'https:' && model.endpoint.startsWith('http:');
        if (isHttpsToHttp) {
          throw new Error(`Mixed content blocked: Cannot connect to HTTP device (${model.endpoint}) from HTTPS web app. Try using a tunnel URL or access the web app via HTTP.`);
        }
      }
      
      throw error;
    }
  }

  async testConnection(model: LLMModel): Promise<boolean> {
    if (!model.endpoint || !model.apiSecret) {
      return false;
    }

    try {
      console.log('🔍 Testing connection to:', model.endpoint);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${model.endpoint}/health`, {
        method: 'GET',
        headers: {
          'x-device-secret': model.apiSecret
        },
        signal: controller.signal,
        // Allow mixed content (HTTP from HTTPS)
        mode: 'cors',
        credentials: 'omit'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Connection test successful');
        return true;
      } else {
        console.warn('⚠️ Connection test failed with status:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      
      // Log specific information about mixed content issues
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const isHttpsToHttp = window.location.protocol === 'https:' && model.endpoint.startsWith('http:');
        if (isHttpsToHttp) {
          console.warn('⚠️ Mixed content issue detected - HTTPS web app trying to connect to HTTP device');
        }
      }
      
      return false;
    }
  }
}