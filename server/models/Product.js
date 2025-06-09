// server/models/Product.js - Fixed for CJ + Spocket
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
  // ADD SUPPORT FOR MULTIPLE IMAGES
  images: {
    type: [String],
    default: function() {
      return this.imageUrl ? [this.imageUrl] : [];
    }
  },
  category: {
    type: String,
    required: true,
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
    discoveredAt: Date,
    realProduct: Boolean
  },
  
  // Supplier information (for dropshipping) - ADDED SPOCKET
  supplier: {
    platform: {
      type: String,
      enum: ['cjdropshipping', 'spocket', 'aliexpress', 'alibaba', 'dhgate', 'other'] // REMOVED AMAZON, ADDED SPOCKET
    },
    productId: String,
    supplierUrl: String,
    supplierPrice: Number,
    supplierTitle: String,
    seller: {
      name: String,
      rating: Number,
      years: Number,
      location: String
    },
    shipping: {
      free: Boolean,
      days: Number,
      cost: Number,
      estimatedDays: String,
      methods: [String],
      trackingAvailable: Boolean,
      expressAvailable: Boolean,
      domesticShipping: Boolean
    },
    specifications: mongoose.Schema.Types.Mixed,
    soldCount: Number,
    inStock: Boolean
  },
  
  // Product variants (for products with multiple options)
  variants: [{
    id: String,
    name: String,
    sku: String,
    price: Number,
    image: String,
    color: String,
    size: String,
    inStock: Boolean,
    stockQuantity: Number,
    attributes: mongoose.Schema.Types.Mixed
  }],
  
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

  // Product specifications and features
  specifications: mongoose.Schema.Types.Mixed,
  
  // Quality flags
  qualityFlags: {
    realProduct: {
      type: Boolean,
      default: false
    },
    realImages: {
      type: Boolean,
      default: false
    },
    realPrices: {
      type: Boolean,
      default: false
    },
    fastShipping: {
      type: Boolean,
      default: false
    },
    autoFulfillment: {
      type: Boolean,
      default: false
    },
    premiumQuality: {
      type: Boolean,
      default: false
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

  // Amazon/external reviews data
  reviewsData: {
    reviews: [{
      rating: Number,
      comment: String,
      reviewer: String,
      verified: Boolean,
      date: Date
    }],
    overallRating: {
      type: Number,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    source: {
      type: String,
      default: 'amazon'
    }
  },

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
  
  // Ensure images array includes imageUrl
  if (this.imageUrl && (!this.images || !this.images.includes(this.imageUrl))) {
    this.images = this.images || [];
    if (!this.images.includes(this.imageUrl)) {
      this.images.unshift(this.imageUrl); // Add to beginning
    }
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

// Get main image (first in images array or imageUrl)
ProductSchema.virtual('mainImage').get(function() {
  if (this.images && this.images.length > 0) {
    return this.images[0];
  }
  return this.imageUrl;
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

// Find products by supplier platform
ProductSchema.statics.findBySupplier = function(platform) {
  return this.find({
    'supplier.platform': platform,
    status: 'active'
  });
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
ProductSchema.index({ 'supplier.platform': 1 });

module.exports = mongoose.model('Product', ProductSchema);