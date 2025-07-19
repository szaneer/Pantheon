/**
 * P2P Model Selector Component
 * Displays available models from connected Electron hosts and allows selection
 */

import React, { useState, useEffect } from 'react';
import { useP2PClient } from '../hooks/useP2PClient';

interface P2PModelSelectorProps {
  selectedModel?: string;
  onModelSelect?: (modelName: string, hostUserId: string) => void;
  disabled?: boolean;
  userId?: string;
  authToken?: string;
}

export function P2PModelSelector({
  selectedModel,
  onModelSelect,
  disabled = false,
  userId,
  authToken
}: P2PModelSelectorProps) {
  const {
    status,
    isConnected,
    peers,
    allModels,
    connect,
    disconnect,
    discoverPeers,
    connectToPeer,
    refreshModels,
    findModelHost,
    getAllModelNames
  } = useP2PClient(userId, authToken);

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [expandedPeers, setExpandedPeers] = useState<Set<string>>(new Set());

  // Auto-discover peers when connected
  useEffect(() => {
    if (isConnected) {
      handleDiscoverPeers();
    }
  }, [isConnected]);

  const handleDiscoverPeers = async () => {
    setIsDiscovering(true);
    try {
      await discoverPeers();
      // Wait a bit then refresh models
      setTimeout(() => {
        refreshModels();
      }, 1000);
    } catch (error) {
      console.error('Failed to discover peers:', error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleConnectToPeer = async (peerUserId: string) => {
    try {
      await connectToPeer(peerUserId);
      // Refresh models after connecting
      await refreshModels(peerUserId);
    } catch (error) {
      console.error(`Failed to connect to peer ${peerUserId}:`, error);
    }
  };

  const handleModelSelect = (modelName: string) => {
    const hostUserId = findModelHost(modelName);
    if (hostUserId && onModelSelect) {
      onModelSelect(modelName, hostUserId);
    }
  };

  const togglePeerExpansion = (peerUserId: string) => {
    const newExpanded = new Set(expandedPeers);
    if (newExpanded.has(peerUserId)) {
      newExpanded.delete(peerUserId);
    } else {
      newExpanded.add(peerUserId);
    }
    setExpandedPeers(newExpanded);
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const connectedPeers = peers.filter(peer => peer.connected);
  const allModelNames = getAllModelNames();

  return (
    <div className="p2p-model-selector">
      <div className="p2p-header">
        <h3>P2P Models</h3>
        <div className="p2p-status">
          <span className="status-icon">{getStatusIcon()}</span>
          <span className="status-text">{status.status}</span>
        </div>
      </div>

      {status.error && (
        <div className="error-message">
          ⚠️ {status.error}
        </div>
      )}

      <div className="p2p-controls">
        {!isConnected ? (
          <button
            onClick={connect}
            disabled={disabled || !userId || !authToken}
            className="btn btn-primary"
          >
            Connect to P2P Network
          </button>
        ) : (
          <div className="connected-controls">
            <button
              onClick={handleDiscoverPeers}
              disabled={disabled || isDiscovering}
              className="btn btn-secondary"
            >
              {isDiscovering ? 'Discovering...' : 'Discover Devices'}
            </button>
            <button
              onClick={() => refreshModels()}
              disabled={disabled}
              className="btn btn-secondary"
            >
              Refresh Models
            </button>
            <button
              onClick={disconnect}
              className="btn btn-outline"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {isConnected && (
        <>
          <div className="peers-summary">
            <p>
              {connectedPeers.length} device{connectedPeers.length !== 1 ? 's' : ''} connected,{' '}
              {allModelNames.length} model{allModelNames.length !== 1 ? 's' : ''} available
            </p>
          </div>

          {allModelNames.length > 0 && (
            <div className="model-list">
              <h4>Available Models</h4>
              <div className="model-grid">
                {allModelNames.map(modelName => {
                  const hostUserId = findModelHost(modelName);
                  const isSelected = selectedModel === modelName;
                  
                  return (
                    <div
                      key={modelName}
                      className={`model-item ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                      onClick={() => !disabled && handleModelSelect(modelName)}
                    >
                      <div className="model-name">{modelName}</div>
                      <div className="model-host">Host: {hostUserId?.substring(0, 8)}...</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="peers-list">
            <h4>Connected Devices</h4>
            {connectedPeers.length === 0 ? (
              <p className="no-peers">No devices connected. Click "Discover Devices" to find available hosts.</p>
            ) : (
              connectedPeers.map(peer => (
                <div key={peer.userId} className="peer-item">
                  <div 
                    className="peer-header"
                    onClick={() => togglePeerExpansion(peer.userId)}
                  >
                    <span className="peer-id">{peer.userId.substring(0, 12)}...</span>
                    <span className="peer-status">
                      {peer.connected ? '🟢 Connected' : '⚪ Disconnected'}
                    </span>
                    <span className="peer-models-count">
                      {peer.models.length} model{peer.models.length !== 1 ? 's' : ''}
                    </span>
                    <span className="expand-icon">
                      {expandedPeers.has(peer.userId) ? '▼' : '▶'}
                    </span>
                  </div>
                  
                  {expandedPeers.has(peer.userId) && (
                    <div className="peer-details">
                      {peer.models.length === 0 ? (
                        <div className="peer-actions">
                          <p>No models available</p>
                          <button
                            onClick={() => refreshModels(peer.userId)}
                            className="btn btn-small"
                            disabled={disabled}
                          >
                            Refresh
                          </button>
                        </div>
                      ) : (
                        <div className="peer-models">
                          {peer.models.map((model, index) => (
                            <div key={index} className="peer-model">
                              <span className="model-name">{model.displayName || model.name}</span>
                              {model.size && (
                                <span className="model-size">
                                  {(model.size / 1024 / 1024 / 1024).toFixed(1)}GB
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .p2p-model-selector {
          padding: 20px;
          background: var(--surface-color, #f8f9fa);
          border-radius: 8px;
          margin: 20px 0;
        }

        .p2p-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .p2p-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .p2p-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .status-icon {
          font-size: 12px;
        }

        .error-message {
          background: #fee;
          color: #c33;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .p2p-controls {
          margin-bottom: 20px;
        }

        .connected-controls {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #545b62;
        }

        .btn-outline {
          background: transparent;
          color: #6c757d;
          border: 1px solid #6c757d;
        }

        .btn-outline:hover:not(:disabled) {
          background: #6c757d;
          color: white;
        }

        .btn-small {
          padding: 4px 8px;
          font-size: 12px;
        }

        .peers-summary {
          margin-bottom: 16px;
          padding: 12px;
          background: var(--background-color, white);
          border-radius: 4px;
          font-size: 14px;
          color: var(--text-secondary, #666);
        }

        .peers-summary p {
          margin: 0;
        }

        .model-list {
          margin-bottom: 24px;
        }

        .model-list h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 500;
        }

        .model-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }

        .model-item {
          padding: 12px;
          background: var(--background-color, white);
          border: 2px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .model-item:hover:not(.disabled) {
          border-color: #007bff;
        }

        .model-item.selected {
          border-color: #007bff;
          background: #e3f2fd;
        }

        .model-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .model-name {
          font-weight: 500;
          margin-bottom: 4px;
        }

        .model-host {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }

        .peers-list h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 500;
        }

        .no-peers {
          color: var(--text-secondary, #666);
          font-style: italic;
          margin: 0;
        }

        .peer-item {
          background: var(--background-color, white);
          border-radius: 6px;
          margin-bottom: 8px;
          overflow: hidden;
        }

        .peer-header {
          display: flex;
          align-items: center;
          padding: 12px;
          cursor: pointer;
          gap: 12px;
        }

        .peer-header:hover {
          background: #f8f9fa;
        }

        .peer-id {
          font-family: monospace;
          font-weight: 500;
          flex: 1;
        }

        .peer-status {
          font-size: 12px;
        }

        .peer-models-count {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }

        .expand-icon {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }

        .peer-details {
          padding: 0 12px 12px 12px;
          border-top: 1px solid #eee;
        }

        .peer-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .peer-actions p {
          margin: 0;
          color: var(--text-secondary, #666);
          font-size: 14px;
        }

        .peer-models {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .peer-model {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          background: #f8f9fa;
          border-radius: 4px;
          font-size: 14px;
        }

        .model-size {
          color: var(--text-secondary, #666);
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}