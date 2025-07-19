class SignalMessage {
    constructor(type, from, to, data) {
        this.type = type;
        this.from = from;
        this.to = to;
        this.data = data;
        this.timestamp = new Date().toISOString();
    }

    static fromSocket(socketData) {
        return new SignalMessage(
            socketData.type,
            socketData.from,
            socketData.to,
            socketData.data
        );
    }

    toJSON() {
        return {
            type: this.type,
            from: this.from,
            to: this.to,
            data: this.data,
            timestamp: this.timestamp
        };
    }
}

module.exports = SignalMessage;