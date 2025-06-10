// server/models/Leaderboard.js
const mongoose = require('mongoose');

const LeaderboardSchema = new mongoose.Schema({
  // Player information
  playerName: {
    type: String,
    required: true,
    trim: true
  },
  playerEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Score data
  score: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Monthly competition tracking
  month: {
    type: String,
    required: true,
    // Format: "2025-5" (year-month)
    index: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  monthNumber: {
    type: Number,
    required: true,
    min: 0,
    max: 11 // JavaScript months are 0-11
  },
  
  // Game metadata
  gameSession: {
    duration: Number, // seconds played
    itemsCollected: Number,
    gameSpeed: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  
  // Ranking tracking
  isWinner: {
    type: Boolean,
    default: false
  },
  rank: {
    type: Number,
    min: 1
  },
  
  // User linking (optional - for registered users)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true
  },
  
  // Competition metadata
  competitionStatus: {
    type: String,
    enum: ['active', 'ended', 'winner_announced'],
    default: 'active'
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
LeaderboardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for performance
LeaderboardSchema.index({ month: 1, score: -1 }); // Monthly leaderboard sorted by score
LeaderboardSchema.index({ playerEmail: 1, month: 1 }); // Player's monthly scores
LeaderboardSchema.index({ year: 1, monthNumber: 1, score: -1 }); // Alternative monthly query
LeaderboardSchema.index({ createdAt: -1 }); // Recent scores

// Static methods for leaderboard queries

// Get monthly leaderboard (top 10)
LeaderboardSchema.statics.getMonthlyLeaderboard = function(year, month, limit = 10) {
  const monthKey = `${year}-${month}`;
  
  return this.aggregate([
    // Match the specific month
    { $match: { month: monthKey } },
    
    // Group by player email and get their best score
    {
      $group: {
        _id: '$playerEmail',
        playerName: { $first: '$playerName' },
        bestScore: { $max: '$score' },
        totalGames: { $sum: 1 },
        lastPlayed: { $max: '$createdAt' },
        userId: { $first: '$userId' }
      }
    },
    
    // Sort by best score descending
    { $sort: { bestScore: -1 } },
    
    // Limit to top players
    { $limit: limit },
    
    // Add rank
    {
      $addFields: {
        rank: { $add: [{ $indexOfArray: ['$$ROOT', '$$ROOT'] }, 1] }
      }
    }
  ]);
};

// Get current month leaderboard
LeaderboardSchema.statics.getCurrentMonthLeaderboard = function(limit = 10) {
  const now = new Date();
  return this.getMonthlyLeaderboard(now.getFullYear(), now.getMonth(), limit);
};

// Submit new score (upsert player's best score)
LeaderboardSchema.statics.submitScore = async function(playerData) {
  const { playerName, playerEmail, score, gameSession } = playerData;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  
  // Check if player already has a better score this month
  const existingScore = await this.findOne({
    playerEmail: playerEmail,
    month: monthKey
  }).sort({ score: -1 });
  
  // Only save if this is a new best score
  if (!existingScore || score > existingScore.score) {
    const newEntry = new this({
      playerName,
      playerEmail,
      score,
      month: monthKey,
      year: now.getFullYear(),
      monthNumber: now.getMonth(),
      gameSession: gameSession || {}
    });
    
    await newEntry.save();
    return { isNewBest: true, entry: newEntry };
  }
  
  return { isNewBest: false, existingBest: existingScore.score };
};

// Get player's best score for current month
LeaderboardSchema.statics.getPlayerBestScore = function(playerEmail) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  
  return this.findOne({
    playerEmail: playerEmail,
    month: monthKey
  }).sort({ score: -1 });
};

// Get player's rank in current month
LeaderboardSchema.statics.getPlayerRank = async function(playerEmail) {
  const now = new Date();
  const leaderboard = await this.getCurrentMonthLeaderboard(100); // Get top 100
  
  const playerIndex = leaderboard.findIndex(player => player._id === playerEmail);
  return playerIndex >= 0 ? playerIndex + 1 : null;
};

// Mark monthly winner
LeaderboardSchema.statics.markMonthlyWinner = async function(year, month) {
  const monthKey = `${year}-${month}`;
  const winner = await this.getMonthlyLeaderboard(year, month, 1);
  
  if (winner.length > 0) {
    await this.updateMany(
      { month: monthKey },
      { competitionStatus: 'ended' }
    );
    
    await this.updateMany(
      { 
        playerEmail: winner[0]._id,
        month: monthKey
      },
      { 
        isWinner: true,
        rank: 1,
        competitionStatus: 'winner_announced'
      }
    );
    
    return winner[0];
  }
  
  return null;
};

// Get monthly stats
LeaderboardSchema.statics.getMonthlyStats = function(year, month) {
  const monthKey = `${year}-${month}`;
  
  return this.aggregate([
    { $match: { month: monthKey } },
    {
      $group: {
        _id: null,
        totalPlayers: { $addToSet: '$playerEmail' },
        totalGames: { $sum: 1 },
        highestScore: { $max: '$score' },
        averageScore: { $avg: '$score' },
        totalItemsCollected: { $sum: '$gameSession.itemsCollected' }
      }
    },
    {
      $addFields: {
        uniquePlayers: { $size: '$totalPlayers' }
      }
    },
    {
      $project: {
        totalPlayers: 0 // Remove the array, keep only the count
      }
    }
  ]);
};

// Instance methods

// Check if this score won the month
LeaderboardSchema.methods.isMonthlyWinner = async function() {
  const winner = await this.constructor.getMonthlyLeaderboard(
    this.year, 
    this.monthNumber, 
    1
  );
  
  return winner.length > 0 && winner[0]._id === this.playerEmail;
};

// Get player's rank
LeaderboardSchema.methods.getPlayerRank = function() {
  return this.constructor.getPlayerRank(this.playerEmail);
};

module.exports = mongoose.model('Leaderboard', LeaderboardSchema);