// api/index.js - Vercel Serverless Compatible
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Import models
const Video = require('../server/models/Video');
const Product = require('../server/models/Product');
const User = require('../server/models/User');

// Import automation routes
const automationRoutes = require('../server/routes/automation');

// Initialize express
const app = express();

// Database connection - FIXED: Use MONGODB_URI (not MONGO_URI)
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/videoshop', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected to:', process.env.MONGODB_URI || process.env.MONGO_URI))
.catch(err => console.log('❌ MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());

// ❌ REMOVED: All file system operations that crash on Vercel
// ❌ REMOVED: Directory creation
// ❌ REMOVED: File upload handling (use cloud storage instead)

// API Routes - THESE ARE THE IMPORTANT ONES!
app.use('/api/automation', automationRoutes);
app.use('/api/checkout', require('../server/routes/checkout'));
app.use('/api/auth', require('../server/routes/auth'));

// Simple test routes
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'API is working!',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/auth/test', (req, res) => {
  res.json({ msg: 'Auth route works', env: process.env.NODE_ENV });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Export the Express API
module.exports = app;