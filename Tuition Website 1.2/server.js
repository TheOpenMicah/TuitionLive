const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises; // Import fs for directory check
const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
// IMPORTANT: Use a consistent path on the persistent disk.
// The DB_PATH should be inside the disk mount path.
const DISK_MOUNT_PATH = '/var/data';
const DB_PATH = path.join(DISK_MOUNT_PATH, 'responses.db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CorrectHorseBatteryStaple'; 

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
// Serve static files from the root directory
app.use(express.static(path.join(__dirname))); 


// Middleware to ensure the directory for the database exists before connecting
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Ensured directory exists at ${dirPath}`);
  } catch (err) {
    console.error(`Error creating directory at ${dirPath}:`, err);
  }
};


// --- DATABASE INITIALIZATION ---
let db;

const initializeDatabase = async () => {
  await ensureDirectoryExists(DISK_MOUNT_PATH);

  db = new sqlite3.Database(DB_PATH, (err) => {
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
      )`, (err) => {
        if (err) {
          console.error('Error creating table:', err.message);
        } else {
          console.log('Database table "responses" created or already exists.');
        }
      });
    }
  });
};

// --- API ENDPOINTS ---

// API to submit a new response
app.post('/api/submit', (req, res) => {
  const { parentName, childAge, tuitionReason, needs, otherNeeds, emailAddress, phoneNumber, otherContact, contactMethod } = req.body;
  const sql = `INSERT INTO responses (parentName, childAge, tuitionReason, needs, otherNeeds, emailAddress, phoneNumber, otherContact, contactMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [parentName, childAge, tuitionReason, JSON.stringify(needs), otherNeeds, emailAddress, phoneNumber, otherContact, contactMethod], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      console.error('Submit DB error:', err);
    } else {
      res.json({ id: this.lastID, success: true });
    }
  });
});

// API to get responses (password-protected)
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
  }
  );
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

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// Start the server after initializing the database
app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  console.log('Initializing database...');
  await initializeDatabase();
});
