class Room {
    constructor(roomId, type = 'account') {
        this.roomId = roomId;
        this.type = type;
        this.peers = new Map();
        this.createdAt = new Date().toISOString();
    }

    addPeer(peerInfo) {
        this.peers.set(peerInfo.userId, peerInfo);
    }

    removePeer(userId) {
        return this.peers.delete(userId);
    }

    getPeers() {
        return Array.from(this.peers.values());
    }

    getPeerCount() {
        return this.peers.size;
    }

    isEmpty() {
        return this.peers.size === 0;
    }

    toJSON() {
        return {
            roomId: this.roomId,
            type: this.type,
            peers: this.getPeers(),
            peerCount: this.getPeerCount(),
            createdAt: this.createdAt
        };
    }
}

module.exports = Room;