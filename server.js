import * as wa from "./whatsapp.js"; // Mengarah langsung ke whatsapp.js di root

import 'dotenv/config';

import express from "express";

import http from "http";

import { Server } from "socket.io";

import bodyParser from "body-parser";



const app = express();

const server = http.createServer(app);



// --- KONFIGURASI SOCKET.IO & CORS ---

const io = new Server(server, {

  path: '/socket.io/',

  pingInterval: 25000,

  pingTimeout: 10000,

  cors: {

    origin: "*", // Mengizinkan akses dari serverp3d.xyz

    methods: ["GET", "POST"],

    credentials: true

  },

  allowEIO3: true 

});



// Gunakan port dinamis dari Railway atau default 3000

const port = process.env.PORT || 3000;



// Middleware agar Socket.io bisa diakses di route Express jika perlu

app.use((req, res, next) => {

  res.set("Cache-Control", "no-store");

  req.io = io;

  next();

});



app.use(bodyParser.urlencoded({ extended: false, limit: "50mb" }));

app.use(bodyParser.json());



// Menghubungkan Socket.io ke logika whatsapp.js

// Pastikan fungsi setSocketIO ada di dalam whatsapp.js Anda

if (typeof wa.setSocketIO === 'function') {

    wa.setSocketIO(io);

}



// --- EVENT LISTENER UNTUK FRONTEND LARAVEL ---

io.on('connection', (socket) => {

    console.log("User terhubung ke Socket: " + socket.id);



    socket.on('StartConnection', (data) => {

        wa.connectToWhatsApp(data, io);

    });



    socket.on('disconnect', () => {

        console.log('User terputus:', socket.id);

    });

});



// Jalankan Server

server.listen(port, () => {

    console.log(`Server MPWA aktif di port: ${port}`);

});
