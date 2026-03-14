import pkg from 'baileys';
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = pkg;

// Fix integrasi store untuk environment ESM
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
// Mengambil PORT dari Railway Environment
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const logger = pino({ level: 'silent' });
const store = makeInMemoryStore ? makeInMemoryStore({ logger }) : null;

// Variabel penampung status
let latestQR = null;
let sock = null;

async function startServerP3D() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_serverp3d');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: true,
        auth: state,
        browser: ['ServerP3D Gateway', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
    });

    if (store) store.bind(sock.ev);

    // Monitoring Koneksi
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            latestQR = qr;
            console.log('--- SCAN QR CODE DIBAWAH ---');
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Reconnecting...', shouldReconnect);
            if (shouldReconnect) startServerP3D();
        } else if (connection === 'open') {
            latestQR = null;
            console.log('ServerP3D Gateway: TERHUBUNG!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Endpoint API untuk pengecekan status
    app.get('/status', (req, res) => {
        res.json({
            status: sock?.user ? 'connected' : 'disconnected',
            qr: latestQR,
            device: sock?.user || null
        });
    });

    // Endpoint untuk kirim pesan dari Laravel
    app.post('/send-message', async (req, res) => {
        const { number, message } = req.body;
        if (!number || !message) {
            return res.status(400).json({ status: false, error: 'Nomor dan pesan tidak boleh kosong' });
        }
        try {
            const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: message });
            res.status(200).json({ status: true, msg: 'Pesan terkirim ke ' + jid });
        } catch (error) {
            res.status(500).json({ status: false, error: error.message });
        }
    });

    app.get('/', (req, res) => res.send('ServerP3D Gateway Active & Online'));

}

// Menjalankan Express Server di IP 0.0.0.0 (Wajib untuk Railway)
app.listen(port, '0.0.0.0', () => {
    console.log(`Web Server running on port ${port}`);
    startServerP3D().catch(err => console.error("Critical Error:", err));
});
