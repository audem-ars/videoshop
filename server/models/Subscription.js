// server/models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  // User who created the subscription
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Email for notifications (in case user changes email)
  email: {
    type: String,
    required: true
  },
  
  // Type of subscription
  type: {
    type: String,
    enum: ['category', 'subreddit', 'price-drop', 'new-products'],
    required: true
  },
  
  // What they're subscribing to
  target: {
    type: String,
    required: true
    // Examples: 'tech', 'fashion', 'r/gadgets', 'productId123', 'all'
  },
  
  // Display name for the subscription
  displayName: {
    type: String,
    required: true
    // Examples: 'Tech Products', 'r/BuyItForLife', 'iPhone Price Drop'
  },
  
  // How often to send notifications
  frequency: {
    type: String,
    enum: ['instant', 'daily', 'weekly'],
    default: 'daily'
  },
  
  // Subscription status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Last time we sent an alert
  lastAlertSent: {
    type: Date,
    default: null
  },
  
  // Count of alerts sent
  alertCount: {
    type: Number,
    default: 0
  },
  
  // Additional settings
  settings: {
    minPrice: {
      type: Number,
      default: 0
    },
    maxPrice: {
      type: Number,
      default: 1000
    },
    priceDropPercentage: {
      type: Number,
      default: 10 // Alert when price drops 10%+
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
subscriptionSchema.index({ user: 1, type: 1, target: 1 });
subscriptionSchema.index({ isActive: 1, type: 1 });
subscriptionSchema.index({ type: 1, target: 1, isActive: 1 });

// Instance methods
subscriptionSchema.methods.sendAlert = async function(products) {
  // Will implement alert sending logic
  this.lastAlertSent = new Date();
  this.alertCount += 1;
  await this.save();
};

subscriptionSchema.methods.deactivate = async function() {
  this.isActive = false;
  await this.save();
};

// Static methods
subscriptionSchema.statics.findActiveByType = function(type) {
  return this.find({ type, isActive: true });
};

subscriptionSchema.statics.findByUser = function(userId) {
  return this.find({ user: userId }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Subscription', subscriptionSchema);