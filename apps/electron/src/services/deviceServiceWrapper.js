/**
 * JavaScript wrapper for TypeScript deviceService
 * This provides Firebase device registration for the main process using REST API
 */

const config = require('../../config.js');
const https = require('https');

// Simple device service implementation using Firebase REST API
class DeviceServiceWrapper {
  constructor() {
    this.initialized = false;
  }

  async registerDevice(userId, device) {
    console.log('🔄 DeviceServiceWrapper: Registering device in Firebase...', {
      userId,
      deviceName: device.name,
      endpoint: device.endpoint,
      isHosting: device.isHosting
    });
    
    try {
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Generate a unique API secret for this device
      const apiSecret = `pantheon_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
      
      // Create device data that matches the TypeScript interface
      const deviceData = {
        id: deviceId,
        name: device.name,
        userId: userId,
        endpoint: device.endpoint,
        isOnline: true,
        lastSeen: new Date(), // Use Date object, will be converted to Firestore timestamp
        models: device.models || [],
        platform: device.platform,
        isRemote: device.isRemote || false,
        apiKey: device.apiKey || '',
        apiSecret: apiSecret, // Required for web client remote model configuration
        isHosting: device.isHosting || true
      };

      // Use Firebase REST API to write to Firestore
      const projectId = config.firebase.projectId;
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/devices/${deviceId}`;
      
      // Convert device data and use server timestamp for lastSeen
      const firestoreFields = this.convertToFirestoreFields(deviceData);
      // Override lastSeen with server timestamp
      firestoreFields.lastSeen = {
        timestampValue: new Date().toISOString()
      };
      
      const postData = JSON.stringify({
        fields: firestoreFields
      });

      await this.makeFirebaseRequest(url, 'PATCH', postData);
      
      console.log('✅ DeviceServiceWrapper: Device registered successfully in Firebase:', deviceId);
      console.log('📝 Device details:', {
        id: deviceId,
        userId,
        name: device.name,
        endpoint: device.endpoint,
        models: device.models.length,
        isHosting: device.isHosting,
        platform: device.platform,
        apiSecret: apiSecret.substring(0, 10) + '...' // Log partial secret for security
      });
      
      return { deviceId, apiSecret };
      
    } catch (error) {
      console.error('❌ DeviceServiceWrapper: Registration failed:', error);
      throw error;
    }
  }

  // Convert JavaScript objects to Firestore field format
  convertToFirestoreFields(obj) {
    const fields = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        fields[key] = { nullValue: null };
      } else if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value };
      } else if (typeof value === 'number') {
        fields[key] = { integerValue: value.toString() };
      } else if (Array.isArray(value)) {
        fields[key] = {
          arrayValue: {
            values: value.map(item => ({ stringValue: item.toString() }))
          }
        };
      } else if (value instanceof Date) {
        // Convert Date to Firestore timestamp format
        fields[key] = { timestampValue: value.toISOString() };
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects recursively
        fields[key] = { mapValue: { fields: this.convertToFirestoreFields(value) } };
      }
    }
    return fields;
  }

  // Make HTTP request to Firebase REST API
  makeFirebaseRequest(url, method, data) {
    return new Promise((resolve, reject) => {
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(url, options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(responseData));
          } else {
            reject(new Error(`Firebase API error: ${res.statusCode} ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }
}

module.exports = { deviceService: new DeviceServiceWrapper() };