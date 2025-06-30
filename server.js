// server.js
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./pid_system.db');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'pid_secret',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pid_inputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kp REAL, ki REAL, kd REAL, setpoint REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pid_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temperature REAL, output REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.get(`SELECT * FROM users WHERE username = ?`, ['admin'], (err, row) => {
    if (!row) {
      bcrypt.hash('1234', 10, (err, hash) => {
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, ['admin', hash]);
      });
    }
  });
});

// Authentication middleware
function checkAuth(req, res, next) {
  if (req.session.user) return next();
  return res.redirect('/login.html');
}

// Routes
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user) return res.redirect('/login.html?error=1');
    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        req.session.user = user;
        return res.redirect('/dashboard.html');
      } else {
        return res.redirect('/login.html?error=1');
      }
    });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login.html');
});

app.post('/update', checkAuth, (req, res) => {
  const { kp, ki, kd, setpoint } = req.body;
  db.run(`INSERT INTO pid_inputs (kp, ki, kd, setpoint) VALUES (?, ?, ?, ?)`,
    [kp, ki, kd, setpoint], err => {
      if (err) return res.status(500).json({ message: 'DB error' });
      res.json({ message: 'PID values updated' });
    });
});

app.get('/latest-output', checkAuth, (req, res) => {
  db.get(`SELECT * FROM pid_outputs ORDER BY id DESC LIMIT 1`, (err, row) => {
    if (err || !row) return res.json({ temperature: '--', output: '--' });
    res.json(row);
  });
});

app.get('/esp32/get-pid', (req, res) => {
  db.get(`SELECT * FROM pid_inputs ORDER BY id DESC LIMIT 1`, (err, row) => {
    if (err || !row) return res.json({ kp: 0, ki: 0, kd: 0, setpoint: 0 });
    res.json(row);
  });
});

app.post('/esp32/update-output', (req, res) => {
  const { temperature, output } = req.body;
  db.run(`INSERT INTO pid_outputs (temperature, output) VALUES (?, ?)`,
    [temperature, output]);
  res.json({ message: 'Output logged' });
});

app.get('/graph-data', checkAuth, (req, res) => {
  db.all(`SELECT * FROM pid_outputs ORDER BY timestamp ASC LIMIT 100`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Could not fetch data' });
    res.json(rows);
  });
});

app.get('/export-csv', checkAuth, (req, res) => {
  db.all(`SELECT * FROM pid_outputs ORDER BY timestamp ASC`, (err, rows) => {
    if (err) return res.status(500).send('Error exporting');

    let csv = "timestamp,temperature,output\n";
    rows.forEach(r => {
      csv += `${r.timestamp},${r.temperature},${r.output}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('pid_output.csv');
    res.send(csv);
  });
});

// Start server
app.listen(3000, () => console.log('🚀 Server running at http://localhost:3000'));
