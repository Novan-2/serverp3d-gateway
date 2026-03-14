const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Inisialisasi Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        handleSIGINT: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Membantu menghemat RAM di Railway
            '--disable-gpu'
        ],
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
    }
});

// Generate QR Code di Terminal (untuk login pertama kali)
client.on('qr', (qr) => {
    console.log('SCAN QR CODE INI UNTUK LOGIN:');
    qrcode.generate(qr, { small: true });
});

// Status Siap
client.on('ready', () => {
    console.log('ServerP3D Gateway - WhatsApp Ready!');
});

// Contoh Logika Pesan Masuk
client.on('message', async (msg) => {
    if (msg.body.toLowerCase() === 'ping') {
        msg.reply('pong');
    }
});

client.initialize();
