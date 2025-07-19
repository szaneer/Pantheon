class PeerInfo {
    constructor(userId, socketId, deviceInfo = {}) {
        this.userId = userId;
        this.socketId = socketId;
        this.deviceInfo = deviceInfo;
        this.connectedAt = new Date().toISOString();
        this.clientType = null;
        this.originalUserId = null;
    }

    toJSON() {
        return {
            userId: this.userId,
            socketId: this.socketId,
            deviceInfo: this.deviceInfo,
            connectedAt: this.connectedAt,
            clientType: this.clientType,
            originalUserId: this.originalUserId
        };
    }
}

class PeerConnection {
    constructor(peerId1, peerId2, roomId) {
        this.peerId1 = peerId1;
        this.peerId2 = peerId2;
        this.roomId = roomId;
        this.established = false;
        this.createdAt = new Date().toISOString();
    }

    markEstablished() {
        this.established = true;
        this.establishedAt = new Date().toISOString();
    }

    toJSON() {
        return {
            peerId1: this.peerId1,
            peerId2: this.peerId2,
            roomId: this.roomId,
            established: this.established,
            createdAt: this.createdAt,
            establishedAt: this.establishedAt
        };
    }
}

module.exports = { PeerInfo, PeerConnection };