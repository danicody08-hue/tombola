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
      ? false
      : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Stato del gioco
let gameState = {
  extractedNumbers: [],
  currentNumber: null,
  previousNumber: null,
  gameStatus: 'waiting',
  prizes: {
    ambo: false,
    terno: false,
    quaterna: false,
    cinquina: false,
    tombola: false
  },
  players: {},
  adminConnected: false,
  winners: []
};

// Genera una cartella della tombola (matrice 3x9 con 5 numeri per riga)
function generateTombolaCard() {
  const card = [];
  const allNumbers = [];
  
  // Genera tutti i 15 numeri della cartella
  for (let i = 0; i < 15; i++) {
    let col = Math.floor(i / 3); // 0-4 per i numeri
    let min = col * 10 + 1;
    let max = col * 10 + 10;
    
    // Prima colonna: 1-9
    if (col === 0) min = 1;
    // Ultima colonna: 80-90
    if (col === 4) max = 90;
    
    let num;
    do {
      num = Math.floor(Math.random() * (max - min + 1)) + min;
    } while (allNumbers.includes(num));
    
    allNumbers.push(num);
  }
  
  // Ordina i numeri per colonna
  allNumbers.sort((a, b) => a - b);
  
  // Distribuisci i numeri nelle 3 righe
  for (let row = 0; row < 3; row++) {
    const rowNumbers = [];
    
    for (let col = 0; col < 9; col++) {
      // Trova i numeri che appartengono a questa colonna
      const colNumbers = allNumbers.filter(num => {
        const numCol = Math.floor((num - 1) / 10);
        return numCol === col;
      });
      
      // Assegna il numero alla riga corretta
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

// Estrai un numero casuale non ancora estratto
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

// Controlla vincite per un giocatore
function checkWins(playerId) {
  const player = gameState.players[playerId];
  if (!player) return [];
  
  const wins = [];
  const card = player.card;
  const markedNumbers = player.markedNumbers;
  
  // Controlla ogni riga
  for (let row = 0; row < 3; row++) {
    const rowNumbers = card[row].filter(n => n !== null);
    const markedInRow = rowNumbers.filter(n => markedNumbers.includes(n)).length;
    
    // Ambo (2 numeri)
    if (markedInRow >= 2 && !player.ambo) {
      wins.push('ambo');
      player.ambo = true;
      if (!gameState.winners.includes(playerId)) {
        gameState.winners.push(playerId);
      }
    }
    
    // Terno (3 numeri)
    if (markedInRow >= 3 && !player.terno) {
      wins.push('terno');
      player.terno = true;
    }
    
    // Quaterna (4 numeri)
    if (markedInRow >= 4 && !player.quaterna) {
      wins.push('quaterna');
      player.quaterna = true;
    }
    
    // Cinquina (5 numeri)
    if (markedInRow >= 5 && !player.cinquina) {
      wins.push('cinquina');
      player.cinquina = true;
    }
  }
  
  // Tombola (tutti i 15 numeri)
  if (markedNumbers.length >= 15 && !player.tombola) {
    wins.push('tombola');
    player.tombola = true;
    gameState.gameStatus = 'finished';
  }
  
  return wins;
}

// Inizializza un nuovo giocatore
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

// Socket.io handlers
io.on('connection', (socket) => {
  console.log('Nuova connessione:', socket.id);
  
  // Invio stato iniziale
  socket.emit('game-state', gameState);
  
  // Admin si connette
  socket.on('admin-join', () => {
    gameState.adminConnected = true;
    socket.join('admin');
    socket.emit('admin-status', true);
    io.emit('game-state', gameState);
    console.log('Admin connesso:', socket.id);
  });
  
  // Giocatore si unisce
  socket.on('player-join', (playerName) => {
    if (!playerName || playerName.trim() === '') {
      socket.emit('error', 'Nome non valido');
      return;
    }
    
    const card = initializePlayer(socket.id, playerName.trim());
    socket.emit('your-card', card);
    socket.emit('player-joined', { id: socket.id, name: playerName.trim() });
    io.emit('game-state', gameState);
    console.log('Giocatore connesso:', playerName, socket.id);
  });
  
  // Admin estrae numero
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
        
        // Notifica a tutti i giocatori del nuovo numero
        io.emit('new-number', {
          number: number,
          message: `È stato estratto il numero ${number}!`
        });
      } else {
        socket.emit('error', 'Tutti i numeri sono stati estratti!');
      }
    }
  });
  
  // Giocatore marca numero
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
      
      // Controlla se ha vinto
      const wins = checkWins(socket.id);
      
      if (wins.length > 0) {
        socket.emit('you-won', wins);
        io.emit('player-won', {
          playerId: socket.id,
          playerName: player.name,
          wins: wins,
          timestamp: new Date()
        });
        
        // Se ha fatto tombola, notifica tutti
        if (wins.includes('tombola')) {
          io.emit('tombola-winner', {
            playerName: player.name,
            message: `🎉 ${player.name} HA FATTO TOMBOLA! 🎉`
          });
        }
      }
      
      io.emit('game-state', gameState);
      socket.emit('number-marked', number);
    }
  });
  
  // Reset gioco
  socket.on('reset-game', () => {
    if (socket.rooms.has('admin')) {
      gameState = {
        extractedNumbers: [],
        currentNumber: null,
        previousNumber: null,
        gameStatus: 'waiting',
        prizes: {
          ambo: false,
          terno: false,
          quaterna: false,
          cinquina: false,
          tombola: false
        },
        players: {},
        adminConnected: gameState.adminConnected,
        winners: []
      };
      
      io.emit('game-reset', { message: 'Il gioco è stato resettato!' });
      io.emit('game-state', gameState);
      console.log('Gioco resettato da admin');
    }
  });
  
  // Richiedi stato giocatore
  socket.on('get-player-state', () => {
    const player = gameState.players[socket.id];
    if (player) {
      socket.emit('player-state', {
        card: player.card,
        markedNumbers: player.markedNumbers,
        wins: {
          ambo: player.ambo,
          terno: player.terno,
          quaterna: player.quaterna,
          cinquina: player.cinquina,
          tombola: player.tombola
        }
      });
    }
  });
  
  // Disconnessione
  socket.on('disconnect', () => {
    console.log('Disconnessione:', socket.id);
    
    if (socket.rooms.has('admin')) {
      gameState.adminConnected = false;
      io.emit('admin-disconnected', { message: 'Admin disconnesso' });
    }
    
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
      io.emit('player-left', { playerId: socket.id });
    }
    
    io.emit('game-state', gameState);
  });
  
  // Ping per mantenere la connessione attiva
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

// Rotta per la salute del server
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    players: Object.keys(gameState.players).length,
    extractedNumbers: gameState.extractedNumbers.length,
    gameStatus: gameState.gameStatus
  });
});

// Rotta per le statistiche
app.get('/stats', (req, res) => {
  res.json({
    totalPlayers: Object.keys(gameState.players).length,
    extractedNumbers: gameState.extractedNumbers.length,
    gameStatus: gameState.gameStatus,
    winners: gameState.winners.length,
    adminConnected: gameState.adminConnected
  });
});

// Rotta principale per SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server Tombola Natalizia in esecuzione sulla porta ${PORT}`);
  console.log(`📡 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎮 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Statistiche: http://localhost:${PORT}/stats`);
});
