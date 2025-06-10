// api/index.js - Vercel Serverless Compatible
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Import models
const Video = require('../server/models/Video');
const Product = require('../server/models/Product');
const User = require('../server/models/User');
const Leaderboard = require('../server/models/Leaderboard');

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

// GET current month leaderboard
app.get('/api/leaderboard/monthly', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await Leaderboard.getCurrentMonthLeaderboard(limit);
    
    res.json({
      success: true,
      leaderboard: leaderboard,
      month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

// POST submit new score
app.post('/api/leaderboard/submit', async (req, res) => {
  try {
    const { playerName, playerEmail, score, gameSession } = req.body;
    
    // Validate required fields
    if (!playerName || !playerEmail || !score) {
      return res.status(400).json({
        success: false,
        error: 'Player name, email, and score are required'
      });
    }
    
    // Validate score is a positive number
    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({
        success: false,
        error: 'Score must be a positive number'
      });
    }
    
    // Submit score
    const result = await Leaderboard.submitScore({
      playerName: playerName.trim(),
      playerEmail: playerEmail.toLowerCase().trim(),
      score,
      gameSession
    });
    
    // Get updated leaderboard
    const leaderboard = await Leaderboard.getCurrentMonthLeaderboard(10);
    
    // Get player's rank
    const playerRank = await Leaderboard.getPlayerRank(playerEmail.toLowerCase().trim());
    
    res.json({
      success: true,
      isNewBest: result.isNewBest,
      score,
      playerRank,
      leaderboard,
      message: result.isNewBest ? 
        `New best score! You're rank #${playerRank || 'unranked'}` : 
        `Score submitted! Your best this month is still ${result.existingBest}`
    });
    
  } catch (error) {
    console.error('Error submitting score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit score'
    });
  }
});

// GET player's best score and rank
app.get('/api/leaderboard/player/:email', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    
    const bestScore = await Leaderboard.getPlayerBestScore(email);
    const rank = await Leaderboard.getPlayerRank(email);
    
    res.json({
      success: true,
      bestScore: bestScore ? bestScore.score : 0,
      rank: rank,
      hasPlayed: !!bestScore
    });
    
  } catch (error) {
    console.error('Error fetching player data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player data'
    });
  }
});

// GET monthly stats
app.get('/api/leaderboard/stats', async (req, res) => {
  try {
    const now = new Date();
    const stats = await Leaderboard.getMonthlyStats(now.getFullYear(), now.getMonth());
    
    res.json({
      success: true,
      stats: stats[0] || {
        uniquePlayers: 0,
        totalGames: 0,
        highestScore: 0,
        averageScore: 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats'
    });
  }
});

// Export the Express API
module.exports = app;