class ErrorMessage {
    constructor(code, message, details = {}) {
        this.code = code;
        this.message = message;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }

    static authenticationFailed(details = {}) {
        return new ErrorMessage('AUTH_FAILED', 'Authentication failed', details);
    }

    static peerNotFound(peerId) {
        return new ErrorMessage('PEER_NOT_FOUND', 'Peer not found', { peerId });
    }

    static roomNotFound(roomId) {
        return new ErrorMessage('ROOM_NOT_FOUND', 'Room not found', { roomId });
    }

    static invalidSignal(reason) {
        return new ErrorMessage('INVALID_SIGNAL', 'Invalid signal data', { reason });
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

module.exports = ErrorMessage;