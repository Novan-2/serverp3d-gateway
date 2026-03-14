import pkg from 'baileys';
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = pkg;

// Fix khusus untuk mendapatkan fungsi store di environment ESM
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

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Inisialisasi Logger dan Store
const logger = pino({ level: 'silent' });
const store = makeInMemoryStore ? makeInMemoryStore({ logger }) : null;

// Variable global untuk memantau status QR terbaru
let latestQR = null;

async function startServerP3D() {
    // Session disimpan di folder 'auth_info_serverp3d'
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_serverp3d');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: true,
        auth: state,
        browser: ['ServerP3D Gateway', 'Chrome', '1.0.0'],
        // Optimasi koneksi untuk server luar (Railway)
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: true,
    });

    if (store) store.bind(sock.ev);

    // Pemantauan Koneksi
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

    // Simpan data login otomatis
    sock.ev.on('creds.update', saveCreds);

    // Logika Pesan Masuk
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const pesanText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        // Auto-reply sederhana agar user tahu bot aktif
        if (pesanText?.toLowerCase() === 'ping') {
            await sock.sendMessage(remoteJid, { text: 'Pong! ServerP3D siap melayani.' });
        }
    });

    // --- ENDPOINT API UNTUK LARAVEL ---

    // Endpoint: Cek Status Bot
    app.get('/status', (req, res) => {
        res.json({
            status: sock.user ? 'connected' : 'disconnected',
            qr: latestQR,
            device: sock.user || null
        });
    });

    // Endpoint: Kirim Pesan
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

    // Route Utama
    app.get('/', (req, res) => res.send('ServerP3D Gateway Active & Online'));

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

// Jalankan bot dengan error handling
startServerP3D().catch(err => console.error("Critical Error:", err));
