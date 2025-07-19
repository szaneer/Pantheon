require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { SignalMessage, PeerMessage, RoomMessage, ErrorMessage } = require('./models');
const { PeerInfo, PeerConnection } = require('./models/peer.model');
const Room = require('./models/room.model');
const twilio = require('twilio');

// Simple auth key configuration
const AUTH_KEY = process.env.AUTH_KEY || null; // Optional auth key

const app = express();

// Add JSON body parser for POST requests
app.use(express.json());

// Add explicit CORS middleware for Express routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false,
        allowedHeaders: ["*"]
    },
    allowEIO3: true
});

// Track rooms and connections
const rooms = new Map();
const userSockets = new Map();

// Middleware for simple auth
const authenticateSocket = async (socket, next) => {
    try {
        // If auth key is set, verify it
        if (AUTH_KEY) {
            const providedKey = socket.handshake.auth.authKey || socket.handshake.auth.token;
            if (providedKey !== AUTH_KEY) {
                return next(new Error('Invalid auth key'));
            }
        }
        
        // Use device ID as the primary identifier
        socket.deviceId = socket.handshake.auth.deviceId || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        socket.userId = socket.deviceId;
        socket.accountId = 'default'; // Single account/room for all clients
        socket.clientType = socket.handshake.auth.clientType || 'unknown';
        next();
    } catch (error) {
        next(new Error('Authentication failed'));
    }
};

io.use(authenticateSocket);

io.on('connection', (socket) => {
    console.log(`Device connected: ${socket.deviceId} (user: ${socket.userId}, type: ${socket.clientType})`);
    console.log(`Auth details - deviceId from handshake: ${socket.handshake.auth.deviceId}, userId: ${socket.userId}`);
    const peerInfo = new PeerInfo(socket.deviceId, socket.id, socket.handshake.headers);
    peerInfo.clientType = socket.clientType;
    peerInfo.originalUserId = socket.userId; // Keep original userId for account-based grouping
    userSockets.set(socket.deviceId, socket);
    
    // Join single global room
    socket.on('join-account', () => {
        const roomId = 'global'; // Single room for all clients
        socket.join(roomId);
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Room(roomId, 'account'));
        }
        
        const room = rooms.get(roomId);
        room.addPeer(peerInfo);
        
        // Notify existing peers
        socket.to(roomId).emit('peer-joined', {
            userId: socket.deviceId,
            socketId: socket.id,
            clientType: socket.clientType,
            originalUserId: socket.userId
        });
        
        // Send existing peers to new joiner
        const existingPeers = room.getPeers()
            .filter(peer => peer.userId !== socket.deviceId)
            .map(peer => ({
                userId: peer.userId,
                socketId: peer.socketId,
                clientType: peer.clientType,
                originalUserId: peer.originalUserId,
                models: peer.models || [],
                batteryState: peer.batteryState
            }));
        
        socket.emit('existing-peers', existingPeers);
        
        console.log(`Device ${socket.deviceId} (user: ${socket.userId}) joined room ${roomId}, ${room.getPeerCount()} total peers`);
    });
    
    // Handle WebRTC signaling
    socket.on('webrtc-signal', (data) => {
        // Handle both 'to' and 'targetUserId' fields for compatibility
        const targetDeviceId = data.to || data.targetUserId;
        const signalData = data.data || data.signal;
        
        const targetSocket = userSockets.get(targetDeviceId);
        
        if (targetSocket) {
            targetSocket.emit('webrtc-signal', {
                fromUserId: socket.deviceId,
                signal: signalData
            });
        } else {
            socket.emit('error', ErrorMessage.peerNotFound(targetDeviceId).toJSON());
        }
    });
    
    // Handle peer discovery requests
    socket.on('request-peer-list', () => {
        const roomId = 'global';
        const room = rooms.get(roomId);
        
        if (room) {
            const peers = room.getPeers()
                .filter(peer => peer.userId !== socket.deviceId);
            socket.emit('peer-list', peers);
        } else {
            socket.emit('peer-list', []);
        }
    });
    
    // Handle model announcements
    socket.on('announce-models', (data) => {
        console.log(`Model announcement from ${socket.deviceId}: ${data.models?.length || 0} models`);
        const roomId = 'global';
        
        // Store models for this peer
        if (!peerInfo.models) {
            peerInfo.models = [];
        }
        peerInfo.models = data.models || [];
        peerInfo.batteryState = data.batteryState;
        
        // Broadcast to all peers in the same account
        socket.to(roomId).emit('peer-models-updated', {
            userId: socket.deviceId,
            models: data.models || [],
            batteryState: data.batteryState,
            clientType: socket.clientType
        });
    });
    
    // Handle model requests
    socket.on('request-models', (targetUserId) => {
        const targetSocket = userSockets.get(targetUserId);
        if (targetSocket) {
            targetSocket.emit('models-requested', {
                fromUserId: socket.deviceId
            });
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
        console.log(`Device disconnected: ${socket.deviceId} (user: ${socket.userId}, type: ${socket.clientType}, reason: ${reason})`);
        userSockets.delete(socket.deviceId);
        
        // Remove from all rooms
        for (const [roomId, room] of rooms.entries()) {
            if (room.removePeer(socket.deviceId)) {
                // Notify other peers
                socket.to(roomId).emit('peer-left', {
                    userId: socket.deviceId,
                    clientType: socket.clientType,
                    originalUserId: socket.userId
                });
                
                // Clean up empty rooms
                if (room.isEmpty()) {
                    rooms.delete(roomId);
                }
            }
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        roomCount: rooms.size,
        connectedUsers: userSockets.size 
    });
});

// Twilio TURN token endpoint - requires authentication
app.post('/turn-token', async (req, res) => {
    try {
        // Verify Firebase auth token
        // Simple auth key check
        if (AUTH_KEY) {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            
            const providedKey = authHeader.split('Bearer ')[1];
            if (providedKey !== AUTH_KEY) {
                return res.status(401).json({ error: 'Invalid auth key' });
            }
        }
        
        // Check if Twilio is configured
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.log('Twilio not configured, returning fallback TURN servers');
            
            const iceServers = [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ];
            
            // Add Metered TURN servers if configured
            if (process.env.METERED_TURN_USERNAME && process.env.METERED_TURN_CREDENTIAL) {
                const meteredServers = (process.env.METERED_TURN_SERVERS || 'turn:a.relay.metered.ca:80,turn:a.relay.metered.ca:443').split(',');
                meteredServers.forEach(server => {
                    iceServers.push({
                        urls: server.trim(),
                        username: process.env.METERED_TURN_USERNAME,
                        credential: process.env.METERED_TURN_CREDENTIAL
                    });
                    // Add TCP variant
                    if (!server.includes('transport=')) {
                        iceServers.push({
                            urls: server.trim() + '?transport=tcp',
                            username: process.env.METERED_TURN_USERNAME,
                            credential: process.env.METERED_TURN_CREDENTIAL
                        });
                    }
                });
            }
            
            // Add custom TURN servers if configured
            if (process.env.CUSTOM_TURN_USERNAME && process.env.CUSTOM_TURN_CREDENTIAL && process.env.CUSTOM_TURN_SERVERS) {
                const customServers = process.env.CUSTOM_TURN_SERVERS.split(',');
                customServers.forEach(server => {
                    iceServers.push({
                        urls: server.trim(),
                        username: process.env.CUSTOM_TURN_USERNAME,
                        credential: process.env.CUSTOM_TURN_CREDENTIAL
                    });
                });
            }
            
            // If no TURN servers configured at all, log warning
            const hasTurnServers = iceServers.some(server => 
                server.urls && (typeof server.urls === 'string' ? server.urls : server.urls[0]).startsWith('turn:')
            );
            
            if (!hasTurnServers) {
                console.warn('WARNING: No TURN servers configured. P2P connections may fail behind strict NATs.');
                console.warn('Configure either Twilio or fallback TURN servers in environment variables.');
            }
            
            return res.json({
                ice_servers: iceServers,
                ttl: 86400
            });
        }
        
        // Create Twilio client and generate token
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const turnToken = await twilioClient.tokens.create({
            ttl: 3600 // 1 hour TTL
        });
        
        console.log(`Generated TURN token for user ${decodedToken.uid}`);
        
        // The Twilio response structure varies by SDK version
        // Check for ice_servers or iceServers property
        let iceServers = turnToken.ice_servers || turnToken.iceServers;
        
        // If no ice servers in response, construct them from credentials
        if (!iceServers && turnToken.username && turnToken.password) {
            console.log('Constructing ice_servers from Twilio credentials');
            iceServers = [
                {
                    urls: 'stun:global.stun.twilio.com:3478'
                },
                {
                    urls: 'turn:global.turn.twilio.com:3478?transport=udp',
                    username: turnToken.username,
                    credential: turnToken.password
                },
                {
                    urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
                    username: turnToken.username,
                    credential: turnToken.password
                },
                {
                    urls: 'turn:global.turn.twilio.com:443?transport=tcp',
                    username: turnToken.username,
                    credential: turnToken.password
                }
            ];
        }
        
        // Ensure we have valid ice servers
        if (!iceServers || !Array.isArray(iceServers)) {
            throw new Error('Failed to get ice_servers from Twilio response');
        }
        
        // Return the properly formatted response
        res.json({
            ice_servers: iceServers,
            ttl: parseInt(turnToken.ttl) || 3600
        });
        
    } catch (error) {
        console.error('Error generating TURN token:', error);
        res.status(500).json({ error: 'Failed to generate TURN token' });
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});