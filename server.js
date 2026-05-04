require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const dbPath = path.join(__dirname, 'db.json');

// JSON DB helpers
function readDB() {
  if (!fs.existsSync(dbPath)) return {};
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'super_secret_study_tracker_key_12345',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport Google Strategy Configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    const user = {
      id: profile.id,
      name: profile.displayName,
      email: profile.emails && profile.emails[0] ? profile.emails[0].value : ''
    };
    return done(null, user);
  }
));

// Serialize user into the session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from the session
passport.deserializeUser((user, done) => {
  done(null, user);
});

// --- AUTH ROUTES ---

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/api/current_user', (req, res) => {
  res.send(req.user || null);
});

app.get('/api/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// --- GLOBAL STATE API (Session fallback) ---
app.post('/api/state', (req, res) => {
  if (!req.user) return res.status(401).send('Unauthorized');
  req.session.appState = req.body;
  res.send({ success: true });
});

app.get('/api/state', (req, res) => {
  if (!req.user) return res.status(401).send('Unauthorized');
  res.send(req.session.appState || null);
});

// --- STUDY DATA API (JSON DB) ---
app.post('/api/study-data', (req, res) => {
  if (!req.user) return res.status(401).send('Unauthorized');
  const { date, studyHours, tasksCompleted } = req.body;
  if (!date) return res.status(400).send({ error: 'Date is required' });
  
  const db = readDB();
  const userId = req.user.id || req.user.email || 'guest';
  if (!db[userId]) db[userId] = {};
  
  db[userId][date] = { studyHours, tasksCompleted };
  writeDB(db);
  res.send({ success: true });
});

app.get('/api/study-data', (req, res) => {
  if (!req.user) return res.status(401).send('Unauthorized');
  const { date } = req.query;
  const db = readDB();
  const userId = req.user.id || req.user.email || 'guest';
  const userData = db[userId] || {};
  
  if (date) {
    res.send(userData[date] || { studyHours: 0, tasksCompleted: 0 });
  } else {
    res.send(userData);
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
