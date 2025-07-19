/**
 * Enhanced P2P Service V2 for Electron with improved TURN handling
 * This version includes better mobile network support and debugging
 * Now unified for both development and production since both use the same signaling server
 */

// Use production-safe version for both development and production
module.exports = require('./p2pServiceV2-production-fix');