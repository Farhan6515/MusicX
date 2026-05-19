const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const cors = require('cors');
require('dotenv').config();

const { connectDB, mongoose } = require('./src/config/db');
require('./src/config/passport');

const authRoutes = require('./src/routes/auth');
const moodRoutes = require('./src/routes/mood');
const songRoutes = require('./src/routes/songs');

const PORT = process.env.PORT || 3000;

async function startServer() {
  const dbConnected = await connectDB();

  const app = express();

  app.use(cors({ origin: process.env.APP_URL || `http://localhost:${PORT}`, credentials: true }));
  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    name: 'musicx.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-change-me',
    resave: false,
    saveUninitialized: false,
    store: dbConnected
      ? MongoStore.create({ client: mongoose.connection.getClient() })
      : undefined,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  app.use('/auth', authRoutes);
  app.use('/api/mood', moodRoutes);
  app.use('/api/songs', songRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'musicx-backend', db: dbConnected });
  });

  app.use(express.static(__dirname));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`MusicX running at http://localhost:${PORT}`);
    if (!dbConnected) console.warn('Running without MongoDB — sessions will not persist.');
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
