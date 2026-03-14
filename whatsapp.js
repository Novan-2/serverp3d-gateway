import { Boom } from '@hapi/boom';
import pino from 'pino';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3100;

const io = new Server(server, {
    path: '/socket.io/',
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/json' }));

const logger = pino({ level: 'silent' });
let latestQR = null;
let sock = null;

// ✅ DYNAMIC IMPORT - Work di SEMUA versi Baileys
let baileys;
async function loadBaileys() {
    if (!baileys) {
        try {
            baileys = await import('@whiskeysockets/baileys');
            console.log("✅ Baileys loaded:", baileys.default?.version || 'unknown');
        } catch (error) {
            console.error("❌ Baileys import failed:", error.message);
            throw error;
        }
    }
    return baileys;
}

async function connectToWhatsApp() {
    try {
        console.log("🔄 Loading Baileys...");
        const baileys = await loadBaileys();
        
        // ✅ UNIVERSAL COMPATIBILITY - Work semua versi
        let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers;
        
        if (baileys.default) {
            // ESM Default Export (v6+)
            const pkg = baileys.default;
            makeWASocket = pkg.default || pkg.makeWASocket || pkg;
            useMultiFileAuthState = pkg.useMultiFileAuthState;
            DisconnectReason = pkg.DisconnectReason;
            fetchLatestBaileysVersion = pkg.fetchLatestBaileysVersion;
            Browsers = pkg.Browsers;
        } else {
            // Named Exports (versi lama)
            makeWASocket = baileys.makeWASocket || baileys.default;
            useMultiFileAuthState = baileys.useMultiFileAuthState;
            DisconnectReason = baileys.DisconnectReason;
            fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
            Browsers = baileys.Browsers;
        }

        // ✅ FINAL CHECK
        if (typeof useMultiFileAuthState !== 'function') {
            throw new Error(`useMultiFileAuthState not function. Available: ${Object.keys(baileys.default || baileys)}`);
        }

        console.log("✅ All functions loaded!");
        
        const authPath = path.join(__dirname, 'auth_info_serverp3d');
        console.log("📁 Auth path:", authPath);

        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        
        let version = [2, 3004, 9]; // Default version
        try {
            const latest = await fetchLatestBaileysVersion();
            version = latest.version;
        } catch {}

        sock = makeWASocket({
            version,
            logger,
            auth: state,
            printQRInTerminal: process.env.NODE_ENV !== 'production',
            browser: Browsers ? Browsers.whatsappWeb() : ['ServerP3D', 'Chrome', '1.0.0']
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, user } = update;
            
            if (qr) {
                latestQR = qr;
                io.emit('qr', { qr });
                console.log("📱 QR Code ready!");
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason?.loggedOut;
                
                console.log('🔌 Disconnected:', statusCode);
                
                if (shouldReconnect) {
                    setTimeout(connectToWhatsApp, 3000);
                }
            } 
            else if (connection === 'open') {
                latestQR = null;
                io.emit('open', { user: user?.name || 'Connected' });
                console.log('✅ WhatsApp CONNECTED!');
            }
        });

    } catch (error) {
        console.error("💥 Connect failed:", error.message);
        setTimeout(connectToWhatsApp, 5000);
    }
}

// Routes
app.get('/health', (req, res) => res.json({ status: 'OK', connected: !!sock }));
app.get('/status', (req, res) => res.json({ connected: !!sock }));

server.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Server on port ${port}`);
    connectToWhatsApp();
});
