// server/models/Order.js - Customer Orders with Auto-Fulfillment
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  supplierPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  profit: {
    type: Number,
    required: true
  },
  supplier: {
    platform: {
      type: String,
      enum: ['amazon', 'cjdropshipping'],
      required: true
    },
    productId: String,
    supplierUrl: String
  },
  imageUrl: String,
  fulfillmentStatus: {
    type: String,
    enum: ['pending', 'processing', 'ordered', 'shipped', 'delivered', 'failed'],
    default: 'pending'
  },
  supplierOrderId: String, // Order ID from CJ/Amazon
  trackingNumber: String,
  trackingUrl: String,
  fulfillmentNotes: String
});

const OrderSchema = new mongoose.Schema({
  // Order identification
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // Stripe payment info
  stripeSessionId: {
    type: String,
    required: true,
    unique: true
  },
  stripePaymentIntentId: String,
  stripeCustomerId: String,
  
  // Customer information
  customer: {
    email: {
      type: String,
      required: true
    },
    name: String,
    phone: String
  },
  
  // Shipping address
  shippingAddress: {
    name: {
      type: String,
      required: true
    },
    line1: {
      type: String,
      required: true
    },
    line2: String,
    city: {
      type: String,
      required: true
    },
    state: String,
    postal_code: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'US'
    }
  },
  
  // Billing address (optional - can same as shipping)
  billingAddress: {
    name: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    postal_code: String,
    country: String
  },
  
  // Order items
  items: [OrderItemSchema],
  
  // Order totals
  subtotal: {
    type: Number,
    required: true
  },
  shipping: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  totalProfit: {
    type: Number,
    required: true
  },
  
  // Order status
  status: {
    type: String,
    enum: ['pending', 'processing', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  // Payment status
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  
  // Fulfillment tracking
  fulfillmentStatus: {
    type: String,
    enum: ['pending', 'processing', 'partial', 'complete', 'failed'],
    default: 'pending'
  },
  
  // Timestamps
  orderDate: {
    type: Date,
    default: Date.now
  },
  paidAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  
  // Notes and communication
  customerNotes: String,
  internalNotes: String,
  
  // Fulfillment attempts
  fulfillmentAttempts: [{
    attemptDate: {
      type: Date,
      default: Date.now
    },
    supplier: String,
    status: {
      type: String,
      enum: ['pending', 'success', 'failed']
    },
    response: mongoose.Schema.Types.Mixed,
    error: String
  }],
  
  // Email notifications sent
  emailsSent: [{
    type: {
      type: String,
      enum: ['confirmation', 'processing', 'shipped', 'delivered']
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    emailId: String
  }]
}, {
  timestamps: true
});

// Generate order number
OrderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.orderNumber = `VS-${timestamp}-${random}`;
  }
  next();
});

// Calculate totals
OrderSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.totalProfit = this.items.reduce((sum, item) => sum + item.profit, 0);
  this.total = this.subtotal + this.shipping + this.tax;
  return this;
};

// Get fulfillment summary
OrderSchema.methods.getFulfillmentSummary = function() {
  const totalItems = this.items.length;
  const pendingItems = this.items.filter(item => item.fulfillmentStatus === 'pending').length;
  const processingItems = this.items.filter(item => item.fulfillmentStatus === 'processing').length;
  const shippedItems = this.items.filter(item => item.fulfillmentStatus === 'shipped').length;
  const deliveredItems = this.items.filter(item => item.fulfillmentStatus === 'delivered').length;
  const failedItems = this.items.filter(item => item.fulfillmentStatus === 'failed').length;
  
  return {
    totalItems,
    pendingItems,
    processingItems,
    shippedItems,
    deliveredItems,
    failedItems,
    completionPercentage: Math.round((deliveredItems / totalItems) * 100)
  };
};

// Update fulfillment status based on items
OrderSchema.methods.updateFulfillmentStatus = function() {
  const summary = this.getFulfillmentSummary();
  
  if (summary.failedItems === summary.totalItems) {
    this.fulfillmentStatus = 'failed';
  } else if (summary.deliveredItems === summary.totalItems) {
    this.fulfillmentStatus = 'complete';
  } else if (summary.shippedItems > 0 || summary.processingItems > 0) {
    this.fulfillmentStatus = 'processing';
  } else if (summary.pendingItems > 0) {
    this.fulfillmentStatus = 'pending';
  }
  
  return this;
};

// Static methods for admin dashboard
OrderSchema.statics.getOrderStats = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        orderDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        totalProfit: { $sum: '$totalProfit' },
        averageOrderValue: { $avg: '$total' }
      }
    }
  ]);
  
  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    totalProfit: 0,
    averageOrderValue: 0
  };
};

// Index for performance
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ stripeSessionId: 1 });
OrderSchema.index({ 'customer.email': 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ orderDate: -1 });

module.exports = mongoose.model('Order', OrderSchema);