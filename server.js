// server/server.js
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

const wss = new WebSocket.Server({ port: PORT });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('クライアント接続');

  ws.on('message', (message) => {
    // 受信したシグナルを他のクライアントに中継
    for (const client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('クライアント切断');
  });
});

console.log(`Signaling server running on port ${PORT}`);
