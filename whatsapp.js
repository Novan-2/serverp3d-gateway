import baileys from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import express from 'express';
import qrcodeTerminal from 'qrcode-terminal';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

// Cara akses Baileys yang paling aman untuk ES Module
const makeWASocket = baileys.default || baileys;
const useMultiFileAuthState = baileys.useMultiFileAuthState;
const DisconnectReason = baileys.DisconnectReason;
const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
const makeInMemoryStore = baileys.makeInMemoryStore;

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

const logger = pino({ level: 'silent' });

// Pastikan store tidak bikin crash kalau fungsi gagal di-load
const store = typeof makeInMemoryStore === 'function' ? makeInMemoryStore({ logger }) : null;

let latestQR = null;
let sock = null;
let socketIO = null;

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

    if (store) store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            latestQR = qr;
            qrcodeTerminal.generate(qr, { small: true });
            if (socketIO) socketIO.emit('qr', { qr });
        }

        if (connection === 'close') {
            const shouldReconnect = (new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            latestQR = null;
            console.log('ServerP3D Gateway: TERHUBUNG!');
            if (socketIO) socketIO.emit('connection-open', { user: sock.user });
        }
    });

    sock.ev.on('creds.update', saveCreds);
    return sock;
}

app.listen(port, '0.0.0.0', () => {
    console.log(`Web Server running on port ${port}`);
    connectToWhatsApp().catch(err => console.error("Error:", err));
});
