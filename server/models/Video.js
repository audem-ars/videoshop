const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  // CORE VIDEO DATA
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  thumbnailUrl: { type: String, required: true },
  
  // YOUTUBE METADATA  
  channelTitle: { type: String, default: '' },
  channelId: { type: String, default: '' },
  publishedAt: { type: Date, default: Date.now },
  viewCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  duration: { type: String, default: '0:00' },
  
  // URLS
  embedUrl: { type: String, required: true },
  watchUrl: { type: String, required: true },
  
  // PRODUCT ASSOCIATION
  relatedProductId: { type: String, default: '' },
  relatedProductName: { type: String, default: '' },
  productCategory: { type: String, default: '' },
  
  // CACHING & MANAGEMENT
  apiCallMade: { type: Boolean, default: true },
  lastFetched: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  relevanceScore: { type: Number, default: 0 },
  
  // AUTOMATION DATA
  subreddit: { type: String, default: '' },
  trendingScore: { type: Number, default: 0 },
  category: { type: String, default: '' },
  
  // TIMESTAMPS
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// INDEXES FOR PERFORMANCE
videoSchema.index({ relatedProductName: 1, apiCallMade: 1 });
videoSchema.index({ isActive: 1, viewCount: -1 });
videoSchema.index({ videoId: 1 }, { unique: true });

module.exports = mongoose.model('Video', videoSchema);