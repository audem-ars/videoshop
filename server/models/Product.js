// server/models/Product.js - Fixed for Amazon + CJ
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  // Basic product info (your existing fields)
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  imageUrl: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      // Your existing categories
      'toothpaste', 'face wash', 'body care', 'skin care', 'hair care',
      // New automation categories
      'electronics', 'home & garden', 'tools & hardware', 'clothing', 
      'sports & outdoors', 'automotive', 'books & media', 'food & beverage', 
      'pet supplies', 'other'
    ]
  },
  inStock: {
    type: Boolean,
    default: true
  },
  isPromoted: {
    type: Boolean,
    default: false
  },

  // NEW AUTOMATION FIELDS
  
  // Source tracking
  source: {
    type: String,
    enum: ['manual', 'reddit_automation', 'api_import'],
    default: 'manual'
  },
  
  // Reddit source data (for automated products)
  redditSource: {
    postId: String,
    title: String,
    subreddit: String,
    upvotes: Number,
    comments: Number,
    engagementScore: Number,
    permalink: String,
    discoveredAt: Date
  },
  
  // Supplier information (for dropshipping) - FIXED ENUM
  supplier: {
    platform: {
      type: String,
      enum: ['amazon', 'cjdropshipping', 'aliexpress', 'alibaba', 'dhgate', 'other'] // ADDED AMAZON + CJ
    },
    productId: String,
    supplierUrl: String,
    supplierPrice: Number,
    supplierTitle: String,
    seller: {
      name: String,
      rating: Number,
      years: Number
    },
    shipping: {
      free: Boolean,
      days: Number,
      cost: Number
    },
    specifications: mongoose.Schema.Types.Mixed
  },
  
  // Pricing automation
  pricing: {
    supplierPrice: {
      type: Number,
      required: function() { return this.source === 'reddit_automation'; }
    },
    markupPercentage: {
      type: Number,
      default: 28
    },
    markupAmount: Number,
    compareAtPrice: Number, // "Was" price for marketing
    lastPriceUpdate: {
      type: Date,
      default: Date.now
    }
  },
  
  // SEO & Marketing (auto-generated)
  seo: {
    title: String,
    description: String,
    keywords: [String],
    tags: [String]
  },
  
  // Analytics & Performance
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    orders: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    trendingScore: Number, // Based on Reddit engagement
    lastAnalyticsUpdate: Date
  },
  
  // Inventory management
  inventory: {
    sku: {
      type: String,
      unique: true,
      sparse: true
    },
    stockQuantity: {
      type: Number,
      default: 999 // Dropshipping = virtually unlimited
    },
    lowStockThreshold: {
      type: Number,
      default: 10
    },
    trackInventory: {
      type: Boolean,
      default: false // False for dropshipping
    }
  },
  
  // Status management
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'out_of_stock', 'discontinued'],
    default: 'active'
  },
  
  // Automation metadata
  automation: {
    isAutomated: {
      type: Boolean,
      default: false
    },
    lastSyncAt: Date,
    syncErrors: [String],
    needsReview: {
      type: Boolean,
      default: false
    },
    autoUpdatePrice: {
      type: Boolean,
      default: true
    },
    autoUpdateInventory: {
      type: Boolean,
      default: true
    }
  },

  // Your existing ratings system
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    value: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    review: {
      type: String
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
ProductSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-generate SKU if not provided
  if (!this.inventory.sku) {
    this.inventory.sku = `VS_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  
  // Calculate markup amount if pricing is set
  if (this.pricing && this.pricing.supplierPrice && this.pricing.markupPercentage) {
    this.pricing.markupAmount = (this.pricing.supplierPrice * this.pricing.markupPercentage / 100).toFixed(2);
  }
  
  // Calculate conversion rate
  if (this.analytics.clicks > 0) {
    this.analytics.conversionRate = ((this.analytics.orders / this.analytics.clicks) * 100).toFixed(2);
  }
  
  next();
});

// Calculate average rating (your existing virtual)
ProductSchema.virtual('averageRating').get(function() {
  if (this.ratings.length === 0) {
    return 0;
  }
  
  const sum = this.ratings.reduce((total, rating) => total + rating.value, 0);
  return (sum / this.ratings.length).toFixed(1);
});

// Calculate profit margin
ProductSchema.virtual('profitMargin').get(function() {
  if (!this.pricing || !this.pricing.supplierPrice) return 0;
  
  const profit = this.price - this.pricing.supplierPrice;
  return ((profit / this.price) * 100).toFixed(1);
});

// Calculate total profit potential
ProductSchema.virtual('totalProfit').get(function() {
  if (!this.pricing || !this.pricing.supplierPrice) return 0;
  
  return (this.price - this.pricing.supplierPrice).toFixed(2);
});

// Check if product is trending (based on Reddit engagement)
ProductSchema.virtual('isTrending').get(function() {
  if (!this.analytics.trendingScore) return false;
  
  return this.analytics.trendingScore > 100; // Threshold for "trending"
});

// Static methods for automation queries

// Find products that need price updates
ProductSchema.statics.findNeedingPriceUpdate = function(daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.find({
    'automation.isAutomated': true,
    'automation.autoUpdatePrice': true,
    'pricing.lastPriceUpdate': { $lt: cutoffDate }
  });
};

// Find trending products
ProductSchema.statics.findTrending = function(minScore = 100) {
  return this.find({
    'analytics.trendingScore': { $gte: minScore },
    status: 'active'
  }).sort({ 'analytics.trendingScore': -1 });
};

// Find products by Reddit subreddit
ProductSchema.statics.findBySubreddit = function(subreddit) {
  return this.find({
    'redditSource.subreddit': subreddit,
    status: 'active'
  });
};

// Find top performing automated products
ProductSchema.statics.findTopPerformers = function(limit = 20) {
  return this.find({
    'automation.isAutomated': true,
    status: 'active'
  })
  .sort({ 
    'analytics.revenue': -1,
    'analytics.conversionRate': -1 
  })
  .limit(limit);
};

// Instance methods

// Update analytics
ProductSchema.methods.updateAnalytics = function(data) {
  if (data.view) this.analytics.views += 1;
  if (data.click) this.analytics.clicks += 1;
  if (data.order) {
    this.analytics.orders += 1;
    this.analytics.revenue += this.price;
  }
  
  this.analytics.lastAnalyticsUpdate = new Date();
  return this.save();
};

// Sync with supplier (for automated products)
ProductSchema.methods.syncWithSupplier = async function() {
  if (!this.automation.isAutomated || !this.supplier.supplierUrl) {
    return false;
  }
  
  try {
    // This would integrate with actual supplier APIs
    console.log(`Syncing product ${this.name} with supplier...`);
    
    this.automation.lastSyncAt = new Date();
    this.automation.syncErrors = [];
    
    await this.save();
    return true;
    
  } catch (error) {
    this.automation.syncErrors.push(error.message);
    this.automation.needsReview = true;
    await this.save();
    return false;
  }
};

// Mark as needing review
ProductSchema.methods.flagForReview = function(reason) {
  this.automation.needsReview = true;
  this.automation.syncErrors.push(reason);
  return this.save();
};

// Ensure virtuals are included when converting to JSON
ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

// Indexes for performance
ProductSchema.index({ 'redditSource.postId': 1 });
ProductSchema.index({ 'supplier.productId': 1 });
ProductSchema.index({ 'analytics.trendingScore': -1 });
ProductSchema.index({ 'inventory.sku': 1 });
ProductSchema.index({ status: 1, 'automation.isAutomated': 1 });
ProductSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', ProductSchema);