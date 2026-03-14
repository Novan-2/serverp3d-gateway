import pkg from '@whiskeysockets/baileys';
const baileys = pkg.default || pkg; // Ini kunci utamanya

// Ekstraksi fungsi dengan pengecekan aman
const makeWASocket = baileys.makeWASocket || baileys.default;
const { 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeInMemoryStore 
} = baileys;

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
const port = process.env.PORT || 3000;

const io = new Server(server, {
    path: '/socket.io/',
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const logger = pino({ level: 'silent' });

// Pengecekan ekstra agar tidak crash di baris 34 lagi
const store = (typeof makeInMemoryStore === 'function') 
    ? makeInMemoryStore({ logger }) 
    : null;

let latestQR = null;
let sock = null;

app.get('/status', (req, res) => {
    res.json({
        status: sock?.user ? 'connected' : 'disconnected',
        qr: latestQR,
        device: sock?.user || null
    });
});

app.get('/', (req, res) => res.send('ServerP3D Gateway Active'));

async function connectToWhatsApp() {
    // Pastikan fungsi tersedia sebelum dijalankan
    if (typeof useMultiFileAuthState !== 'function') {
        console.error("Fatal Error: useMultiFileAuthState bukan fungsi!");
        return;
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_serverp3d');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger,
        auth: state,
        printQRInTerminal: true,
        browser: ['ServerP3D', 'Chrome', '1.0.0'],
    });

    if (store) store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            latestQR = qr;
            io.emit('qr', { qr });
            console.log("QR Code Ready.");
        }

        if (connection === 'close') {
            const shouldReconnect = (new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            latestQR = null;
            io.emit('connection-open', { user: sock.user });
            console.log('WhatsApp Terhubung!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

server.listen(port, '0.0.0.0', () => {
    console.log(`Web Server running on port ${port}`);
    connectToWhatsApp().catch(err => console.error("Error utama:", err));
});
