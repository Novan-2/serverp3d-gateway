import pkg from '@whiskeysockets/baileys';
// Cara akses library paling aman untuk Node.js versi terbaru (v22)
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeInMemoryStore 
} = pkg;

import { Boom } from '@hapi/boom';
import pino from 'pino';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3100;

// Konfigurasi Socket.io untuk komunikasi Real-time dengan Laravel
const io = new Server(server, {
    path: '/socket.io/',
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

const logger = pino({ level: 'silent' });
const store = makeInMemoryStore({ logger });

let latestQR = null;
let sock = null;

// Route cek status di browser
app.get('/status', (req, res) => {
    res.json({
        status: sock?.user ? 'connected' : 'disconnected',
        qr: latestQR,
        device: sock?.user || null
    });
});

app.get('/', (req, res) => res.send('ServerP3D Gateway Active pada Port ' + port));

// Fungsi Utama Koneksi WhatsApp
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_serverp3d');
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            logger,
            auth: state,
            printQRInTerminal: true,
            browser: ['ServerP3D', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
        });

        store.bind(sock.ev);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                latestQR = qr;
                // Kirim QR ke Dashboard Laravel lewat Socket.io
                io.emit('qr', { qr });
                console.log("QR Code diperbarui.");
            }

            if (connection === 'close') {
                const shouldReconnect = (new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log("Mencoba menyambung ulang...");
                    connectToWhatsApp();
                }
            } else if (connection === 'open') {
                latestQR = null;
                io.emit('connection-open', { user: sock.user });
                console.log('WhatsApp Terhubung!');
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error("Gagal menjalankan Baileys:", error);
    }
}

// Event Socket.io saat browser Laravel terhubung
io.on('connection', (socket) => {
    console.log('Client terhubung ke Socket:', socket.id);
    if (latestQR) {
        socket.emit('qr', { qr: latestQR });
    }
});

// Jalankan Server
server.listen(port, '0.0.0.0', () => {
    console.log(`Web Server running on port ${port}`);
    connectToWhatsApp();
});
