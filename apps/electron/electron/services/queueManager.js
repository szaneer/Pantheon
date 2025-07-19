/**
 * Queue Manager for handling multiple client requests
 * Ensures fair access to model resources when multiple clients connect
 */

const EventEmitter = require('events');

class QueueManager extends EventEmitter {
  constructor() {
    super();
    this.queues = new Map(); // modelId -> queue of requests
    this.activeRequests = new Map(); // modelId -> current active request
    this.maxConcurrentPerModel = 1; // Only one request per model at a time
    this.requestTimeout = 300000; // 5 minutes timeout for requests
    this.clientLimits = new Map(); // clientId -> { lastRequest, requestCount }
    this.rateLimitWindow = 60000; // 1 minute
    this.maxRequestsPerWindow = 10; // Max requests per client per minute
  }

  /**
   * Add a request to the queue
   * @param {Object} request - { id, clientId, modelId, data, callback }
   * @returns {Promise<void>}
   */
  async enqueue(request) {
    const { clientId, modelId } = request;
    
    // Check rate limiting
    if (this.isRateLimited(clientId)) {
      request.callback({
        error: 'Rate limit exceeded. Please wait before making another request.',
        code: 'RATE_LIMITED'
      });
      return;
    }
    
    // Track client request
    this.trackClientRequest(clientId);
    
    // Create queue for model if it doesn't exist
    if (!this.queues.has(modelId)) {
      this.queues.set(modelId, []);
    }
    
    // Add request to queue
    const queue = this.queues.get(modelId);
    queue.push(request);
    
    // Log queue status
    console.log(`📥 Request ${request.id} added to queue for model ${modelId}. Queue length: ${queue.length}`);
    
    // Process queue if no active request for this model
    if (!this.activeRequests.has(modelId)) {
      this.processQueue(modelId);
    }
  }

  /**
   * Process the queue for a specific model
   * @param {string} modelId 
   */
  async processQueue(modelId) {
    const queue = this.queues.get(modelId);
    
    if (!queue || queue.length === 0) {
      this.activeRequests.delete(modelId);
      return;
    }
    
    // Get next request
    const request = queue.shift();
    this.activeRequests.set(modelId, request);
    
    console.log(`🔄 Processing request ${request.id} for model ${modelId}. Remaining in queue: ${queue.length}`);
    
    // Set timeout for request
    const timeoutId = setTimeout(() => {
      console.error(`⏱️ Request ${request.id} timed out`);
      request.callback({
        error: 'Request timed out',
        code: 'TIMEOUT'
      });
      this.activeRequests.delete(modelId);
      this.processQueue(modelId);
    }, this.requestTimeout);
    
    try {
      // Execute the request callback
      await new Promise((resolve, reject) => {
        request.callback({
          success: true,
          position: 0,
          execute: async (handler) => {
            try {
              const result = await handler();
              clearTimeout(timeoutId);
              resolve(result);
              return result;
            } catch (error) {
              clearTimeout(timeoutId);
              reject(error);
              throw error;
            }
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error processing request ${request.id}:`, error);
    } finally {
      // Remove from active requests and process next
      this.activeRequests.delete(modelId);
      setImmediate(() => this.processQueue(modelId));
    }
  }

  /**
   * Check if a client is rate limited
   * @param {string} clientId 
   * @returns {boolean}
   */
  isRateLimited(clientId) {
    const clientInfo = this.clientLimits.get(clientId);
    if (!clientInfo) return false;
    
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    // Count requests in current window
    const recentRequests = clientInfo.requests.filter(time => time > windowStart);
    
    return recentRequests.length >= this.maxRequestsPerWindow;
  }

  /**
   * Track a client request for rate limiting
   * @param {string} clientId 
   */
  trackClientRequest(clientId) {
    const now = Date.now();
    const clientInfo = this.clientLimits.get(clientId) || { requests: [] };
    
    // Add current request time
    clientInfo.requests.push(now);
    
    // Clean up old requests outside the window
    const windowStart = now - this.rateLimitWindow;
    clientInfo.requests = clientInfo.requests.filter(time => time > windowStart);
    
    this.clientLimits.set(clientId, clientInfo);
  }

  /**
   * Get queue status for all models
   * @returns {Object}
   */
  getQueueStatus() {
    const status = {};
    
    for (const [modelId, queue] of this.queues.entries()) {
      status[modelId] = {
        queueLength: queue.length,
        hasActiveRequest: this.activeRequests.has(modelId)
      };
    }
    
    return status;
  }

  /**
   * Get position in queue for a request
   * @param {string} requestId 
   * @param {string} modelId 
   * @returns {number} -1 if not found, 0 if active, 1+ if queued
   */
  getQueuePosition(requestId, modelId) {
    // Check if it's the active request
    const activeRequest = this.activeRequests.get(modelId);
    if (activeRequest && activeRequest.id === requestId) {
      return 0;
    }
    
    // Check position in queue
    const queue = this.queues.get(modelId);
    if (!queue) return -1;
    
    const position = queue.findIndex(req => req.id === requestId);
    return position === -1 ? -1 : position + 1;
  }

  /**
   * Cancel a request
   * @param {string} requestId 
   * @param {string} modelId 
   * @returns {boolean} true if cancelled, false if not found
   */
  cancelRequest(requestId, modelId) {
    const queue = this.queues.get(modelId);
    if (!queue) return false;
    
    const index = queue.findIndex(req => req.id === requestId);
    if (index === -1) return false;
    
    const [request] = queue.splice(index, 1);
    request.callback({
      error: 'Request cancelled',
      code: 'CANCELLED'
    });
    
    console.log(`🚫 Request ${requestId} cancelled for model ${modelId}`);
    return true;
  }

  /**
   * Clear all queues
   */
  clearAllQueues() {
    for (const [modelId, queue] of this.queues.entries()) {
      queue.forEach(request => {
        request.callback({
          error: 'Queue cleared',
          code: 'QUEUE_CLEARED'
        });
      });
    }
    
    this.queues.clear();
    this.activeRequests.clear();
    console.log('🧹 All queues cleared');
  }
}

module.exports = new QueueManager();