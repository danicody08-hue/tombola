// File: server/index.js - Server principale
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Stato del gioco
let gameState = {
  extractedNumbers: [],
  currentNumber: null,
  gameStatus: 'waiting', // waiting, playing, finished
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

// Genera una cartella della tombola (matrice 3x9)
function generateTombolaCard() {
  const card = [];
  for (let row = 0; row < 3; row++) {
    const rowNumbers = [];
    const usedNumbers = new Set();
    
    for (let col = 0; col < 9; col++) {
      let min = col * 10 + 1;
      let max = col * 10 + 10;
      
      // Prima colonna: 1-9
      if (col === 0) min = 1;
      // Ultima colonna: 80-90
      if (col === 8) max = 90;
      
      let num;
      do {
        num = Math.floor(Math.random() * (max - min + 1)) + min;
      } while (usedNumbers.has(num));
      
      usedNumbers.add(num);
      rowNumbers.push(num);
    }
    
    // Ordina i numeri della riga
    rowNumbers.sort((a, b) => a - b);
    
    // Aggiungi 4 celle vuote (posizioni casuali)
    const finalRow = new Array(9).fill(null);
    const positions = [0,1,2,3,4,5,6,7,8].sort(() => Math.random() - 0.5).slice(0,5);
    
    let numIndex = 0;
    for (let i = 0; i < 9; i++) {
      if (positions.includes(i)) {
        finalRow[i] = rowNumbers[numIndex++];
      }
    }
    
    card.push(finalRow);
  }
  return card;
}

// Estrai un numero casuale non ancora estratto
function extractNumber() {
  if (gameState.extractedNumbers.length >= 90) return null;
  
  let number;
  do {
    number = Math.floor(Math.random() * 90) + 1;
  } while (gameState.extractedNumbers.includes(number));
  
  gameState.extractedNumbers.push(number);
  gameState.currentNumber = number;
  return number;
}

// Controlla vincite per un giocatore
function checkWins(playerId, playerCard, markedNumbers) {
  const wins = [];
  const card = gameState.players[playerId].card;
  
  // Controlla ogni riga
  for (let row = 0; row < 3; row++) {
    const rowNumbers = card[row].filter(n => n !== null);
    const markedCount = rowNumbers.filter(n => markedNumbers.includes(n)).length;
    
    if (markedCount === 2 && !gameState.players[playerId].ambo) {
      wins.push('ambo');
      gameState.players[playerId].ambo = true;
    }
    if (markedCount === 3 && !gameState.players[playerId].terno) {
      wins.push('terno');
      gameState.players[playerId].terno = true;
    }
    if (markedCount === 4 && !gameState.players[playerId].quaterna) {
      wins.push('quaterna');
      gameState.players[playerId].quaterna = true;
    }
    if (markedCount === 5 && !gameState.players[playerId].cinquina) {
      wins.push('cinquina');
      gameState.players[playerId].cinquina = true;
    }
    
    // Tombola (tutti i 15 numeri della cartella)
    const totalMarked = markedNumbers.length;
    const totalNumbers = card.flat().filter(n => n !== null).length;
    if (totalMarked === totalNumbers && !gameState.players[playerId].tombola) {
      wins.push('tombola');
      gameState.players[playerId].tombola = true;
      gameState.gameStatus = 'finished';
    }
  }
  
  return wins;
}

// Socket.io handlers
io.on('connection', (socket) => {
  console.log('Nuova connessione:', socket.id);
  
  // Invio stato iniziale
  socket.emit('game-state', gameState);
  
  // Admin si connette
  socket.on('admin-join', () => {
    gameState.adminConnected = true;
    socket.join('admin');
    io.emit('game-state', gameState);
    console.log('Admin connesso');
  });
  
  // Giocatore si unisce
  socket.on('player-join', (playerName) => {
    const card = generateTombolaCard();
    gameState.players[socket.id] = {
      id: socket.id,
      name: playerName,
      card: card,
      markedNumbers: [],
      ambo: false,
      terno: false,
      quaterna: false,
      cinquina: false,
      tombola: false
    };
    
    socket.emit('your-card', card);
    io.emit('game-state', gameState);
  });
  
  // Admin estrae numero
  socket.on('extract-number', () => {
    if (socket.rooms.has('admin') && gameState.gameStatus !== 'finished') {
      const number = extractNumber();
      if (number) {
        io.emit('number-extracted', number);
        
        // Controlla vincite per tutti i giocatori
        Object.keys(gameState.players).forEach(playerId => {
          const wins = checkWins(playerId, gameState.players[playerId].card, 
                                gameState.players[playerId].markedNumbers);
          if (wins.length > 0) {
            io.to(playerId).emit('you-won', wins);
            io.emit('player-won', { playerId, playerName: gameState.players[playerId].name, wins });
          }
        });
      }
    }
  });
  
  // Giocatore marca numero
  socket.on('mark-number', (number) => {
    if (gameState.players[socket.id]) {
      const player = gameState.players[socket.id];
      if (!player.markedNumbers.includes(number)) {
        player.markedNumbers.push(number);
        
        // Controlla se ha vinto
        const wins = checkWins(socket.id, player.card, player.markedNumbers);
        if (wins.length > 0) {
          socket.emit('you-won', wins);
          io.emit('player-won', { playerId: socket.id, playerName: player.name, wins });
        }
        
        io.emit('game-state', gameState);
      }
    }
  });
  
  // Reset gioco
  socket.on('reset-game', () => {
    if (socket.rooms.has('admin')) {
      gameState = {
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
        adminConnected: gameState.adminConnected
      };
      io.emit('game-state', gameState);
    }
  });
  
  // Disconnessione
  socket.on('disconnect', () => {
    if (socket.rooms.has('admin')) {
      gameState.adminConnected = false;
    }
    delete gameState.players[socket.id];
    io.emit('game-state', gameState);
  });
});

// Rotta principale
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
});
