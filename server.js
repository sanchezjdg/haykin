// server.js
// -----------------------------
// Serves the static HTML + assets,
// provides `/latest` endpoint to fetch the live point.

const express = require('express');
const path = require('path');
require('dotenv').config();

const { getLatestPosition, getAllPhones } = require('./dynamoDB');
const app = express();
const PORT = process.env.PORT || 3000;

// JSON endpoint for getting all device phones
app.get('/devices', async (req, res) => {
  const phones = await getAllPhones();
  res.json(phones);
});

// JSON endpoint for the latest position
app.get('/latest', async (req, res) => {
  const phone = req.query.phone;
  const latest = await getLatestPosition(phone);
  if (latest) return res.json(latest);
  res.status(404).json({ message: 'No data found' });
});

// Serve all files in project root (HTML, libs, pointclouds…)
app.use(express.static(path.join(__dirname)));

// Fallback to main HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Malecon1.html'));
});

app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);