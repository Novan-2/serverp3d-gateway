import pkg from 'baileys';
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    // Kita ambil store secara manual jika destructing gagal
} = pkg;

// Solusi untuk TypeError: makeInMemoryStore is not a function
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

app.use(cors());
app.use(bodyParser.json());

// Inisialisasi store dengan pengecekan
const logger = pino({ level: 'silent' });
const store = makeInMemoryStore ? makeInMemoryStore({ logger }) : null;

async function startServerP3D() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_serverp3d');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: true,
        auth: state,
        browser: ['ServerP3D Gateway', 'Chrome', '1.0.0'],
    });

    if (store) store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('--- SCAN QR DIBAWAH ---');
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startServerP3D();
        } else if (connection === 'open') {
            console.log('ServerP3D Gateway: TERHUBUNG!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const pesanText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (pesanText?.toLowerCase() === 'ping') {
            await sock.sendMessage(remoteJid, { text: 'Pong! ServerP3D siap.' });
        }
    });

    // Endpoint API
    app.post('/send-message', async (req, res) => {
        const { number, message } = req.body;
        try {
            const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: message });
            res.status(200).json({ status: true });
        } catch (error) {
            res.status(500).json({ status: false, error: error.message });
        }
    });

    app.get('/', (req, res) => res.send('ServerP3D Gateway Active'));

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

startServerP3D().catch(err => console.error("Critical Error:", err));
