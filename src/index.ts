import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface Session {
  admin: WebSocket | null;
  clients: WebSocket[];
  shapes: Array<any>;
}

const sessions: Record<string, Session> = {};
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  
})

app.post('/api/create-session', (req, res) => {
  const sessionId = uuidv4();
  const {shapes} = req.body;
  sessions[sessionId] = { admin: null, clients: [], shapes: shapes };
  console.log(sessions)
  res.json({ sessionId });
});


wss.on('connection', (ws) => {
  console.log("New connection established")
  let sessionId: string | null = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'join':
          sessionId = data.sessionId;

          if (!sessionId || !sessions[sessionId]) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid session ID', success: false }));
            return;
          }
          

          const session = sessions[sessionId];

          if (!sessions[sessionId].admin) {
            session.admin = ws;
          }

          if (!session.clients.includes(ws)) {
            session.clients.push(ws);
            console.log('Number of clients are',session.clients.length)
          }

          ws.send(JSON.stringify({ type: 'joined', sessionId, success: true, shapes: session.shapes }));
          break;

        case 'update':
          if (!sessionId || !sessions[sessionId]) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid session ID', success: false }));
            return;
          }

          const sessionToUpdate = sessions[sessionId];

          sessionToUpdate.shapes = data.shapes;

          sessionToUpdate.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'update', shapes: sessionToUpdate.shapes }));
            }
          });
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type', success:false }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid data sent', success:false }));
      return;
    }
  });

  ws.on('close', () => {
    
    if (sessionId && sessions[sessionId]) {
      const session = sessions[sessionId];
      
      console.log('User left on session', sessionId)
      console.log('number of clients are', sessions[sessionId].clients.length)

      session.clients = session.clients.filter((client) => client !== ws);

      if (session.admin === ws) {
        session.admin = session.clients[0] || null; 
        if (session.admin) {
            session.admin.send(JSON.stringify({ type: 'admin-promoted', message: 'You are now the admin' }));
        }
    } else if (session.clients.length === 0) {
        delete sessions[sessionId];
      }
    }
    else{
        ws.send(JSON.stringify({message: 'Connection closed, could not find a session'}))
        return;
    }
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
