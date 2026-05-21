const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';
const DB_PATH = process.env.DB_PATH || (fs.existsSync('/data') ? '/data/velocis_typing.db' : path.join(__dirname, 'velocis_typing.db'));

// ══════════════════════════════════════════════════════════════
// 🛡️  SECURITY LAYER 1: HTTP Security Headers (via Helmet)
// ══════════════════════════════════════════════════════════════
// Helmet sets 15+ HTTP headers to prevent XSS, clickjacking,
// MIME-sniffing, and other common attacks.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: IS_PROD ? [] : null,
    }
  },
  crossOriginEmbedderPolicy: false, // Allow Google Fonts
  crossOriginResourcePolicy: { policy: "same-site" },
  // Prevent clickjacking (embedding site in iframes)
  frameguard: { action: 'deny' },
  // Prevent MIME-type sniffing
  noSniff: true,
  // Hide X-Powered-By header (hides that we use Express)
  hidePoweredBy: true,
  // Strict-Transport-Security (force HTTPS)
  hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  // Prevent XSS reflected attacks
  xssFilter: true,
  // Referrer policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ══════════════════════════════════════════════════════════════
// 🛡️  SECURITY LAYER 2: Rate Limiting (Anti-DDoS & Brute Force)
// ══════════════════════════════════════════════════════════════

// Global rate limiter: 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  keyGenerator: (req) => req.ip,
});
app.use(globalLimiter);

// Strict rate limiter for auth routes: 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// API rate limiter: 60 requests per minute
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'API rate limit exceeded. Please try again shortly.' },
});

// ══════════════════════════════════════════════════════════════
// 🛡️  SECURITY LAYER 3: Input Sanitization
// ══════════════════════════════════════════════════════════════

// Sanitize string input to prevent XSS and SQL injection payloads
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')         // Strip HTML tags
    .replace(/javascript:/gi, '') // Strip JS protocol
    .replace(/on\w+=/gi, '')      // Strip inline event handlers
    .trim()
    .slice(0, 500);               // Limit length to prevent overflow
}

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// Validate username: alphanumeric + underscores, 3-30 chars
function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

// Validate password strength: min 6 chars
function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
}

// Validate numeric input
function isValidNumber(val, min = 0, max = 999999) {
  const n = Number(val);
  return !isNaN(n) && n >= min && n <= max;
}

// ══════════════════════════════════════════════════════════════
// 🛡️  SECURITY LAYER 4: Error Handling (No Info Leaking)
// ══════════════════════════════════════════════════════════════
process.on('uncaughtException', (err) => {
  console.error('\n❌ UNCAUGHT EXCEPTION:', err.message);
  // Don't log stack trace in production (info leak)
});

process.on('unhandledRejection', (reason) => {
  console.error('\n❌ UNHANDLED REJECTION:', reason);
});

// ══════════════════════════════════════════════════════════════
// 🗄️  DATABASE (better-sqlite3 Powered with WAL Concurrency)
// ══════════════════════════════════════════════════════════════

let db;

async function initDB() {
  db = new Database(DB_PATH);
  
  // Enable WAL mode for high performance concurrent database access
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  
  db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    username TEXT UNIQUE NOT NULL, 
    email TEXT UNIQUE NOT NULL, 
    password TEXT NOT NULL, 
    display_name TEXT, 
    bio TEXT, 
    avatar TEXT, 
    experience TEXT, 
    keyboard_layout TEXT, 
    keyboard_model TEXT, 
    keyboard_switches TEXT, 
    is_admin INTEGER DEFAULT 0, 
    failed_logins INTEGER DEFAULT 0, 
    locked_until DATETIME, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  // Sync columns...
  const columns = ['bio', 'avatar', 'experience', 'keyboard_layout', 'keyboard_model', 'keyboard_switches', 'is_admin', 'failed_logins', 'locked_until', 'reset_token', 'reset_expires', 'verification_token', 'email_verified'];
  columns.forEach(col => { 
    try { 
      db.prepare(`ALTER TABLE users ADD COLUMN ${col} ${col === 'is_admin' || col === 'email_verified' ? 'INTEGER DEFAULT 0' : col === 'failed_logins' ? 'INTEGER DEFAULT 0' : 'TEXT'}`).run(); 
    } catch(e){} 
  });
  
  db.prepare(`CREATE TABLE IF NOT EXISTS test_results (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, wpm INTEGER, raw_wpm INTEGER, accuracy REAL, errors INTEGER, chars_typed INTEGER, duration INTEGER, difficulty TEXT, mode TEXT DEFAULT 'test', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS lesson_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, lesson_id INTEGER NOT NULL, best_wpm INTEGER DEFAULT 0, best_accuracy REAL DEFAULT 0, completed_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS site_visits (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, ip TEXT, user_agent TEXT, path TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  
  // Security audit log
  db.prepare(`CREATE TABLE IF NOT EXISTS security_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, ip TEXT, user_id INTEGER, details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  
  try { 
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_lesson ON lesson_progress(user_id, lesson_id)`).run(); 
  } catch(e) {}
}

function saveDB() {
  // No-op: better-sqlite3 writes directly and synchronously to disk on every statement
}

function dbGet(sql, params = []) {
  try {
    const row = db.prepare(sql).get(params);
    return row !== undefined ? row : null;
  } catch (err) {
    console.error('dbGet error:', err.message, 'SQL:', sql);
    return null;
  }
}

function dbRun(sql, params = []) {
  try {
    return db.prepare(sql).run(params);
  } catch (err) {
    console.error('dbRun error:', err.message, 'SQL:', sql);
    return null;
  }
}

function dbAll(sql, params = []) {
  try {
    return db.prepare(sql).all(params);
  } catch (err) {
    console.error('dbAll error:', err.message, 'SQL:', sql);
    return [];
  }
}

// Log security events
function logSecurity(event, req, userId = null, details = '') {
  try {
    dbRun('INSERT INTO security_log (event, ip, user_id, details) VALUES (?, ?, ?, ?)',
      [event, req.ip || 'unknown', userId, details]);
  } catch(e) { /* don't crash on log failure */ }
}

// ══════════════════════════════════════════════════════════════
// 🛡️  SECURITY LAYER 5: Secure Session Configuration
// ══════════════════════════════════════════════════════════════

// Body parser with strict size limit (prevents payload bombs)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Log site visits
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
    try {
      dbRun('INSERT INTO site_visits (user_id, ip, user_agent, path) VALUES (?, ?, ?, ?)',
        [null, req.ip || 'unknown', req.get('user-agent') || 'unknown', req.path]);
    } catch (e) { /* don't crash on logging failure */ }
  }
  next();
});

// Serve static files (BEFORE session to avoid unnecessary session creation)
app.use(express.static(__dirname, {
  dotfiles: 'deny',  // Block access to .env, .git, etc.
  index: 'index.html',
}));

// Block access to sensitive files
app.use((req, res, next) => {
  const blocked = ['.env', '.git', 'server.js', '.db', 'package.json', 'package-lock.json', 'node_modules'];
  const reqPath = req.path.toLowerCase();
  if (blocked.some(b => reqPath.includes(b)) && !reqPath.endsWith('.js.map')) {
    logSecurity('BLOCKED_FILE_ACCESS', req, null, req.path);
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  name: '_vid', // Disguised cookie name (not default "connect.sid")
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000, // Extend session life to 14 days
    httpOnly: true,      // Prevents JavaScript from reading the cookie (XSS protection)
    secure: IS_PROD,     // Only send cookie over HTTPS in production
    sameSite: 'lax',     // Prevents CSRF from cross-origin requests
    path: '/',
  },
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: fs.existsSync('/data') ? '/data' : __dirname,
    concurrentDb: true
  })
}));

app.use(passport.initialize());
app.use(passport.session());


// ══════════════════════════════════════════════════════════════
// 🛡️  SECURITY LAYER 6: CSRF Protection for State-Changing Requests
// ══════════════════════════════════════════════════════════════

// Simple origin validation for POST/PUT/DELETE requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.get('origin') || req.get('referer') || '';
    const host = req.get('host') || '';
    // Allow same-origin requests and localhost for dev
    if (origin && !origin.includes(host) && !origin.includes('localhost')) {
      logSecurity('CSRF_BLOCKED', req, null, `Origin: ${origin}`);
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  next();
});

// ══════════════════════════════════════════════════════════════
// 🔐  PASSPORT AUTHENTICATION
// ══════════════════════════════════════════════════════════════

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = dbGet('SELECT id, username, email, display_name, is_admin FROM users WHERE id = ?', [id]);
  done(null, user);
});

const findOrCreateSocialUser = (profile, provider) => {
  const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@${provider}.local`;
  let user = dbGet('SELECT * FROM users WHERE email = ?', [sanitize(email)]);
  
  if (!user) {
    const username = sanitize((profile.username || profile.displayName || profile.id).replace(/\s+/g, '').toLowerCase() + '_' + provider);
    const dummyPass = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
    dbRun('INSERT INTO users (username, email, password, display_name, avatar) VALUES (?, ?, ?, ?, ?)',
      [username, sanitize(email), dummyPass, sanitize(profile.displayName || profile.username || ''), profile.photos ? profile.photos[0].value : null]);
    user = dbGet('SELECT * FROM users WHERE email = ?', [sanitize(email)]);
  }
  return user;
};

const registerStrategy = (name, Strategy, config, scope) => {
  const hasRealKeys = config.clientID && !config.clientID.includes('your_');
  
  if (hasRealKeys) {
    passport.use(name, new Strategy(config, (accessToken, refreshToken, profile, done) => {
      done(null, findOrCreateSocialUser(profile, name));
    }));
  } else {
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

// ══════════════════════════════════════════════════════════════
// 🔐  AUTH ROUTES (Rate Limited)
// ══════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════
// 📡  API ROUTES (All protected)
// ══════════════════════════════════════════════════════════════

app.get('/api/me', apiLimiter, (req, res) => {
  const userId = req.session.userId || (req.user ? req.user.id : null);
  if (!userId) return res.json({ user: null });
  // Never expose password hash or security fields
  const user = dbGet('SELECT id, username, email, display_name, bio, avatar, experience, keyboard_layout, keyboard_model, keyboard_switches, is_admin FROM users WHERE id = ?', [userId]);
  if (!user) return res.json({ user: null });
  res.json({ user: { ...user, displayName: user.display_name, isAdmin: user.is_admin } });
});

// 🛡️ Login with brute-force protection
app.post('/api/login', authLimiter, (req, res) => {
  const { username, password } = req.body;

  // Input validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUsername = sanitize(username).toLowerCase();
  const user = dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [cleanUsername, cleanUsername]);

  // Check if account is locked
  if (user && user.locked_until) {
    const lockTime = new Date(user.locked_until).getTime();
    if (Date.now() < lockTime) {
      const minutesLeft = Math.ceil((lockTime - Date.now()) / 60000);
      logSecurity('LOGIN_LOCKED', req, user.id, `Account locked, ${minutesLeft}m remaining`);
      return res.status(423).json({ error: `Account locked. Try again in ${minutesLeft} minutes.` });
    }
    // Lock expired, reset
    dbRun('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', [user.id]);
  }

  if (!user || !bcrypt.compareSync(password, user.password)) {
    // Track failed attempts
    if (user) {
      const failCount = (user.failed_logins || 0) + 1;
      if (failCount >= 5) {
        // Lock account for 15 minutes after 5 failed attempts
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        dbRun('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', [failCount, lockUntil, user.id]);
        logSecurity('ACCOUNT_LOCKED', req, user.id, `${failCount} failed attempts`);
        return res.status(423).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
      }
      dbRun('UPDATE users SET failed_logins = ? WHERE id = ?', [failCount, user.id]);
    }
    logSecurity('LOGIN_FAILED', req, user ? user.id : null, `Username: ${cleanUsername}`);
    // Generic message to prevent username enumeration
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Successful login — reset failed attempts & regenerate session
  dbRun('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', [user.id]);
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.userId = user.id;
    logSecurity('LOGIN_SUCCESS', req, user.id);
    // Never send password hash to client — map DB fields to client fields
    const { password: _, failed_logins: __, locked_until: ___, ...safeUser } = user;
    safeUser.displayName = safeUser.display_name || safeUser.username;
    safeUser.isAdmin = safeUser.is_admin || 0;
    res.json({ success: true, user: safeUser });
  });
});

// 🛡️ Registration with full validation
app.post('/api/register', authLimiter, (req, res) => {
  const { username, email, password, displayName } = req.body;

  // Comprehensive input validation
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-30 characters (letters, numbers, underscores only)' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Password must be 6-128 characters' });
  }

  const cleanUsername = sanitize(username).toLowerCase();
  const cleanEmail = sanitize(email).toLowerCase();
  const cleanDisplayName = sanitize(displayName || username);

  const exists = dbGet('SELECT id FROM users WHERE username = ? OR email = ?', [cleanUsername, cleanEmail]);
  if (exists) return res.status(400).json({ error: 'Username or email already taken' });

  // Use higher bcrypt rounds for stronger hashing
  const hash = bcrypt.hashSync(password, 12);
  dbRun('INSERT INTO users (username, email, password, display_name) VALUES (?, ?, ?, ?)',
    [cleanUsername, cleanEmail, hash, cleanDisplayName]);
  const user = dbGet('SELECT id, username, email, display_name FROM users WHERE username = ?', [cleanUsername]);
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.userId = user.id;
    logSecurity('REGISTER_SUCCESS', req, user.id);
    user.displayName = user.display_name || user.username;
    res.json({ success: true, user });
  });
});

// Check username availability (real-time helper)
app.get('/api/check-username', (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  const cleanUsername = sanitize(username).trim().toLowerCase();
  
  if (!isValidUsername(cleanUsername)) {
    return res.json({ available: false, reason: 'invalid' });
  }
  
  const exists = dbGet('SELECT id FROM users WHERE username = ?', [cleanUsername]);
  res.json({ available: !exists });
});

// 🛡️ Profile update
app.put('/api/profile', apiLimiter, (req, res) => {
  const uid = req.session.userId || (req.user ? req.user.id : null);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const { displayName, bio, avatar, experience, keyboardLayout, keyboardModel, keyboardSwitches } = req.body;

  const cleanDisplayName = sanitize(displayName || '');
  const cleanBio = sanitize(bio || '');
  const cleanExperience = sanitize(experience || '');
  const cleanLayout = sanitize(keyboardLayout || '');
  const cleanModel = sanitize(keyboardModel || '');
  const cleanSwitches = sanitize(keyboardSwitches || '');

  // Validate avatar size (base64 data URL) — max ~350KB
  let safeAvatar = null;
  if (avatar && typeof avatar === 'string') {
    if (avatar.length > 500000) {
      return res.status(400).json({ error: 'Avatar image is too large' });
    }
    safeAvatar = avatar;
  }

  dbRun(`UPDATE users SET display_name = ?, bio = ?, avatar = ?, experience = ?, keyboard_layout = ?, keyboard_model = ?, keyboard_switches = ? WHERE id = ?`,
    [cleanDisplayName, cleanBio, safeAvatar, cleanExperience, cleanLayout, cleanModel, cleanSwitches, uid]);

  const user = dbGet('SELECT id, username, email, display_name, bio, avatar, experience, keyboard_layout, keyboard_model, keyboard_switches, is_admin FROM users WHERE id = ?', [uid]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ success: true, user: { ...user, displayName: user.display_name, isAdmin: user.is_admin } });
});

app.post('/api/logout', (req, res) => {
  const uid = req.session ? req.session.userId : null;
  if (req.session) {
    req.logout((err) => {
      if (req.session) {
        req.session.destroy((destroyErr) => {
          res.clearCookie('_vid');
          if (uid) logSecurity('LOGOUT', req, uid);
          res.json({ success: true });
        });
      } else {
        res.clearCookie('_vid');
        res.json({ success: true });
      }
    });
  } else {
    res.clearCookie('_vid');
    res.json({ success: true });
  }
});



// ══════════════════════════════════════════════════════════════
// ✉️  EMAIL VERIFICATION SYSTEM
// ══════════════════════════════════════════════════════════════

// Resend verification email
app.post('/api/resend-verification', authLimiter, (req, res) => {
  const uid = req.session.userId || (req.user ? req.user.id : null);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const user = dbGet('SELECT id, email, email_verified, verification_token FROM users WHERE id = ?', [uid]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.email_verified) return res.json({ success: true, message: 'Email already verified' });

  const token = crypto.randomBytes(32).toString('hex');
  dbRun('UPDATE users SET verification_token = ? WHERE id = ?', [token, uid]);

  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      const verifyUrl = `${req.protocol}://${req.get('host')}/?verify=${token}`;
      transporter.sendMail({
        from: process.env.SMTP_FROM || '"Velocis Typing" <noreply@velocistyping.com>',
        to: user.email,
        subject: 'Verify Your Email — Velocis Typing',
        html: `<div style="font-family:system-ui;max-width:500px;margin:0 auto;padding:30px;background:#0a0a1a;color:#fff;border-radius:16px">
          <h2 style="color:#00d4ff">✉️ Verify Your Email</h2>
          <p>Click below to verify your email address.</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#0071e3;color:#fff;border-radius:12px;text-decoration:none;font-weight:600;margin:20px 0">Verify Email</a>
        </div>`
      });
    } catch(e) { console.log('[Email] Verification send failed:', e.message); }
  } else {
    console.log(`\n  ✉️ Verification token for ${user.email}: ${token}\n`);
  }

  res.json({ success: true, message: 'Verification email sent' });
});

// Verify email with token
app.get('/api/verify-email/:token', (req, res) => {
  const token = sanitize(req.params.token);
  const user = dbGet('SELECT id FROM users WHERE verification_token = ?', [token]);
  if (!user) return res.status(400).json({ error: 'Invalid verification link' });

  dbRun('UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?', [user.id]);
  logSecurity('EMAIL_VERIFIED', req, user.id);
  res.json({ success: true, message: 'Email verified successfully!' });
});

// 🛡️ Results submission with validation
app.post('/api/results', apiLimiter, (req, res) => {
  const uid = req.session.userId || (req.user ? req.user.id : null);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const { wpm, rawWpm, accuracy, errors, chars, duration, difficulty, mode } = req.body;

  // Validate all numeric inputs to prevent data injection
  if (!isValidNumber(wpm, 0, 500) || !isValidNumber(rawWpm, 0, 500) ||
      !isValidNumber(accuracy, 0, 100) || !isValidNumber(errors, 0, 99999) ||
      !isValidNumber(chars, 0, 99999) || !isValidNumber(duration, 1, 7200)) {
    return res.status(400).json({ error: 'Invalid test data' });
  }

  const safeDifficulty = sanitize(difficulty || 'easy');
  const safeMode = sanitize(mode || 'test');

  dbRun('INSERT INTO test_results (user_id, wpm, raw_wpm, accuracy, errors, chars_typed, duration, difficulty, mode) VALUES (?,?,?,?,?,?,?,?,?)',
    [uid, Number(wpm), Number(rawWpm), Number(accuracy), Number(errors), Number(chars), Number(duration), safeDifficulty, safeMode]);
  res.json({ success: true });
});

app.post('/api/lessons/:id/complete', apiLimiter, (req, res) => {
  const uid = req.session.userId || (req.user ? req.user.id : null);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  
  const lessonId = parseInt(req.params.id);
  const { wpm, accuracy } = req.body;
  
  if (isNaN(lessonId)) return res.status(400).json({ error: 'Invalid lesson ID' });
  
  const existing = dbGet('SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?', [uid, lessonId]);
  if (existing) {
    const bestWpm = Math.max(existing.best_wpm, wpm || 0);
    const bestAcc = Math.max(existing.best_accuracy, accuracy || 0);
    dbRun('UPDATE lesson_progress SET best_wpm = ?, best_accuracy = ? WHERE user_id = ? AND lesson_id = ?', [bestWpm, bestAcc, uid, lessonId]);
  } else {
    dbRun('INSERT INTO lesson_progress (user_id, lesson_id, best_wpm, best_accuracy) VALUES (?,?,?,?)', [uid, lessonId, wpm || 0, accuracy || 0]);
  }
  res.json({ success: true });
});

app.get('/api/results', apiLimiter, (req, res) => {
  const uid = req.session.userId || (req.user ? req.user.id : null);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  const results = dbAll('SELECT wpm, raw_wpm, accuracy, errors, chars_typed, duration, difficulty, created_at FROM test_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [uid]);
  res.json({ results });
});

app.get('/api/stats', apiLimiter, (req, res) => {
  const uid = req.session.userId || (req.user ? req.user.id : null);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  const total = dbGet('SELECT COUNT(*) as count, COALESCE(SUM(chars_typed),0) as chars, COALESCE(SUM(duration),0) as time FROM test_results WHERE user_id = ?', [uid]);
  const best = dbGet('SELECT MAX(wpm) as bestWpm FROM test_results WHERE user_id = ?', [uid]);
  const avg = dbGet('SELECT AVG(wpm) as avgWpm, AVG(accuracy) as avgAcc FROM test_results WHERE user_id = ?', [uid]);
  const lessons = dbAll('SELECT lesson_id FROM lesson_progress WHERE user_id = ?', [uid]);
  res.json({ totalTests: total.count, totalChars: total.chars, totalTime: total.time, bestWpm: best.bestWpm || 0, avgWpm: Math.round(avg.avgWpm || 0), avgAccuracy: Math.round(avg.avgAcc || 0), lessonsCompleted: lessons.map(l => l.lesson_id) });
});

app.get('/api/leaderboard', apiLimiter, (req, res) => {
  const leaders = dbAll(`SELECT u.username, u.display_name, u.avatar, MAX(t.wpm) as best_wpm, ROUND(AVG(t.accuracy)) as avg_accuracy, COUNT(t.id) as total_tests FROM users u JOIN test_results t ON u.id = t.user_id GROUP BY u.id ORDER BY best_wpm DESC LIMIT 20`);
  res.json({ leaders });
});

app.get('/api/admin/stats', apiLimiter, (req, res) => {
  const uid = req.session.userId || (req.user ? req.user.id : null);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const user = dbGet('SELECT is_admin FROM users WHERE id = ?', [uid]);
  if (!user || !user.is_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const totalVisitsRow = dbGet('SELECT COUNT(*) as count FROM site_visits');
    const uniqueVisitorsRow = dbGet('SELECT COUNT(DISTINCT ip) as count FROM site_visits');

    // Chronological history over last 14 days
    const historyMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      historyMap[dateStr] = 0;
    }

    const historyRows = dbAll(`
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM site_visits 
      WHERE created_at >= DATE('now', '-13 days') 
      GROUP BY DATE(created_at)
    `);

    historyRows.forEach(row => {
      if (historyMap[row.date] !== undefined) {
        historyMap[row.date] = row.count;
      }
    });

    const history = Object.keys(historyMap).sort().map(date => ({
      date,
      count: historyMap[date]
    }));

    const recentVisits = dbAll('SELECT ip, created_at FROM site_visits ORDER BY created_at DESC LIMIT 10');
    const browsers = dbAll('SELECT user_agent, COUNT(*) as count FROM site_visits GROUP BY user_agent ORDER BY count DESC');

    res.json({
      totalVisits: totalVisitsRow ? totalVisitsRow.count : 0,
      uniqueVisitors: uniqueVisitorsRow ? uniqueVisitorsRow.count : 0,
      history,
      recentVisits,
      browsers
    });
  } catch (err) {
    console.error('Error generating admin stats:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════
// 🛡️  SECURITY LAYER 7: Catch-All Error Handler (No Stack Leaks)
// ══════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  logSecurity('SERVER_ERROR', req, null, err.message);
  // Never expose internal error details to the client
  res.status(500).json({ error: 'Something went wrong' });
});

// Catch 404s
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ══════════════════════════════════════════════════════════════
// 🚀  START SERVER
// ══════════════════════════════════════════════════════════════
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  ⌨️  Velocis Typing is running at http://localhost:${PORT}`);
    console.log(`  🛡️  Security: Helmet, Rate-Limiting, Brute-Force Protection, XSS/CSRF Guards ACTIVE\n`);
  });
}).catch(err => console.error('DB INIT ERROR:', err));
