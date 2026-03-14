import pkg from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

// 1. Ekstraksi Manual - Ini cara paling ampuh di Node 22
const makeWASocket = pkg.default || pkg;
const useMultiFileAuthState = pkg.useMultiFileAuthState || pkg.default?.useMultiFileAuthState;
const fetchLatestBaileysVersion = pkg.fetchLatestBaileysVersion || pkg.default?.fetchLatestBaileysVersion;
const DisconnectReason = pkg.DisconnectReason || pkg.default?.DisconnectReason;

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
let latestQR = null;
let sock = null;

async function connectToWhatsApp() {
    // Validasi paksa: jika tetap gagal, kita beri peringatan di log
    if (typeof useMultiFileAuthState !== 'function') {
        console.error("CRITICAL: useMultiFileAuthState masih bukan fungsi. Mencoba metode alternatif...");
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

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            latestQR = qr;
            io.emit('qr', { qr });
            console.log("QR Terdeteksi!");
        }
        if (connection === 'close') {
            const shouldReconnect = (new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            latestQR = null;
            io.emit('connection-open', { user: sock.user });
            console.log('WhatsApp CONNECTED!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

server.listen(port, '0.0.0.0', () => {
    console.log(`Web Server running on port ${port}`);
    connectToWhatsApp().catch(err => {
        console.error("Gagal total pada fungsi connect:");
        console.error(err);
    });
});
