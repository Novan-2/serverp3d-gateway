import pkg from 'baileys';
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
import qrcodeTerminal from 'qrcode-terminal';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Setup Express
app.use(cors());
app.use(bodyParser.json());

// Store untuk menyimpan data chat sementara di memory
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function startServerP3D() {
    // Folder 'auth_info' akan menyimpan session login agar tidak scan terus
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_serverp3d');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // QR otomatis muncul di log Railway
        auth: state,
        browser: ['ServerP3D Gateway', 'MacOS', '3.0'],
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.templateMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2
                            },
                            ...message
                        }
                    }
                };
            }
            return message;
        }
    });

    store.bind(sock.ev);

    // Update koneksi
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('--- SCAN QR DI LOG RAILWAY ---');
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Reconnecting...', shouldReconnect);
            if (shouldReconnect) startServerP3D();
        } else if (connection === 'open') {
            console.log('ServerP3D Gateway: TERHUBUNG!');
        }
    });

    // Simpan kredensial
    sock.ev.on('creds.update', saveCreds);

    // Tangani pesan masuk
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const pesanText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        console.log(`Pesan masuk dari ${remoteJid}: ${pesanText}`);

        if (pesanText?.toLowerCase() === 'ping') {
            await sock.sendMessage(remoteJid, { text: 'Pong! ServerP3D Gateway aktif.' });
        }
    });

    // --- API ENDPOINT (Agar bisa kirim pesan dari Laravel/Web lain) ---
    app.post('/send-message', async (req, res) => {
        const { number, message } = req.body;
        
        try {
            const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: message });
            res.status(200).json({ status: true, message: 'Pesan terkirim' });
        } catch (error) {
            res.status(500).json({ status: false, error: error.message });
        }
    });

    app.get('/', (req, res) => {
        res.send('ServerP3D Gateway is running.');
    });

    app.listen(port, () => {
        console.log(`API ServerP3D running on port ${port}`);
    });
}

// Jalankan bot
startServerP3D().catch(err => console.error("Error starting bot:", err));
