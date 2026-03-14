import * as wa from "./whatsapp.js";
import 'dotenv/config';
import express from "express";
import http from "http";
import { Server } from "socket.io";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
const server = http.createServer(app);

// 1. Tambahkan middleware CORS standar Express
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
}));

app.use(bodyParser.urlencoded({ extended: false, limit: "50mb" }));
app.use(bodyParser.json());

// 2. Konfigurasi Socket.io yang lebih kompatibel dengan Proxy Cloud
const io = new Server(server, {
    path: '/socket.io/',
    connectTimeout: 45000,
    pingInterval: 10000,
    pingTimeout: 5000,
    allowEIO3: true, // Mendukung socket.io versi lama jika Laravel menggunakan client lama
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'] // Paksa websocket jika polling gagal
});

// Port dinamis Railway
const port = process.env.PORT || 3000;

// Hubungkan ke whatsapp.js
if (typeof wa.setSocketIO === 'function') {
    wa.setSocketIO(io);
}

io.on('connection', (socket) => {
    console.log("Client Connected: " + socket.id);

    // Langsung panggil connectToWhatsApp jika socket terhubung
    // Ini membantu jika trigger dari Laravel telat sampai
    wa.connectToWhatsApp(null, io);

    socket.on('StartConnection', (data) => {
        wa.connectToWhatsApp(data, io);
    });

    socket.on('disconnect', (reason) => {
        console.log('Client Disconnected:', socket.id, "Reason:", reason);
    });
});

// 3. Tambahkan Route pengecekan manual
app.get('/test-socket', (req, res) => {
    res.send('Socket Server is Ready');
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Server MPWA aktif di port: ${port}`);
});
