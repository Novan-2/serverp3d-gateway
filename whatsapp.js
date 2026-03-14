import baileys from '@whiskeysockets/baileys';
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeInMemoryStore 
} = baileys;

import { Boom } from '@hapi/boom';
import pino from 'pino';
import express from 'express';
import qrcodeTerminal from 'qrcode-terminal';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000; // Railway akan mengisi ini otomatis

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

const logger = pino({ level: 'silent' });
const store = makeInMemoryStore({ logger });

let latestQR = null;
let sock = null;
let socketIO = null; // Untuk mengirim data ke Laravel

// Fungsi untuk menghubungkan ke Socket.io dari server.js
export const setSocketIO = (io) => {
    socketIO = io;
};

app.get('/status', (req, res) => {
    res.json({
        status: sock?.user ? 'connected' : 'disconnected',
        qr: latestQR,
        device: sock?.user || null
    });
});

app.get('/', (req, res) => res.send('ServerP3D Gateway Online'));

// Export fungsi agar bisa dipanggil oleh server.js
export async function connectToWhatsApp(data = null, io = null) {
    if (io) socketIO = io;
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_serverp3d');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger,
        auth: state,
        printQRInTerminal: true,
        browser: ['ServerP3D Gateway', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
    });

    store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            latestQR = qr;
            qrcodeTerminal.generate(qr, { small: true });
            // Kirim QR ke Dashboard Laravel melalui Socket.io
            if (socketIO) {
                socketIO.emit('qr', { qr });
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            latestQR = null;
            console.log('ServerP3D Gateway: TERHUBUNG!');
            if (socketIO) {
                socketIO.emit('connection-open', { user: sock.user });
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
    return sock;
}

// Hanya jalankan app.listen jika file ini dijalankan langsung
if (import.meta.url === `file://${process.argv[1]}`) {
    app.listen(port, '0.0.0.0', () => {
        console.log(`Web Server running on port ${port}`);
        connectToWhatsApp().catch(err => console.error("Error:", err));
    });
}
