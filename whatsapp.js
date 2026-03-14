import pkg from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// ✅ FIX IMPORT ESM untuk Node 22
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ IMPORT LENGKAP & AMAN - Work di semua versi Baileys
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers
} = pkg;

// Fallback jika import gagal (untuk versi lama)
const safeUseMultiFileAuthState = useMultiFileAuthState || (() => {
    throw new Error('useMultiFileAuthState not available. Install @whiskeysockets/baileys@latest');
});

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3100;

const io = new Server(server, {
    path: '/socket.io/',
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true 
    }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/json' }));

const logger = pino({ level: 'silent' });
let latestQR = null;
let sock = null;

async function connectToWhatsApp() {
    try {
        console.log("🔄 Menghubungkan ke WhatsApp...");
        
        // Pastikan folder auth ada
        const authPath = path.join(__dirname, 'auth_info_serverp3d');
        console.log("📁 Auth path:", authPath);

        const { state, saveCreds } = await safeUseMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            logger,
            auth: state,
            printQRInTerminal: process.env.NODE_ENV !== 'production',
            browser: Browsers.whatsappWeb(),
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            shouldIgnoreJid: jid => jid === 'status@broadcast'
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, user } = update;
            
            if (qr) {
                latestQR = qr;
                io.emit('qr', { qr });
                console.log("📱 QR Code generated!");
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log('🔌 Connection closed:', statusCode, DisconnectReason[statusCode] || statusCode);
                
                if (shouldReconnect) {
                    setTimeout(() => connectToWhatsApp(), 5000);
                } else {
                    console.log('❌ Logged out. Please scan QR again.');
                    io.emit('logged-out');
                }
            } 
            else if (connection === 'open') {
                latestQR = null;
                io.emit('connection-open', { 
                    user: user?.name || user?.verifiedName || 'Unknown',
                    id: user?.id 
                });
                console.log('✅ WhatsApp Connected!');
                console.log('👤 User:', user?.name || user?.verifiedName);
            }
        });

        // Handle messages
        sock.ev.on('messages.upsert', ({ messages }) => {
            const msg = messages[0];
            if (!msg.key.fromMe && msg.message) {
                io.emit('message', {
                    key: msg.key,
                    message: msg.message,
                    pushName: msg.pushName
                });
            }
        });

    } catch (error) {
        console.error("❌ Gagal connect WhatsApp:", error.message);
        console.error("💡 Install: npm i @whiskeysockets/baileys@latest");
        setTimeout(() => connectToWhatsApp(), 10000);
    }
}

// API Endpoints
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        connected: !!sock,
        qr: !!latestQR 
    });
});

app.get('/status', (req, res) => {
    res.json({ 
        connected: !!sock && sock.user,
        user: sock?.user 
    });
});

app.post('/send-message', async (req, res) => {
    try {
        if (!sock) return res.status(400).json({ error: 'Not connected' });
        
        const { number, message } = req.body;
        const jid = number + '@s.whatsapp.net';
        
        await sock.sendMessage(jid, { text: message });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web Server running on port ${port}`);
    console.log(`🔗 Socket.IO ready on /socket.io/`);
    
    // Mulai koneksi WhatsApp
    connectToWhatsApp();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    sock?.end();
    server.close(() => {
        process.exit(0);
    });
});
