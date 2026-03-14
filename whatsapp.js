import pkg from '@whiskeysockets/baileys';
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
} = pkg;

const makeInMemoryStore = pkg.makeInMemoryStore || pkg.default?.makeInMemoryStore;

import { Boom } from '@hapi/boom';
import pino from 'pino';
import express from 'express';
import qrcodeTerminal from 'qrcode-terminal';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// --- PERBAIKAN CORS (SANGAT PENTING) ---
// Ini mengizinkan dashboard serverp3d.xyz mengambil data dari Railway
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

const logger = pino({ level: 'silent' });
const store = typeof makeInMemoryStore === 'function' ? makeInMemoryStore({ logger }) : null;

let latestQR = null;
let sock = null;

// --- ROUTE STATUS (WAJIB DI ATAS) ---
app.get('/status', (req, res) => {
    res.json({
        status: sock?.user ? 'connected' : 'disconnected',
        qr: latestQR,
        device: sock?.user || null
    });
});

app.get('/', (req, res) => res.send('ServerP3D Gateway Online'));

async function startServerP3D() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_serverp3d');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger,
        auth: state,
        printQRInTerminal: true,
        browser: ['ServerP3D Gateway', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
    });

    if (store && sock.ev) store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            latestQR = qr;
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startServerP3D();
        } else if (connection === 'open') {
            latestQR = null;
            console.log('ServerP3D Gateway: TERHUBUNG!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

app.listen(port, '0.0.0.0', () => {
    console.log(`Web Server running on port ${port}`);
    startServerP3D().catch(err => console.error("Error:", err));
});
