// File: server/index.js - MODIFICATO per produzione
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configura CORS per produzione
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false  // Render gestirà l'origine
      : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Servi i file statici dalla build di React
app.use(express.static(path.join(__dirname, '../client/build')));

// Stato del gioco (come prima)
let gameState = {
  extractedNumbers: [],
  currentNumber: null,
  gameStatus: 'waiting',
  prizes: {
    ambo: false,
    terno: false,
    quaterna: false,
    cinquina: false,
    tombola: false
  },
  players: {},
  adminConnected: false
};

// ... (tutte le funzioni rimangono uguali: generateTombolaCard, extractNumber, checkWins)

// Socket.io handlers (rimangono uguali)
io.on('connection', (socket) => {
  console.log('Nuova connessione:', socket.id);
  
  // Invio stato iniziale
  socket.emit('game-state', gameState);
  
  // ... (tutto il resto del codice socket.io rimane uguale)
});

// IMPORTANTE: Rotta per tutte le altre richieste (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
