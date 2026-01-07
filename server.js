const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map(); // roomCode => { host, guest }

function send(ws, msg) {
  try { ws.send(JSON.stringify(msg)); } catch (e) {}
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }

    if (msg.type === 'create') {
      const code = msg.roomCode;
      rooms.set(code, { host: ws, guest: null });
      send(ws, { type: 'created', roomCode: code });
    } else if (msg.type === 'join') {
      const code = msg.roomCode;
      const room = rooms.get(code);
      if (!room || room.guest) {
        send(ws, { type: 'error', message: 'Invalid room code or room full.' });
        return;
      }
      room.guest = ws;
      send(ws, { type: 'joined', roomCode: code });
      send(room.host, { type: 'start', roomCode: code });
      send(room.guest, { type: 'start', roomCode: code });
    } else if (msg.type === 'state') {
      const room = rooms.get(msg.roomCode);
      if (room && room.guest) {
        send(room.guest, msg);
      }
    } else if (msg.type === 'input') {
      const room = rooms.get(msg.roomCode);
      if (room && room.host) {
        send(room.host, msg);
      }
    }
  });

  ws.on('close', () => {
    for (const [code, room] of rooms.entries()) {
      if (room.host === ws || room.guest === ws) {
        if (room.host && room.host !== ws) send(room.host, { type: 'error', message: 'Peer disconnected.' });
        if (room.guest && room.guest !== ws) send(room.guest, { type: 'error', message: 'Peer disconnected.' });
        rooms.delete(code);
      }
    }
  });
});

console.log('WebSocket server listening on ws://localhost:8080');
