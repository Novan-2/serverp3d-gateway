import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    } 
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const port = process.env.PORT || 3100;
let latestQR = null;
let isConnected = false;

// ✅ EventEmitter DI-IMPORT DARI 'events'
class WhatsAppSimulator {
    constructor() {
        this.ev = new EventEmitter();  // ✅ FIXED
        this.user = { 
            id: '628123456789@s.whatsapp.net', 
            name: 'ServerP3D Bot' 
        };
        this.connected = false;
    }

    connect() {
        console.log("🔄 Starting WhatsApp connection...");
        
        // Simulate QR
        setTimeout(() => {
            latestQR = `whatsapp://qr/SERVERP3D_${Date.now()}`;
            io.emit('qr', { qr: latestQR });
            console.log("📱 QR Code generated! Connect via frontend.");
        }, 2000);
        
        // Simulate connection after 10s
        setTimeout(() => {
            this.connected = true;
            isConnected = true;
            this.ev.emit('connection.update', { 
                connection: 'open', 
                user: this.user 
            });
            console.log("✅ WhatsApp Connected!");
        }, 10000);
    }

    async sendMessage(jid, content) {
        console.log(`📤 Message to ${jid}:`, content.text);
        return { key: { remoteJid: jid } };
    }
}

const wa = new WhatsAppSimulator();

// ✅ Event handlers
wa.ev.on('connection.update', (update) => {
    const { connection, qr, user } = update;
    
    if (qr) {
        latestQR = qr;
        io.emit('qr', { qr });
    }
    
    if (connection === 'open') {
        isConnected = true;
        io.emit('connection-open', { user });
        console.log('✅ Bot ready!');
    }
});

// Routes
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        uptime: process.uptime(),
        connected: isConnected,
        qrAvailable: !!latestQR 
    });
});

app.get('/status', (req, res) => {
    res.json({ 
        connected: isConnected,
        user: wa.user,
        qr: latestQR ? 'scan-now' : null
    });
});

app.post('/send-message', async (req, res) => {
    try {
        const { number, message } = req.body;
        const jid = `${number}@s.whatsapp.net`;
        await wa.sendMessage(jid, { text: message });
        res.json({ success: true, jid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Socket.IO
io.on('connection', (socket) => {
    console.log(`👤 Client ${socket.id} connected`);
    
    socket.emit('status', { 
        connected: isConnected, 
        qr: latestQR 
    });
    
    socket.on('scan-complete', () => {
        latestQR = null;
        console.log('📱 QR scanned!');
    });
    
    socket.on('disconnect', () => {
        console.log(`👤 Client ${socket.id} disconnected`);
    });
});

// Start server
server.listen(port, '0.0.0.0', () => {
    console.log(`\n🌐 Server running → http://localhost:${port}`);
    console.log(`🔗 Socket.IO → /socket.io/`);
    console.log(`📱 QR in 2 seconds...\n`);
    
    wa.connect();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    server.close(() => process.exit(0));
});
