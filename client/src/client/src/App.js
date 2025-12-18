// File: client/src/App.js - MODIFICA la connessione socket
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import styled from 'styled-components';
import './App.css';

// Connessione socket dinamica per produzione
const socket = process.env.NODE_ENV === 'production' 
  ? io()  // Collegamento automatico allo stesso host
  : io('http://localhost:5000');  // Collegamento locale per sviluppo

// ... (tutto il resto del componente App rimane uguale)
