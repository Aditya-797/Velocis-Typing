const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'velocis_typing.db');

// Error Handling
process.on('uncaughtException', (err) => {
  console.error('\n❌ UNCAUGHT EXCEPTION:', err);
});

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = await fs.promises.readFile(DB_PATH);
    db = new SQL.Database(new Uint8Array(buf));
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, display_name TEXT, bio TEXT, avatar TEXT, experience TEXT, keyboard_layout TEXT, keyboard_model TEXT, keyboard_switches TEXT, is_admin INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  // Sync columns...
  const columns = ['bio', 'avatar', 'experience', 'keyboard_layout', 'keyboard_model', 'keyboard_switches', 'is_admin'];
  columns.forEach(col => { try { db.run(`ALTER TABLE users ADD COLUMN ${col} ${col === 'is_admin' ? 'INTEGER DEFAULT 0' : 'TEXT'}`); } catch(e){} });
  
  db.run(`CREATE TABLE IF NOT EXISTS test_results (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, wpm INTEGER, raw_wpm INTEGER, accuracy REAL, errors INTEGER, chars_typed INTEGER, duration INTEGER, difficulty TEXT, mode TEXT DEFAULT 'test', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS lesson_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, lesson_id INTEGER NOT NULL, best_wpm INTEGER DEFAULT 0, best_accuracy REAL DEFAULT 0, completed_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS site_visits (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, ip TEXT, user_agent TEXT, path TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  try { db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_lesson ON lesson_progress(user_id, lesson_id)`); } catch(e) {}
  saveDB();
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
  stmt.free(); return null;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free(); return rows;
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));
app.use(session({
  secret: process.env.SESSION_SECRET || 'velocis-typing-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport Serialization
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = dbGet('SELECT * FROM users WHERE id = ?', [id]);
  done(null, user);
});

// Helper for Social Login User Creation/Retrieval
const findOrCreateSocialUser = (profile, provider) => {
  const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@${provider}.local`;
  let user = dbGet('SELECT * FROM users WHERE email = ?', [email]);
  
  if (!user) {
    const username = (profile.username || profile.displayName || profile.id).replace(/\s+/g, '').toLowerCase() + '_' + provider;
    const dummyPass = bcrypt.hashSync(Math.random().toString(36), 10);
    dbRun('INSERT INTO users (username, email, password, display_name, avatar) VALUES (?, ?, ?, ?, ?)',
      [username, email, dummyPass, profile.displayName || profile.username, profile.photos ? profile.photos[0].value : null]);
    user = dbGet('SELECT * FROM users WHERE email = ?', [email]);
  }
  return user;
};

// Helper to register strategies with fallback
const registerStrategy = (name, Strategy, config, scope) => {
  const hasRealKeys = config.clientID && !config.clientID.includes('your_');
  
  if (hasRealKeys) {
    passport.use(name, new Strategy(config, (accessToken, refreshToken, profile, done) => {
      done(null, findOrCreateSocialUser(profile, name));
    }));
  } else {
    // Development Fallback Strategy
    const CustomStrategy = require('passport-custom').Strategy;
    passport.use(name, new CustomStrategy((req, done) => {
      const mockProfile = {
        id: 'mock_' + name + '_' + Math.floor(Math.random()*1000),
        displayName: `${name.charAt(0).toUpperCase() + name.slice(1)} User (Dev Mode)`,
        emails: [{ value: `dev_${name}@example.local` }]
      };
      done(null, findOrCreateSocialUser(mockProfile, name));
    }));
  }
};

// Register All Strategies
registerStrategy('google', GoogleStrategy, {
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
});

registerStrategy('github', GitHubStrategy, {
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL
});

registerStrategy('facebook', FacebookStrategy, {
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL,
  profileFields: ['id', 'displayName', 'photos', 'email']
});

// Auth Routes
app.get('/auth/google', (req, res, next) => {
  const isReal = process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('your_');
  passport.authenticate('google', isReal ? { scope: ['profile', 'email'] } : {})(req, res, next);
});
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/?error=auth_failed', successRedirect: '/' }));

app.get('/auth/github', (req, res, next) => {
  const isReal = process.env.GITHUB_CLIENT_ID && !process.env.GITHUB_CLIENT_ID.includes('your_');
  passport.authenticate('github', isReal ? { scope: ['user:email'] } : {})(req, res, next);
});
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/?error=auth_failed', successRedirect: '/' }));

app.get('/auth/facebook', (req, res, next) => {
  const isReal = process.env.FACEBOOK_APP_ID && !process.env.FACEBOOK_APP_ID.includes('your_');
  passport.authenticate('facebook', isReal ? { scope: ['email'] } : {})(req, res, next);
});
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/?error=auth_failed', successRedirect: '/' }));

// Existing API routes updated to use passport sessions
app.get('/api/me', (req, res) => {
  const userId = req.session.userId || (req.user ? req.user.id : null);
  if (!userId) return res.json({ user: null });
  const user = dbGet('SELECT id, username, email, display_name, bio, avatar, experience, keyboard_layout, keyboard_model, keyboard_switches, is_admin FROM users WHERE id = ?', [userId]);
  if (!user) return res.json({ user: null });
  res.json({ user: { ...user, displayName: user.display_name, isAdmin: user.is_admin } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username.toLowerCase(), username.toLowerCase()]);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.userId = user.id;
  res.json({ success: true, user });
});

app.post('/api/register', (req, res) => {
  const { username, email, password, displayName } = req.body;
  const exists = dbGet('SELECT id FROM users WHERE username = ? OR email = ?', [username.toLowerCase(), email.toLowerCase()]);
  if (exists) return res.status(400).json({ error: 'Already exists' });
  const hash = bcrypt.hashSync(password, 10);
  dbRun('INSERT INTO users (username, email, password, display_name) VALUES (?, ?, ?, ?)', [username.toLowerCase(), email.toLowerCase(), hash, displayName || username]);
  const user = dbGet('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
  req.session.userId = user.id;
  res.json({ success: true, user });
});

app.post('/api/logout', (req, res) => { req.logout(() => {}); req.session.destroy(); res.json({ success: true }); });

// Other routes remain similar, but ensure they use session/passport...
app.post('/api/results', (req, res) => {
  const uid = req.session.userId || (req.user ? req.user.id : null);
  if (!uid) return res.status(401).end();
  const { wpm, rawWpm, accuracy, errors, chars, duration, difficulty, mode } = req.body;
  dbRun('INSERT INTO test_results (user_id, wpm, raw_wpm, accuracy, errors, chars_typed, duration, difficulty, mode) VALUES (?,?,?,?,?,?,?,?,?)', [uid, wpm, rawWpm, accuracy, errors, chars, duration, difficulty, mode]);
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const uid = req.session.userId || (req.user ? req.user.id : null);
  if (!uid) return res.status(401).end();
  const total = dbGet('SELECT COUNT(*) as count, COALESCE(SUM(chars_typed),0) as chars, COALESCE(SUM(duration),0) as time FROM test_results WHERE user_id = ?', [uid]);
  const best = dbGet('SELECT MAX(wpm) as bestWpm FROM test_results WHERE user_id = ?', [uid]);
  const avg = dbGet('SELECT AVG(wpm) as avgWpm, AVG(accuracy) as avgAcc FROM test_results WHERE user_id = ?', [uid]);
  const lessons = dbAll('SELECT lesson_id FROM lesson_progress WHERE user_id = ?', [uid]);
  res.json({ totalTests: total.count, totalChars: total.chars, totalTime: total.time, bestWpm: best.bestWpm || 0, avgWpm: Math.round(avg.avgWpm || 0), avgAccuracy: Math.round(avg.avgAcc || 0), lessonsCompleted: lessons.map(l => l.lesson_id) });
});

app.get('/api/leaderboard', (req, res) => {
  const leaders = dbAll(`SELECT u.username, u.display_name, u.avatar, MAX(t.wpm) as best_wpm, ROUND(AVG(t.accuracy)) as avg_accuracy, COUNT(t.id) as total_tests FROM users u JOIN test_results t ON u.id = t.user_id GROUP BY u.id ORDER BY best_wpm DESC LIMIT 20`);
  res.json({ leaders });
});

// Initialize and Listen
initDB().then(() => {
  app.listen(PORT, () => console.log(`\n  ⌨️  Velocis Typing is running at http://localhost:${PORT}\n`));
}).catch(err => console.error('DB INIT ERROR:', err));
