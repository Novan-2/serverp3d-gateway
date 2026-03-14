import * as wa from "./whatsapp.js";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);

// Konfigurasi Socket.io agar sinkron dengan Laravel
const io = new Server(server, {
  path: '/socket.io/',
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Sambungkan Socket ke logika WhatsApp
if (typeof wa.setSocketIO === 'function') {
    wa.setSocketIO(io);
}

const port = process.env.PORT || 3000;

server.listen(port, '0.0.0.0', () => {
    console.log(`Server aktif di port: ${port}`);
    // Jalankan inisialisasi WhatsApp
    wa.connectToWhatsApp(null, io);
});
