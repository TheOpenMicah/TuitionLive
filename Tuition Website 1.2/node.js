const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();

// --- CONFIGURATION ---\
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './responses.db';
// This is the password for viewing the responses page. CHANGE THIS to something secure!
const ADMIN_PASSWORD = 'CorrectHorseBatteryStaple'; 

// --- MIDDLEWARE ---\
app.use(cors());
app.use(bodyParser.json());
// Serve static files (HTML, CSS, video) from the 'public' directory
// Assuming index.html, responses.html and video are at the root or a 'public' folder
app.use(express.static(path.join(__dirname))); 
app.use(express.static(path.join(__dirname, 'public')));


// --- DATABASE INITIALIZATION ---\
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
  console.log('Received form data:', req.body); // Debug log
  db.run(
    `INSERT INTO responses (parentName, childAge, tuitionReason, needs, otherNeeds, contactMethod, phoneNumber, emailAddress, otherContact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [parentName, childAge, tuitionReason, needs, otherNeeds, contactMethod, phoneNumber, emailAddress, otherContact],
    function (err) {
      if (err) {
        console.error('Database insert error:', err);
        res.status(500).json({ error: 'Failed to submit response.' });
      } else {
        console.log('Inserted response with ID:', this.lastID); // Debug log
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
      console.error('Un-action DB error:', err); // Debug log
      res.status(500).json({ error: err.message });
    } else {
      console.log(`Response ${id} marked as un-actioned.`); // Debug log
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

// Serve responses.html
app.get('/responses.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'responses.html'));
});

// Serve index.html as the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- SERVER START ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
