const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
// On Render, the database needs to be in a persistent storage location.
// We'll use an environment variable to set this path on the server.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'responses.db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CorrectHorseBatteryStaple'; // Use environment variable for password

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
// Serve all static files (like index.html) from the root directory.
// This is simpler and works well for your project structure.
app.use(express.static(path.join(__dirname)));


// --- DATABASE INITIALIZATION ---
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
    db.run(`CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parentName TEXT,
      childAge TEXT,
      tuitionReason TEXT,
      needs TEXT,
      otherNeeds TEXT,
      contactMethod TEXT,
      phoneNumber TEXT,
      emailAddress TEXT,
      otherContact TEXT,
      actioned INTEGER DEFAULT 0,
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// --- API ROUTES ---

// API to submit the form
app.post('/api/submit', (req, res) => {
  const { parentName, childAge, tuitionReason, needs, otherNeeds, contactMethod, phoneNumber, emailAddress, otherContact } = req.body;
  // Convert array of 'needs' to a comma-separated string for database storage
  const needsString = Array.isArray(needs) ? needs.join(', ') : needs;
  
  db.run(
    `INSERT INTO responses (parentName, childAge, tuitionReason, needs, otherNeeds, contactMethod, phoneNumber, emailAddress, otherContact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [parentName, childAge, tuitionReason, needsString, otherNeeds, contactMethod, phoneNumber, emailAddress, otherContact],
    function (err) {
      if (err) {
        console.error('Database insert error:', err);
        res.status(500).json({ error: 'Failed to submit response.' });
      } else {
        res.json({ success: true, id: this.lastID });
      }
    }
  );
});

// API to get all responses (requires password)
app.post('/api/responses', (req, res) => {
  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  db.all('SELECT * FROM responses ORDER BY actioned ASC, submittedAt DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// API to mark a response as actioned
app.post('/api/actioned/:id', (req, res) => {
  const id = req.params.id;
  db.run('UPDATE responses SET actioned = 1 WHERE id = ?', [id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

// API to mark a response as un-actioned
app.post('/api/unactioned/:id', (req, res) => {
  const id = req.params.id;
  db.run('UPDATE responses SET actioned = 0 WHERE id = ?', [id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

// API to delete all actioned responses
app.post('/api/delete-actioned', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  db.run('DELETE FROM responses WHERE actioned = 1', function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});


// --- HTML SERVING ---
// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- SERVER START ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
