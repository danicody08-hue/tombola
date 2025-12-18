const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Stato del gioco
let gameState = {
  extractedNumbers: [],
  currentNumber: null,
  previousNumber: null,
  gameStatus: 'waiting',
  players: {},
  adminConnected: false,
  winners: []
};

// Genera cartella tombola (3x9 con 5 numeri per riga)
function generateTombolaCard() {
  const card = [];
  const allNumbers = [];
  
  for (let i = 0; i < 15; i++) {
    let col = Math.floor(i / 3);
    let min = col * 10 + 1;
    let max = col * 10 + 10;
    
    if (col === 0) min = 1;
    if (col === 4) max = 90;
    
    let num;
    do {
      num = Math.floor(Math.random() * (max - min + 1)) + min;
    } while (allNumbers.includes(num));
    
    allNumbers.push(num);
  }
  
  allNumbers.sort((a, b) => a - b);
  
  for (let row = 0; row < 3; row++) {
    const rowNumbers = [];
    for (let col = 0; col < 9; col++) {
      const colNumbers = allNumbers.filter(num => Math.floor((num - 1) / 10) === col);
      if (colNumbers[row]) {
        rowNumbers.push(colNumbers[row]);
      } else {
        rowNumbers.push(null);
      }
    }
    card.push(rowNumbers);
  }
  
  return card;
}

function extractNumber() {
  if (gameState.extractedNumbers.length >= 90) {
    gameState.gameStatus = 'finished';
    return null;
  }
  
  let number;
  do {
    number = Math.floor(Math.random() * 90) + 1;
  } while (gameState.extractedNumbers.includes(number));
  
  gameState.previousNumber = gameState.currentNumber;
  gameState.extractedNumbers.push(number);
  gameState.currentNumber = number;
  
  if (gameState.gameStatus === 'waiting') {
    gameState.gameStatus = 'playing';
  }
  
  return number;
}

function checkWins(playerId) {
  const player = gameState.players[playerId];
  if (!player) return [];
  
  const wins = [];
  const card = player.card;
  const markedNumbers = player.markedNumbers;
  
  for (let row = 0; row < 3; row++) {
    const rowNumbers = card[row].filter(n => n !== null);
    const markedInRow = rowNumbers.filter(n => markedNumbers.includes(n)).length;
    
    if (markedInRow >= 2 && !player.ambo) {
      wins.push('ambo');
      player.ambo = true;
    }
    if (markedInRow >= 3 && !player.terno) {
      wins.push('terno');
      player.terno = true;
    }
    if (markedInRow >= 4 && !player.quaterna) {
      wins.push('quaterna');
      player.quaterna = true;
    }
    if (markedInRow >= 5 && !player.cinquina) {
      wins.push('cinquina');
      player.cinquina = true;
    }
  }
  
  if (markedNumbers.length >= 15 && !player.tombola) {
    wins.push('tombola');
    player.tombola = true;
    gameState.gameStatus = 'finished';
  }
  
  return wins;
}

function initializePlayer(playerId, playerName) {
  const card = generateTombolaCard();
  gameState.players[playerId] = {
    id: playerId,
    name: playerName,
    card: card,
    markedNumbers: [],
    ambo: false,
    terno: false,
    quaterna: false,
    cinquina: false,
    tombola: false,
    joinedAt: new Date()
  };
  return card;
}

// Socket.io
io.on('connection', (socket) => {
  console.log('Nuova connessione:', socket.id);
  
  socket.emit('game-state', gameState);
  
  socket.on('admin-join', () => {
    gameState.adminConnected = true;
    socket.join('admin');
    socket.emit('admin-status', true);
    io.emit('game-state', gameState);
  });
  
  socket.on('player-join', (playerName) => {
    if (!playerName || playerName.trim() === '') {
      socket.emit('error', 'Nome non valido');
      return;
    }
    
    const card = initializePlayer(socket.id, playerName.trim());
    socket.emit('your-card', card);
    io.emit('game-state', gameState);
  });
  
  socket.on('extract-number', () => {
    if (socket.rooms.has('admin') && gameState.gameStatus !== 'finished') {
      const number = extractNumber();
      if (number) {
        const extractedData = {
          current: number,
          previous: gameState.previousNumber,
          totalExtracted: gameState.extractedNumbers.length
        };
        
        io.emit('number-extracted', extractedData);
        io.emit('game-state', gameState);
        
        io.emit('new-number', {
          number: number,
          message: `È stato estratto il numero ${number}!`
        });
      }
    }
  });
  
  socket.on('mark-number', (number) => {
    const player = gameState.players[socket.id];
    
    if (!player) {
      socket.emit('error', 'Giocatore non trovato');
      return;
    }
    
    if (!gameState.extractedNumbers.includes(number)) {
      socket.emit('error', 'Questo numero non è stato estratto!');
      return;
    }
    
    if (!player.markedNumbers.includes(number)) {
      player.markedNumbers.push(number);
      
      const wins = checkWins(socket.id);
      
      if (wins.length > 0) {
        socket.emit('you-won', wins);
        io.emit('player-won', {
          playerId: socket.id,
          playerName: player.name,
          wins: wins,
          timestamp: new Date()
        });
      }
      
      io.emit('game-state', gameState);
      socket.emit('number-marked', number);
    }
  });
  
  socket.on('reset-game', () => {
    if (socket.rooms.has('admin')) {
      gameState = {
        extractedNumbers: [],
        currentNumber: null,
        previousNumber: null,
        gameStatus: 'waiting',
        players: {},
        adminConnected: gameState.adminConnected,
        winners: []
      };
      
      io.emit('game-reset', { message: 'Il gioco è stato resettato!' });
      io.emit('game-state', gameState);
    }
  });
  
  socket.on('disconnect', () => {
    if (socket.rooms.has('admin')) {
      gameState.adminConnected = false;
    }
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
    }
    io.emit('game-state', gameState);
  });
});

// Rotta principale
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server Tombola Natalizia sulla porta ${PORT}`);
});
