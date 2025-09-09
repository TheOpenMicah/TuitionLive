const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const DISK_MOUNT_PATH = '/var/data'; 
const DB_PATH = path.join(DISK_MOUNT_PATH, 'responses.db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CorrectHorseBatteryStaple'; 

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- ASYNCHRONOUS SERVER START FUNCTION ---
const startServer = async () => {
  try {
    // Ensure the persistent disk directory exists
    await fs.mkdir(DISK_MOUNT_PATH, { recursive: true });
    console.log(`Ensured directory exists at ${DISK_MOUNT_PATH}`);

    // Connect to the database
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

    // Create the table with the correct columns if it doesn't exist
    await db.run(`CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parentName TEXT,
      childName TEXT,
      childAge TEXT,
      tuitionReason TEXT,
      needs TEXT,
      otherNeeds TEXT,
      additionalInfo TEXT,
      phoneNumber TEXT,
      emailAddress TEXT,
      actioned INTEGER DEFAULT 0,
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Database table "responses" is ready.');

    // --- API ROUTES ---

    // API to submit the form
    app.post('/api/submit', (req, res) => {
      // Destructure only the fields sent from the updated form
      const { parentName, childName, childAge, tuitionReason, needs, otherNeeds, additionalInfo, phoneNumber, emailAddress } = req.body;
      
      const needsString = Array.isArray(needs) ? needs.join(', ') : needs;

      // Updated INSERT statement to match the new data structure
      db.run(
        `INSERT INTO responses (parentName, childName, childAge, tuitionReason, needs, otherNeeds, additionalInfo, phoneNumber, emailAddress) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [parentName, childName, childAge, tuitionReason, needsString, otherNeeds, additionalInfo, phoneNumber, emailAddress],
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

    // API to get all responses
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
    app.listen(PORT, () => {
      console.log(`Server is running and listening on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
};

// --- RUN THE SERVER ---
startServer();

