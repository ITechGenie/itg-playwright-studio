import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Basic sanity check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'playwright-studio' });
});

// Setup WebSockets for Agent/Worker connections
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });
  
  // Send initial handshake
  ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to Playwright Studio WebSocket API' }));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Studio API Server running on http://localhost:${PORT}`);
});
