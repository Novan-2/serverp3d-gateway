import pkg from '@whiskeysockets/baileys';
// Cara akses paling aman untuk Node 22
const baileys = pkg.default || pkg;

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

const io = new Server(server, {
    path: '/socket.io/',
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const logger = pino({ level: 'silent' });

// FIX ERROR: Cek dulu apakah fungsi ada, jika tidak ada, jangan jalankan agar tidak crash
let store = null;
if (typeof baileys.makeInMemoryStore === 'function') {
    store = baileys.makeInMemoryStore({ logger });
}

let latestQR = null;
let sock = null;

app.get('/status', (req, res) => {
    res.json({
        status: sock?.user ? 'connected' : 'disconnected',
        qr: latestQR,
    });
});

app.get('/', (req, res) => res.send('ServerP3D Gateway Online'));

async function connectToWhatsApp() {
    // Ambil fungsi secara manual dari objek baileys
    const makeWASocket = baileys.default || baileys.makeWASocket || baileys;
    const useMultiFileAuthState = baileys.useMultiFileAuthState;
    const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
    const DisconnectReason = baileys.DisconnectReason;

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
            console.log("QR Ready untuk di-scan");
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
    connectToWhatsApp().catch(err => console.error("Gagal start:", err));
});
