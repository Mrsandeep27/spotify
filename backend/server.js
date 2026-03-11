require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
});

app.use(cors());
app.use(express.json());

// Routes
const authRouter = require('./routes/auth');
const songsRouter = require('./routes/songs');
const { router: sessionRouter } = require('./routes/session');

app.use('/api/auth', authRouter);
app.use('/api/songs', songsRouter);
app.use('/api/session', sessionRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Socket.io
require('./services/socket')(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎵 Spofity backend running on port ${PORT}`);
});
