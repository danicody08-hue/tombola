// File: client/src/App.js - COMPLETO
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import styled from 'styled-components';
import './App.css';

// Connessione socket dinamica per produzione
const socket = process.env.NODE_ENV === 'production' 
  ? io(window.location.origin, { transports: ['websocket', 'polling'] })
  : io('http://localhost:5000', { transports: ['websocket', 'polling'] });

function App() {
  const [gameState, setGameState] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [yourCard, setYourCard] = useState(null);
  const [wins, setWins] = useState([]);
  const [joined, setJoined] = useState(false);
  const [recentWins, setRecentWins] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    // Gestione stato connessione
    socket.on('connect', () => {
      console.log('Connesso al server');
      setConnectionStatus('connected');
    });

    socket.on('disconnect', () => {
      console.log('Disconnesso dal server');
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Errore di connessione:', error);
      setConnectionStatus('error');
    });

    // Ricevi stato del gioco
    socket.on('game-state', (state) => {
      console.log('Stato gioco aggiornato:', state);
      setGameState(state);
    });

    // Ricevi la tua cartella
    socket.on('your-card', (card) => {
      console.log('Cartella ricevuta:', card);
      setYourCard(card);
    });

    // Notifica numero estratto
    socket.on('number-extracted', (number) => {
      console.log('Numero estratto:', number);
      // Animazione per il nuovo numero
      const lastNumberElement = document.querySelector('.current-number');
      if (lastNumberElement) {
        lastNumberElement.classList.add('pulse');
        setTimeout(() => lastNumberElement.classList.remove('pulse'), 1000);
      }
    });

    // Hai vinto qualcosa
    socket.on('you-won', (wonPrizes) => {
      console.log('Hai vinto:', wonPrizes);
      setWins(prev => [...prev, ...wonPrizes.filter(p => !prev.includes(p))]);
      
      // Notifica per l'utente
      if (wonPrizes.includes('tombola')) {
        alert(`🎉🎉🎉 TOMBOLA! HAI VINTO! 🎉🎉🎉\nComplimenti ${playerName}, hai fatto Tombola!`);
      } else {
        alert(`🎉 Complimenti ${playerName}! Hai vinto: ${wonPrizes.join(', ')}!`);
      }
    });

    // Altri giocatori hanno vinto
    socket.on('player-won', ({ playerId, playerName, wins }) => {
      console.log(`${playerName} ha vinto:`, wins);
      setRecentWins(prev => [
        { playerName, wins, timestamp: new Date() },
        ...prev.slice(0, 4)
      ]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('game-state');
      socket.off('your-card');
      socket.off('number-extracted');
      socket.off('you-won');
      socket.off('player-won');
    };
  }, [playerName]);

  const joinAsAdmin = () => {
    socket.emit('admin-join');
    setIsAdmin(true);
    setJoined(true);
    setPlayerName('Admin');
  };

  const joinAsPlayer = () => {
    if (playerName.trim()) {
      socket.emit('player-join', playerName.trim());
      setJoined(true);
    }
  };

  const extractNumber = () => {
    if (gameState?.extractedNumbers.length >= 90) {
      alert('Tutti i numeri sono stati estratti!');
      return;
    }
    socket.emit('extract-number');
  };

  const markNumber = (number) => {
    if (number && gameState?.extractedNumbers.includes(number)) {
      socket.emit('mark-number', number);
    } else {
      alert('Questo numero non è stato ancora estratto!');
    }
  };

  const resetGame = () => {
    if (window.confirm('Sei sicuro di voler resettare il gioco? Tutti i progressi andranno persi.')) {
      socket.emit('reset-game');
      setWins([]);
      setRecentWins([]);
    }
  };

  const leaveGame = () => {
    if (window.confirm('Vuoi abbandonare il gioco?')) {
      socket.disconnect();
      setJoined(false);
      setIsAdmin(false);
      setPlayerName('');
      setYourCard(null);
      setWins([]);
      setRecentWins([]);
      // Riconnetti
      setTimeout(() => socket.connect(), 100);
    }
  };

  // Vista di connessione
  if (connectionStatus === 'connecting') {
    return (
      <LoadingContainer>
        <ChristmasTitle>🎄 Tombola Natalizia 🎅</ChristmasTitle>
        <LoadingSpinner />
        <LoadingText>Connessione al server in corso...</LoadingText>
      </LoadingContainer>
    );
  }

  if (connectionStatus === 'error') {
    return (
      <ErrorContainer>
        <ChristmasTitle>🎄 Tombola Natalizia 🎅</ChristmasTitle>
        <ErrorMessage>
          <h2>⚠️ Errore di Connessione</h2>
          <p>Impossibile connettersi al server. Controlla:</p>
          <ul>
            <li>La tua connessione internet</li>
            <li>Che il server sia in esecuzione</li>
            <li>Di aver aggiornato la pagina</li>
          </ul>
          <RetryButton onClick={() => window.location.reload()}>
            🔄 Riprova
          </RetryButton>
        </ErrorMessage>
      </ErrorContainer>
    );
  }

  if (!joined) {
    return (
      <JoinContainer>
        <ChristmasHeader>
          <ChristmasTitle>🎄 Tombola Natalizia 🎅</ChristmasTitle>
          <Subtitle>Gioca online con amici e famiglia!</Subtitle>
        </ChristmasHeader>
        
        <JoinBox>
          <ConnectionStatus connected={connectionStatus === 'connected'}>
            {connectionStatus === 'connected' ? '✅ Connesso' : '❌ Disconnesso'}
          </ConnectionStatus>
          
          <h2>Entra nel gioco</h2>
          
          <AdminSection>
            <h3>👑 Amministratore</h3>
            <p>Controlla il gioco e estrai i numeri</p>
            <AdminButton onClick={joinAsAdmin}>
              🎅 Entra come Admin
            </AdminButton>
          </AdminSection>
          
          <Divider>
            <span>oppure</span>
          </Divider>
          
          <PlayerSection>
            <h3>🎮 Giocatore</h3>
            <Input
              type="text"
              placeholder="Inserisci il tuo nome"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && joinAsPlayer()}
              maxLength="20"
            />
            <PlayerButton 
              onClick={joinAsPlayer} 
              disabled={!playerName.trim()}
            >
              🎲 Inizia a Giocare!
            </PlayerButton>
          </PlayerSection>
          
          <GameRules>
            <h4>📜 Regole del Gioco:</h4>
            <ul>
              <li><strong>Ambo:</strong> 2 numeri sulla stessa riga</li>
              <li><strong>Terno:</strong> 3 numeri sulla stessa riga</li>
              <li><strong>Quaterna:</strong> 4 numeri sulla stessa riga</li>
              <li><strong>Cinquina:</strong> 5 numeri sulla stessa riga</li>
              <li><strong>Tombola:</strong> Tutti i 15 numeri della cartella</li>
            </ul>
          </GameRules>
        </JoinBox>
        
        <Footer>
          <p>Condividi il link con i tuoi amici per giocare insieme!</p>
          <ConnectionInfo>
            Server: {process.env.NODE_ENV === 'production' ? 'Online' : 'Locale'}
          </ConnectionInfo>
        </Footer>
      </JoinContainer>
    );
  }

  if (isAdmin) {
    return (
      <AdminContainer>
        <ChristmasHeader>
          <HeaderContent>
            <h1>🎅 Pannello Amministratore 🎄</h1>
            <AdminControls>
              <LeaveButton onClick={leaveGame}>🚪 Esci</LeaveButton>
              <ResetButton onClick={resetGame}>🔄 Reset Gioco</ResetButton>
            </AdminControls>
          </HeaderContent>
          <GameStatusBadge status={gameState?.gameStatus}>
            Stato: {gameState?.gameStatus === 'playing' ? 'In Corso' : 
                   gameState?.gameStatus === 'finished' ? 'Terminato' : 'In Attesa'}
          </GameStatusBadge>
        </ChristmasHeader>

        <GameControlSection>
          <ControlCard>
            <h3>🎲 Controllo Estrazioni</h3>
            <CurrentNumberDisplay>
              <div>Numero Corrente:</div>
              <CurrentNumber className="current-number">
                {gameState?.currentNumber || '--'}
              </CurrentNumber>
              <ExtractButton 
                onClick={extractNumber}
                disabled={gameState?.gameStatus === 'finished'}
              >
                🔢 Estrai Numero
              </ExtractButton>
              <NumbersLeft>
                Numeri rimasti: {90 - (gameState?.extractedNumbers.length || 0)}
              </NumbersLeft>
            </CurrentNumberDisplay>
          </ControlCard>

          <StatsCard>
            <h3>📊 Statistiche</h3>
            <StatsGrid>
              <StatItem>
                <StatLabel>Numeri Estratti</StatLabel>
                <StatValue>{gameState?.extractedNumbers.length || 0}/90</StatValue>
              </StatItem>
              <StatItem>
                <StatLabel>Giocatori Attivi</StatLabel>
                <StatValue>{Object.keys(gameState?.players || {}).length}</StatValue>
              </StatItem>
              <StatItem>
                <StatLabel>Ambo Vinti</StatLabel>
                <StatValue>
                  {Object.values(gameState?.players || {}).filter(p => p.ambo).length}
                </StatValue>
              </StatItem>
              <StatItem>
                <StatLabel>Tombolate</StatLabel>
                <StatValue>
                  {Object.values(gameState?.players || {}).filter(p => p.tombola).length}
                </StatValue>
              </StatItem>
            </StatsGrid>
          </StatsCard>
        </GameControlSection>

        <MainBoardSection>
          <SectionHeader>
            <h2>🎯 Tabellone Principale</h2>
            <LastNumbers>
              Ultimi 5: {gameState?.extractedNumbers.slice(-5).join(', ') || 'Nessuno'}
            </LastNumbers>
          </SectionHeader>
          <BoardGrid>
            {Array.from({ length: 90 }, (_, i) => i + 1).map(num => (
              <BoardCell 
                key={num}
                extracted={gameState?.extractedNumbers.includes(num)}
                recent={gameState?.currentNumber === num}
              >
                {num}
              </BoardCell>
            ))}
          </BoardGrid>
          <BoardLegend>
            <LegendItem>
              <LegendColor className="extracted" /> Estratto
            </LegendItem>
            <LegendItem>
              <LegendColor className="recent" /> Ultimo
            </LegendItem>
            <LegendItem>
              <LegendColor className="not-extracted" /> Da estrarre
            </LegendItem>
          </BoardLegend>
        </MainBoardSection>

        <PlayersSection>
          <SectionHeader>
            <h2>👥 Giocatori ({Object.keys(gameState?.players || {}).length})</h2>
          </SectionHeader>
          
          {Object.keys(gameState?.players || {}).length === 0 ? (
            <EmptyState>
              <p>⏳ Nessun giocatore connesso. Condividi il link per iniziare!</p>
            </EmptyState>
          ) : (
            <PlayersGrid>
              {Object.values(gameState?.players || {}).map(player => (
                <PlayerCard key={player.id}>
                  <PlayerHeader>
                    <PlayerName>{player.name}</PlayerName>
                    <PlayerStatus connected={true}>
                      ● Online
                    </PlayerStatus>
                  </PlayerHeader>
                  
                  <PlayerStats>
                    <Stat>
                      <StatLabelSmall>Numeri segnati:</StatLabelSmall>
                      <StatValueSmall>{player.markedNumbers?.length || 0}/15</StatValueSmall>
                    </Stat>
                  </PlayerStats>
                  
                  <PlayerWins>
                    {player.ambo && <WinBadge type="ambo">Ambo</WinBadge>}
                    {player.terno && <WinBadge type="terno">Terno</WinBadge>}
                    {player.quaterna && <WinBadge type="quaterna">Quaterna</WinBadge>}
                    {player.cinquina && <WinBadge type="cinquina">Cinquina</WinBadge>}
                    {player.tombola && <WinBadge type="tombola">🎉 TOMBOLA!</WinBadge>}
                    {!player.ambo && !player.terno && !player.quaterna && 
                     !player.cinquina && !player.tombola && (
                      <NoWins>Nessuna vincita ancora</NoWins>
                    )}
                  </PlayerWins>
                </PlayerCard>
              ))}
            </PlayersGrid>
          )}
        </PlayersSection>

        <RecentWinsSection>
          <h2>🏆 Vincite Recenti</h2>
          {recentWins.length === 0 ? (
            <EmptyState>Nessuna vincita recente</EmptyState>
          ) : (
            <WinsList>
              {recentWins.map((win, index) => (
                <WinItem key={index}>
                  <WinPlayer>{win.playerName}</WinPlayer>
                  <WinType>
                    ha vinto: {win.wins.map(w => 
                      w === 'tombola' ? '🎉 TOMBOLA' : w
                    ).join(', ')}
                  </WinType>
                  <WinTime>
                    {new Date(win.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </WinTime>
                </WinItem>
              ))}
            </WinsList>
          )}
        </RecentWinsSection>
      </AdminContainer>
    );
  }

  // Vista giocatore
  return (
    <PlayerContainer>
      <ChristmasHeader>
        <HeaderContent>
          <div>
            <h1>🎄 Benvenuto, {playerName}! 🎅</h1>
            <GameInfo>
              <InfoItem>Numeri estratti: {gameState?.extractedNumbers.length || 0}</InfoItem>
              <InfoItem>Ultimo numero: 
                <CurrentNumberPlayer>
                  {gameState?.currentNumber || '--'}
                </CurrentNumberPlayer>
              </InfoItem>
            </GameInfo>
          </div>
          <PlayerControls>
            <LeaveButton onClick={leaveGame}>🚪 Esci</LeaveButton>
            {wins.length > 0 && (
              <WinsDisplay>
                {wins.map((win, i) => (
                  <WinBadgePlayer key={i} type={win}>
                    {win === 'tombola' ? '🎉 TOMBOLA' : win}
                  </WinBadgePlayer>
                ))}
              </WinsDisplay>
            )}
          </PlayerControls>
        </HeaderContent>
      </ChristmasHeader>

      <PlayerContent>
        <YourCardSection>
          <SectionHeader>
            <h2>🎴 La tua Cartella</h2>
            <MarkedInfo>
              Numeri segnati: {gameState?.players[socket.id]?.markedNumbers.length || 0}/15
            </MarkedInfo>
          </SectionHeader>
          
          {yourCard ? (
            <CardContainer>
              <CardGrid>
                {yourCard.map((row, rowIndex) => (
                  <CardRow key={rowIndex}>
                    {row.map((cell, colIndex) => {
                      const number = cell;
                      const isMarked = number && 
                        gameState?.players[socket.id]?.markedNumbers.includes(number);
                      const isExtracted = number && 
                        gameState?.extractedNumbers.includes(number);
                      
                      return (
                        <CardCell 
                          key={`${rowIndex}-${colIndex}`}
                          hasNumber={number !== null}
                          marked={isMarked}
                          extracted={isExtracted && !isMarked}
                          onClick={() => number && isExtracted && markNumber(number)}
                          title={number ? `Numero ${number}` : 'Spazio vuoto'}
                        >
                          {number || ''}
                          {isMarked && <MarkIndicator>✓</MarkIndicator>}
                        </CardCell>
                      );
                    })}
                  </CardRow>
                ))}
              </CardGrid>
              
              <CardLegend>
                <LegendItem>
                  <LegendColor className="marked" /> Segnato
                </LegendItem>
                <LegendItem>
                  <LegendColor className="extracted" /> Estratto (clicca per segnare)
                </LegendItem>
                <LegendItem>
                  <LegendColor className="not-extracted" /> Da estrarre
                </LegendItem>
              </CardLegend>
            </CardContainer>
          ) : (
            <LoadingCard>Caricamento cartella...</LoadingCard>
          )}
          
          <Instructions>
            <h4>ℹ️ Come giocare:</h4>
            <p>Clicca sui numeri estratti per segnarli sulla tua cartella.</p>
            <p>Il sistema controlla automaticamente le vincite!</p>
          </Instructions>
        </YourCardSection>

        <Sidebar>
          <ExtractedNumbersSection>
            <h3>🔢 Numeri Estratti</h3>
            {gameState?.extractedNumbers.length === 0 ? (
              <EmptyExtracted>Nessun numero estratto ancora</EmptyExtracted>
            ) : (
              <>
                <LastExtracted>
                  Ultimo: <strong>{gameState?.currentNumber || '--'}</strong>
                </LastExtracted>
                <ExtractedGrid>
                  {gameState?.extractedNumbers.map(num => {
                    const isMarked = gameState?.players[socket.id]?.markedNumbers.includes(num);
                    return (
                      <ExtractedNumber 
                        key={num}
                        marked={isMarked}
                        recent={gameState?.currentNumber === num}
                      >
                        {num}
                        {isMarked && <SmallCheck>✓</SmallCheck>}
                      </ExtractedNumber>
                    );
                  })}
                </ExtractedGrid>
              </>
            )}
          </ExtractedNumbersSection>

          <WinnersSection>
            <h3>🏆 Vincitori</h3>
            {Object.values(gameState?.players || {})
              .filter(p => p.ambo || p.terno || p.quaterna || p.cinquina || p.tombola)
              .length === 0 ? (
              <NoWinners>Nessun vincitore ancora</NoWinners>
            ) : (
              <WinnersList>
                {Object.values(gameState?.players || {})
                  .filter(p => p.ambo || p.terno || p.quaterna || p.cinquina || p.tombola)
                  .map(player => (
                    <WinnerItem key={player.id}>
                      <WinnerName>{player.name}</WinnerName>
                      <WinnerPrizes>
                        {player.tombola && <PrizeBadge type="tombola">🎉</PrizeBadge>}
                        {player.cinquina && <PrizeBadge type="cinquina">5</PrizeBadge>}
                        {player.quaterna && <PrizeBadge type="quaterna">4</PrizeBadge>}
                        {player.terno && <PrizeBadge type="terno">3</PrizeBadge>}
                        {player.ambo && <PrizeBadge type="ambo">2</PrizeBadge>}
                      </WinnerPrizes>
                    </WinnerItem>
                  ))}
              </WinnersList>
            )}
          </WinnersSection>

          <GameStatusSection>
            <h3>📈 Stato Partita</h3>
            <StatusItem>
              <StatusLabel>Giocatori online:</StatusLabel>
              <StatusValue>{Object.keys(gameState?.players || {}).length}</StatusValue>
            </StatusItem>
            <StatusItem>
              <StatusLabel>Numeri estratti:</StatusLabel>
              <StatusValue>{gameState?.extractedNumbers.length || 0}/90</StatusValue>
            </StatusItem>
            <StatusItem>
              <StatusLabel>Ambo vinti:</StatusLabel>
              <StatusValue>
                {Object.values(gameState?.players || {}).filter(p => p.ambo).length}
              </StatusValue>
            </StatusItem>
            <StatusItem>
              <StatusLabel>Tombolate:</StatusLabel>
              <StatusValue>
                {Object.values(gameState?.players || {}).filter(p => p.tombola).length}
              </StatusValue>
            </StatusItem>
          </GameStatusSection>
        </Sidebar>
      </PlayerContent>

      <RecentActivity>
        <h3>📢 Attività Recente</h3>
        {recentWins.length === 0 ? (
          <NoActivity>Nessuna attività recente</NoActivity>
        ) : (
          <ActivityList>
            {recentWins.map((win, index) => (
              <ActivityItem key={index}>
                <ActivityText>
                  <strong>{win.playerName}</strong> ha vinto {win.wins.join(', ')}
                </ActivityText>
                <ActivityTime>
                  {new Date(win.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </ActivityTime>
              </ActivityItem>
            ))}
          </ActivityList>
        )}
      </RecentActivity>
    </PlayerContainer>
  );
}

// ============================================
// STYLED COMPONENTS
// ============================================

const ChristmasTitle = styled.h1`
  font-family: 'Mountains of Christmas', cursive, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #c41e3a;
  font-size: 3rem;
  text-align: center;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  
  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const Subtitle = styled.p`
  color: #2d5a27;
  text-align: center;
  font-size: 1.2rem;
  margin-bottom: 20px;
`;

const ChristmasHeader = styled.header`
  background: linear-gradient(135deg, #1a472a 0%, #2d5a27 100%);
  color: white;
  padding: 20px;
  border-radius: 15px;
  margin-bottom: 30px;
  border: 4px solid #c41e3a;
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  position: relative;
  overflow: hidden;
  
  &:before {
    content: '🎄';
    position: absolute;
    top: 10px;
    left: 20px;
    font-size: 2rem;
    opacity: 0.3;
  }
  
  &:after {
    content: '🎅';
    position: absolute;
    top: 10px;
    right: 20px;
    font-size: 2rem;
    opacity: 0.3;
  }
`;

const JoinContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #0f3c2d 0%, #1a472a 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.1)"/></svg>');
    opacity: 0.1;
  }
`;

const JoinBox = styled.div`
  background: white;
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 15px 35px rgba(0,0,0,0.3);
  text-align: center;
  width: 100%;
  max-width: 500px;
  border: 4px solid #c41e3a;
  position: relative;
  z-index: 1;
  
  h2 {
    color: #2d5a27;
    margin-bottom: 30px;
  }
`;

const ConnectionStatus = styled.div`
  position: absolute;
  top: 15px;
  right: 15px;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.9rem;
  background: ${props => props.connected ? '#4CAF50' : '#f44336'};
  color: white;
`;

const AdminSection = styled.div`
  background: #fff8e1;
  padding: 20px;
  border-radius: 10px;
  border: 2px solid #ffc107;
  margin-bottom: 20px;
  
  h3 {
    color: #ff9800;
    margin-bottom: 10px;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 25px 0;
  color: #666;
  
  &:before, &:after {
    content: '';
    flex: 1;
    height: 1px;
    background: #ddd;
  }
  
  span {
    padding: 0 15px;
    font-size: 0.9rem;
  }
`;

const PlayerSection = styled.div`
  padding: 20px;
  border-radius: 10px;
  border: 2px solid #4CAF50;
  margin-bottom: 20px;
  
  h3 {
    color: #2d5a27;
    margin-bottom: 10px;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 15px;
  margin: 15px 0;
  border: 2px solid #4CAF50;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.3s;
  
  &:focus {
    outline: none;
    border-color: #2d5a27;
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.2);
  }
`;

const AdminButton = styled.button`
  background: linear-gradient(45deg, #ff9800, #ffc107);
  color: white;
  border: none;
  padding: 15px 30px;
  font-size: 1.1rem;
  border-radius: 10px;
  cursor: pointer;
  width: 100%;
  margin-top: 10px;
  font-weight: bold;
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 152, 0, 0.3);
  }
  
  &:disabled {
    background: #cccccc;
    cursor: not-allowed;
    transform: none;
  }
`;

const PlayerButton = styled(AdminButton)`
  background: linear-gradient(45deg, #2d5a27, #4CAF50);
  
  &:hover {
    box-shadow: 0 5px 15px rgba(45, 90, 39, 0.3);
  }
`;

const GameRules = styled.div`
  margin-top: 25px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
  text-align: left;
  
  h4 {
    color: #2d5a27;
    margin-bottom: 10px;
  }
  
  ul {
    padding-left: 20px;
    color: #666;
  }
  
  li {
    margin-bottom: 5px;
  }
`;

const Footer = styled.footer`
  margin-top: 30px;
  text-align: center;
  color: white;
  
  p {
    margin-bottom: 10px;
    opacity: 0.9;
  }
`;

const ConnectionInfo = styled.div`
  padding: 8px 15px;
  background: rgba(255,255,255,0.1);
  border-radius: 20px;
  display: inline-block;
  font-size: 0.9rem;
`;

const LoadingContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f3c2d 0%, #1a472a 100%);
`;

const LoadingSpinner = styled.div`
  width: 50px;
  height: 50px;
  border: 5px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin: 20px 0;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  color: white;
  font-size: 1.1rem;
`;

const ErrorContainer = styled(LoadingContainer)``;

const ErrorMessage = styled.div`
  background: white;
  padding: 30px;
  border-radius: 15px;
  max-width: 500px;
  text-align: center;
  border: 3px solid #f44336;
  
  h2 {
    color: #f44336;
    margin-bottom: 15px;
  }
  
  ul {
    text-align: left;
    margin: 15px 0;
    padding-left: 20px;
  }
`;

const RetryButton = styled.button`
  background: #4CAF50;
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 15px;
  font-weight: bold;
  
  &:hover {
    background: #45a049;
  }
`;

const AdminContainer = styled.div`
  padding: 20px;
  background: linear-gradient(135deg, #f8fff8 0%, #f0f8ff 100%);
  min-height: 100vh;
  
  @media (max-width: 768px) {
    padding: 10px;
  }
`;

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const AdminControls = styled.div`
  display: flex;
  gap: 10px;
`;

const LeaveButton = styled.button`
  background: #666;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  
  &:hover {
    background: #555;
  }
`;

const ResetButton = styled(LeaveButton)`
  background: #f44336;
  
  &:hover {
    background: #d32f2f;
  }
`;

const GameStatusBadge = styled.div`
  position: absolute;
  top: 15px;
  right: 15px;
  padding: 5px 15px;
  border-radius: 20px;
  font-weight: bold;
  background: ${props => 
    props.status === 'finished' ? '#f44336' :
    props.status === 'playing' ? '#4CAF50' : '#ff9800'};
  color: white;
  font-size: 0.9rem;
  
  @media (max-width: 768px) {
    position: relative;
    top: auto;
    right: auto;
    display: inline-block;
    margin-top: 10px;
  }
`;

const GameControlSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
`;

const ControlCard = styled.div`
  background: white;
  padding: 25px;
  border-radius: 15px;
  border: 3px solid #4CAF50;
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  
  h3 {
    color: #2d5a27;
    margin-bottom: 20px;
  }
`;

const CurrentNumberDisplay = styled.div`
  text-align: center;
  
  div:first-child {
    color: #666;
    margin-bottom: 10px;
    font-size: 1.1rem;
  }
`;

const CurrentNumber = styled.div`
  font-size: 5rem;
  font-weight: bold;
  color: #c41e3a;
  margin: 20px 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
  transition: all 0.3s;
  
  &.pulse {
    animation: pulse 0.5s ease-in-out;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
`;

const ExtractButton = styled.button`
  background: linear-gradient(45deg, #2d5a27, #4CAF50);
  color: white;
  border: none;
  padding: 15px 40px;
  font-size: 1.2rem;
  border-radius: 10px;
  cursor: pointer;
  margin: 15px 0;
  font-weight: bold;
  transition: transform 0.2s;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(45, 90, 39, 0.3);
  }
  
  &:disabled {
    background: #cccccc;
    cursor: not-allowed;
  }
`;

const NumbersLeft = styled.div`
  color: #666;
  font-size: 0.9rem;
  margin-top: 10px;
`;

const StatsCard = styled(ControlCard)`
  border-color: #2196F3;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
`;

const StatItem = styled.div`
  text-align: center;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 10px;
`;

const StatLabel = styled.div`
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 5px;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: bold;
  color: #2d5a27;
`;

const MainBoardSection = styled.section`
  background: white;
  padding: 25px;
  border-radius: 15px;
  margin-bottom: 30px;
  border: 3px solid #2d5a27;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
  
  h2 {
    color: #2d5a27;
  }
`;

const LastNumbers = styled.div`
  background: #f0f8ff;
  padding: 8px 15px;
  border-radius: 20px;
  font-weight: bold;
  color: #2196F3;
`;

const BoardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
  margin: 20px 0;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(5, 1fr);
    gap: 5px;
  }
`;

const BoardCell = styled.div`
  background: ${props => 
    props.recent ? '#ffeb3b' :
    props.extracted ? '#4CAF50' : '#f5f5f5'};
  border: 2px solid ${props => 
    props.recent ? '#ff9800' :
    props.extracted ? '#2d5a27' : '#ddd'};
  padding: 12px 5px;
  text-align: center;
  border-radius: 8px;
  font-weight: bold;
  color: ${props => 
    props.recent ? '#333' :
    props.extracted ? 'white' : '#333'};
  font-size: 1.1rem;
  transition: transform 0.2s;
  cursor: pointer;
  
  &:hover {
    transform: scale(1.05);
  }
  
  @media (max-width: 768px) {
    padding: 8px 3px;
    font-size: 0.9rem;
  }
`;

const BoardLegend = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
  flex-wrap: wrap;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
`;

const LegendColor = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  
  &.extracted {
    background: #4CAF50;
    border: 1px solid #2d5a27;
  }
  
  &.recent {
    background: #ffeb3b;
    border: 1px solid #ff9800;
  }
  
  &.not-extracted {
    background: #f5f5f5;
    border: 1px solid #ddd;
  }
  
  &.marked {
    background: #c41e3a;
    border: 1px solid #a00;
  }
`;

const PlayersSection = styled(MainBoardSection)`
  border-color: #2196F3;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
`;

const PlayersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
`;

const PlayerCard = styled.div`
  background: #f9f9f9;
  padding: 20px;
  border-radius: 10px;
  border: 2px solid #e0e0e0;
  transition: transform 0.2s, border-color 0.2s;
  
  &:hover {
    transform: translateY(-3px);
    border-color: #2196F3;
  }
`;

const PlayerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
`;

const PlayerName = styled.strong`
  font-size: 1.2rem;
  color: #333;
`;

const PlayerStatus = styled.div`
  font-size: 0.8rem;
  color: ${props => props.connected ? '#4CAF50' : '#f44336'};
`;

const PlayerStats = styled.div`
  margin-bottom: 15px;
`;

const Stat = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
`;

const StatLabelSmall = styled.span`
  color: #666;
`;

const StatValueSmall = styled.span`
  font-weight: bold;
  color: #2d5a27;
`;

const PlayerWins = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 32px;
`;

const WinBadge = styled.span`
  background: ${props => 
    props.type === 'tombola' ? '#ffeb3b' :
    props.type === 'cinquina' ? '#2196F3' :
    props.type === 'quaterna' ? '#9C27B0' :
    props.type === 'terno' ? '#FF9800' : '#4CAF50'};
  color: ${props => props.type === 'tombola' ? '#333' : 'white'};
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: bold;
  border: ${props => props.type === 'tombola' ? '2px solid #ff9800' : 'none'};
`;

const NoWins = styled.span`
  color: #999;
  font-style: italic;
  font-size: 0.9rem;
`;

const RecentWinsSection = styled.section`
  background: white;
  padding: 25px;
  border-radius: 15px;
  border: 3px solid #9C27B0;
  margin-bottom: 30px;
  
  h2 {
    color: #9C27B0;
    margin-bottom: 20px;
  }
`;

const WinsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const WinItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: #f3e5f5;
  border-radius: 10px;
  border-left: 4px solid #9C27B0;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
`;

const WinPlayer = styled.div`
  font-weight: bold;
  color: #7B1FA2;
`;

const WinType = styled.div`
  color: #333;
  flex: 1;
  margin: 0 15px;
`;

const WinTime = styled.div`
  color: #666;
  font-size: 0.9rem;
  font-style: italic;
`;

const PlayerContainer = styled(AdminContainer)``;

const GameInfo = styled.div`
  display: flex;
  gap: 20px;
  margin-top: 10px;
  flex-wrap: wrap;
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CurrentNumberPlayer = styled.div`
  font-size: 2rem;
  font-weight: bold;
  color: #c41e3a;
  margin-left: 10px;
`;

const PlayerControls = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  
  @media (max-width: 768px) {
    align-items: stretch;
  }
`;

const WinsDisplay = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const WinBadgePlayer = styled(WinBadge)`
  padding: 6px 15px;
  font-size: 0.9rem;
`;

const PlayerContent = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
`;

const YourCardSection = styled.section`
  background: white;
  padding: 25px;
  border-radius: 15px;
  border: 3px solid #2d5a27;
`;

const MarkedInfo = styled.div`
  background: #e8f5e8;
  padding: 8px 15px;
  border-radius: 20px;
  font-weight: bold;
  color: #2d5a27;
`;

const CardContainer = styled.div``;

const CardGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 25px 0;
  background: #f9f9f9;
  padding: 20px;
  border-radius: 10px;
  border: 2px solid #e0e0e0;
`;

const CardRow = styled.div`
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 8px;
  
  @media (max-width: 768px) {
    gap: 4px;
  }
`;

const CardCell = styled.div`
  background: ${props => 
    props.marked ? '#c41e3a' :
    props.extracted ? '#4CAF50' : 
    props.hasNumber ? '#f0f0f0' : 'transparent'};
  border: 2px solid ${props => 
    props.marked ? '#a00' :
    props.extracted ? '#2d5a27' : 
    props.hasNumber ? '#ddd' : 'transparent'};
  padding: 20px 5px;
  text-align: center;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1.1rem;
  color: ${props => 
    props.marked ? 'white' :
    props.extracted ? 'white' : '#333'};
  cursor: ${props => props.extracted ? 'pointer' : 'default'};
  position: relative;
  transition: all 0.2s;
  
  &:hover {
    transform: ${props => props.extracted ? 'scale(1.05)' : 'none'};
    box-shadow: ${props => props.extracted ? '0 3px 10px rgba(0,0,0,0.2)' : 'none'};
  }
  
  @media (max-width: 768px) {
    padding: 15px 3px;
    font-size: 0.9rem;
  }
`;

const MarkIndicator = styled.div`
  position: absolute;
  top: 2px;
  right: 2px;
  background: white;
  color: #c41e3a;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
`;

const CardLegend = styled(BoardLegend)`
  margin-top: 15px;
`;

const Instructions = styled.div`
  margin-top: 25px;
  padding: 15px;
  background: #e8f5e8;
  border-radius: 10px;
  
  h4 {
    color: #2d5a27;
    margin-bottom: 10px;
  }
  
  p {
    color: #666;
    margin-bottom: 5px;
    font-size: 0.95rem;
  }
`;

const Sidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 25px;
`;

const ExtractedNumbersSection = styled.div`
  background: white;
  padding: 20px;
  border-radius: 15px;
  border: 3px solid #2196F3;
  
  h3 {
    color: #2196F3;
    margin-bottom: 15px;
  }
`;

const LastExtracted = styled.div`
  background: #e3f2fd;
  padding: 10px;
  border-radius: 10px;
  text-align: center;
  margin-bottom: 15px;
  font-size: 1.1rem;
  
  strong {
    color: #2196F3;
    font-size: 1.3rem;
  }
`;

const EmptyExtracted = styled.div`
  text-align: center;
  padding: 30px;
  color: #999;
  font-style: italic;
`;

const ExtractedGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  padding: 5px;
`;

const ExtractedNumber = styled.div`
  background: ${props => 
    props.recent ? '#ffeb3b' :
    props.marked ? '#c41e3a' : '#e3f2fd'};
  color: ${props => 
    props.recent ? '#333' :
    props.marked ? 'white' : '#2196F3'};
  padding: 8px 12px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.95rem;
  position: relative;
  border: ${props => props.recent ? '2px solid #ff9800' : 'none'};
  min-width: 40px;
  text-align: center;
`;

const SmallCheck = styled.div`
  position: absolute;
  top: -5px;
  right: -5px;
  background: white;
  color: #c41e3a;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  border: 1px solid #c41e3a;
`;

const WinnersSection = styled(ExtractedNumbersSection)`
  border-color: #9C27B0;
  
  h3 {
    color: #9C27B0;
  }
`;

const NoWinners = styled(EmptyExtracted)``;

const WinnersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const WinnerItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #f3e5f5;
  border-radius: 10px;
`;

const WinnerName = styled.div`
  font-weight: bold;
  color: #7B1FA2;
`;

const WinnerPrizes = styled.div`
  display: flex;
  gap: 5px;
`;

const PrizeBadge = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${props => 
    props.type === 'tombola' ? '#ffeb3b' :
    props.type === 'cinquina' ? '#2196F3' :
    props.type === 'quaterna' ? '#9C27B0' :
    props.type === 'terno' ? '#FF9800' : '#4CAF50'};
  color: ${props => props.type === 'tombola' ? '#333' : 'white'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
  border: ${props => props.type === 'tombola' ? '2px solid #ff9800' : 'none'};
`;

const GameStatusSection = styled(ExtractedNumbersSection)`
  border-color: #4CAF50;
  
  h3 {
    color: #4CAF50;
  }
`;

const StatusItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  
  &:last-child {
    border-bottom: none;
  }
`;

const StatusLabel = styled.div`
  color: #666;
`;

const StatusValue = styled.div`
  font-weight: bold;
  color: #2d5a27;
`;

const RecentActivity = styled.section`
  background: white;
  padding: 20px;
  border-radius: 15px;
  border: 3px solid #FF9800;
  
  h3 {
    color: #FF9800;
    margin-bottom: 15px;
  }
`;

const NoActivity = styled.div`
  text-align: center;
  padding: 20px;
  color: #999;
  font-style: italic;
`;

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
`;

const ActivityItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #fff3e0;
  border-radius: 10px;
  border-left: 4px solid #FF9800;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
`;

const ActivityText = styled.div`
  color: #333;
  flex: 1;
`;

const ActivityTime = styled.div`
  color: #666;
  font-size: 0.85rem;
  font-style: italic;
`;

const LoadingCard = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
  background: #f9f9f9;
  border-radius: 10px;
  border: 2px dashed #ddd;
`;

export default App;
