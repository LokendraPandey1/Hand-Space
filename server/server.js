const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Serve Static Files (Frontend)
const clientPath = path.join(__dirname, '../'); // Root is one level up
app.use(express.static(clientPath));

// Database Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/handspace';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/models', require('./routes/models'));
app.use('/api/quiz', require('./routes/quiz'));

// Config endpoint to serve API keys to frontend
app.get('/api/config', (req, res) => {
    res.json({
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
    });
});

// Fallback for SPA (Single Page App) behavior if needed, 
// though we mostly have distinct html pages.
app.get('/', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
