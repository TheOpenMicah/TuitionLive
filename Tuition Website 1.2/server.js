const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises; // Using promises version of fs
const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
// On Render, this path points to your persistent disk.
const DISK_MOUNT_PATH = '/var/data'; 
const DB_PATH = path.join(DISK_MOUNT_PATH, 'responses.db');
// It's best practice to use an environment variable for the password.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CorrectHorseBatteryStaple'; 

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());

// **FIX 1: CLEANER STATIC FILE SERVING**
// Serve all static files (HTML, CSS, video) from the 'public' directory.
// This is more secure and organized than serving the entire root directory.
// Make sure your index.html, responses.html, and presentation.mp4 are inside the 'public' folder.
app.use(express.static(path.join(__dirname, 'public')));


// --- ASYNCHRONOUS SERVER START FUNCTION ---
// We wrap the entire server startup in an async function to handle database initialization properly.
const startServer = async () => {
  try {
    // **FIX 2: AWAIT DATABASE CONNECTION**
    // Ensure the directory for the database exists.
    await fs.mkdir(DISK_MOUNT_PATH, { recursive: true });
    console.log(`Ensured directory exists at ${DISK_MOUNT_PATH}`);

    // Connect to the database and wait for it to be ready.
    const db = await new Promise((resolve, reject) => {
      const database = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Could not connect to database', err);
          return reject(err);
        }
        console.log('Connected to SQLite database at:', DB_PATH);
        resolve(database);
      });
    });

    // Create the table if it doesn't exist.
    await db.run(`CREATE TABLE IF NOT EXISTS responses (
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
    console.log('Database table "responses" is ready.');

    // --- API ROUTES ---
    // All API routes are defined *after* the database is confirmed to be connected.

    // API to submit the form
    app.post('/api/submit', (req, res) => {
      const { parentName, childAge, tuitionReason, needs, otherNeeds, contactMethod, phoneNumber, emailAddress, otherContact } = req.body;
      
      // **FIX 3: CORRECT DATA HANDLING**
      // Convert array of 'needs' to a human-readable, comma-separated string.
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
      const { password } = req.body;
      // It's good practice to password-protect actions that modify data.
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
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
      const { password } = req.body;
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
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

    // --- SERVER START ---
    // The server only starts listening after all setup is complete.
    app.listen(PORT, () => {
      console.log(`Server is running and listening on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1); // Exit the process if the database can't be initialized
  }
};

// --- RUN THE SERVER ---
startServer();
