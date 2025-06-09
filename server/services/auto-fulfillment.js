// server/services/auto-fulfillment.js - Automatic Order Fulfillment
const axios = require('axios');
const Order = require('../models/Order');

class AutoFulfillment {
  constructor() {
    // CJ API Configuration
    this.cjConfig = {
      baseUrl: 'https://developers.cjdropshipping.com/api2.0/v1',
      email: process.env.CJ_EMAIL,
      password: process.env.CJ_PASSWORD,
      accessToken: null,
      tokenExpiry: null
    };
    
    // Amazon configuration (for future Amazon API integration)
    this.amazonConfig = {
      // Will be implemented when Amazon SP-API access is available
    };
  }

  // Main function to process order fulfillment
  async processOrder(order) {
    console.log(`🚀 Processing fulfillment for order ${order.orderNumber}`);
    
    try {
      // Update order status
      order.status = 'processing';
      order.fulfillmentStatus = 'processing';
      await order.save();
      
      // Process each item in the order
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        console.log(`📦 Processing item ${i + 1}/${order.items.length}: ${item.productName}`);
        
        try {
          if (item.supplier.platform === 'cjdropshipping') {
            await this.fulfillCJProduct(order, item, i);
          } else if (item.supplier.platform === 'amazon') {
            await this.fulfillAmazonProduct(order, item, i);
          } else {
            throw new Error(`Unknown supplier platform: ${item.supplier.platform}`);
          }
          
          // Small delay between items
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (itemError) {
          console.error(`❌ Failed to fulfill item ${item.productName}:`, itemError.message);
          
          // Mark item as failed
          item.fulfillmentStatus = 'failed';
          item.fulfillmentNotes = itemError.message;
          
          // Log the attempt
          order.fulfillmentAttempts.push({
            supplier: item.supplier.platform,
            status: 'failed',
            error: itemError.message,
            response: null
          });
        }
      }
      
      // Update overall order status
      order.updateFulfillmentStatus();
      await order.save();
      
      console.log(`✅ Fulfillment processing completed for order ${order.orderNumber}`);
      
      // Send status update email to customer
      await this.sendFulfillmentUpdateEmail(order);
      
    } catch (error) {
      console.error(`❌ Order fulfillment failed for ${order.orderNumber}:`, error);
      
      order.status = 'processing'; // Keep as processing for manual review
      order.fulfillmentStatus = 'failed';
      order.internalNotes = `Auto-fulfillment failed: ${error.message}`;
      await order.save();
      
      throw error;
    }
  }

  // Fulfill CJ Dropshipping products
  async fulfillCJProduct(order, item, itemIndex) {
    console.log(`🏭 Fulfilling CJ product: ${item.productName}`);
    
    try {
      // Ensure we have a valid CJ token
      if (!this.isTokenValid()) {
        await this.getCJAccessToken();
      }
      
      // Create order with CJ
      const cjOrderData = {
        orderNumber: `${order.orderNumber}-${itemIndex + 1}`,
        products: [{
          pid: item.supplier.productId,
          quantity: item.quantity,
          variantId: null // Add variant support later if needed
        }],
        shippingAddress: {
          name: order.shippingAddress.name,
          phone: order.customer.phone || '555-0123', // CJ requires phone
          country: order.shippingAddress.country,
          province: order.shippingAddress.state,
          city: order.shippingAddress.city,
          address: order.shippingAddress.line1,
          address2: order.shippingAddress.line2 || '',
          zip: order.shippingAddress.postal_code
        },
        remark: `VideoShop Order ${order.orderNumber}`
      };
      
      console.log('📡 Sending order to CJ:', JSON.stringify(cjOrderData, null, 2));
      
      const response = await axios.post(`${this.cjConfig.baseUrl}/shopping/order`, cjOrderData, {
        headers: {
          'Content-Type': 'application/json',
          'CJ-Access-Token': this.cjConfig.accessToken
        },
        timeout: 30000
      });
      
      console.log('🏭 CJ Response:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.result) {
        const cjOrder = response.data.data;
        
        // Update item with CJ order info
        item.fulfillmentStatus = 'ordered';
        item.supplierOrderId = cjOrder.orderId || cjOrder.id;
        item.fulfillmentNotes = `CJ Order placed successfully. Order ID: ${item.supplierOrderId}`;
        
        // Log successful attempt
        order.fulfillmentAttempts.push({
          supplier: 'cjdropshipping',
          status: 'success',
          response: response.data
        });
        
        console.log(`✅ CJ order placed successfully: ${item.supplierOrderId}`);
        
        // Check order status and get tracking (if available)
        setTimeout(async () => {
          await this.checkCJOrderStatus(order.orderNumber, item.supplierOrderId, itemIndex);
        }, 60000); // Check after 1 minute
        
      } else {
        throw new Error(`CJ API returned error: ${response.data?.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('❌ CJ fulfillment error:', error.response?.data || error.message);
      throw new Error(`CJ fulfillment failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Fulfill Amazon products (simulated for now)
  async fulfillAmazonProduct(order, item, itemIndex) {
    console.log(`🛒 Fulfilling Amazon product: ${item.productName}`);
    
    try {
      // For now, we'll simulate Amazon fulfillment
      // In the future, integrate with Amazon SP-API for actual orders
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Generate mock tracking info
      const mockOrderId = `AMZ-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
      const mockTrackingNumber = `1Z${Math.random().toString(36).substr(2, 16).toUpperCase()}`;
      
      // Update item with Amazon order info
      item.fulfillmentStatus = 'ordered';
      item.supplierOrderId = mockOrderId;
      item.trackingNumber = mockTrackingNumber;
      item.trackingUrl = `https://www.amazon.com/gp/your-account/order-details?orderID=${mockOrderId}`;
      item.fulfillmentNotes = `Amazon order placed successfully. Tracking: ${mockTrackingNumber}`;
      
      // Log successful attempt
      order.fulfillmentAttempts.push({
        supplier: 'amazon',
        status: 'success',
        response: {
          orderId: mockOrderId,
          trackingNumber: mockTrackingNumber,
          status: 'confirmed'
        }
      });
      
      console.log(`✅ Amazon order simulated successfully: ${mockOrderId}`);
      
      // TODO: Replace with actual Amazon SP-API integration
      /* 
      const amazonOrderData = {
        MarketplaceId: 'ATVPDKIKX0DER', // US marketplace
        Items: [{
          SellerSKU: item.supplier.productId,
          Quantity: item.quantity,
          ItemPrice: {
            CurrencyCode: 'USD',
            Amount: item.supplierPrice.toFixed(2)
          }
        }],
        ShipToAddress: {
          Name: order.shippingAddress.name,
          AddressLine1: order.shippingAddress.line1,
          AddressLine2: order.shippingAddress.line2,
          City: order.shippingAddress.city,
          StateOrRegion: order.shippingAddress.state,
          PostalCode: order.shippingAddress.postal_code,
          CountryCode: order.shippingAddress.country
        }
      };
      
      const amazonResponse = await amazonAPI.createOrder(amazonOrderData);
      */
      
    } catch (error) {
      console.error('❌ Amazon fulfillment error:', error.message);
      throw new Error(`Amazon fulfillment failed: ${error.message}`);
    }
  }

  // Check CJ order status and get tracking info
  async checkCJOrderStatus(orderNumber, cjOrderId, itemIndex) {
    try {
      console.log(`🔍 Checking CJ order status: ${cjOrderId}`);
      
      if (!this.isTokenValid()) {
        await this.getCJAccessToken();
      }
      
      const response = await axios.get(`${this.cjConfig.baseUrl}/shopping/order/${cjOrderId}`, {
        headers: {
          'CJ-Access-Token': this.cjConfig.accessToken
        },
        timeout: 15000
      });
      
      if (response.data && response.data.result) {
        const orderData = response.data.data;
        
        // Find the order and update tracking info
        const order = await Order.findOne({ orderNumber: orderNumber });
        if (order && order.items[itemIndex]) {
          const item = order.items[itemIndex];
          
          // Update tracking information
          if (orderData.trackingNumber) {
            item.trackingNumber = orderData.trackingNumber;
            item.trackingUrl = `https://www.17track.net/en/track#nums=${orderData.trackingNumber}`;
            item.fulfillmentStatus = 'shipped';
            item.fulfillmentNotes = `Shipped with tracking: ${orderData.trackingNumber}`;
            
            // Update order shipped date if all items are shipped
            const allShipped = order.items.every(i => i.fulfillmentStatus === 'shipped' || i.fulfillmentStatus === 'delivered');
            if (allShipped && !order.shippedAt) {
              order.shippedAt = new Date();
              order.status = 'shipped';
            }
            
            await order.save();
            
            console.log(`📦 Tracking updated for ${item.productName}: ${orderData.trackingNumber}`);
            
            // Send tracking email to customer
            await this.sendTrackingEmail(order, item);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error checking CJ order status:', error.message);
    }
  }

  // Get CJ Access Token
  async getCJAccessToken() {
    try {
      console.log('🔑 Getting CJ Access Token...');
      
      const response = await axios.post(`${this.cjConfig.baseUrl}/authentication/getAccessToken`, {
        email: this.cjConfig.email,
        password: this.cjConfig.password
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.result && response.data.data) {
        this.cjConfig.accessToken = response.data.data.accessToken;
        this.cjConfig.tokenExpiry = new Date(response.data.data.accessTokenExpiryDate).getTime();
        
        console.log('✅ CJ Access Token obtained successfully');
        return { success: true, token: this.cjConfig.accessToken };
      } else {
        throw new Error(response.data?.message || 'Failed to get access token');
      }
    } catch (error) {
      console.error('❌ CJ Authentication failed:', error.response?.data || error.message);
      throw new Error(`CJ authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Check if CJ token is still valid
  isTokenValid() {
    return this.cjConfig.accessToken && 
           this.cjConfig.tokenExpiry && 
           Date.now() < this.cjConfig.tokenExpiry;
  }

  // Send fulfillment update email
  async sendFulfillmentUpdateEmail(order) {
    try {
      console.log(`📧 Sending fulfillment update for order ${order.orderNumber}`);
      
      // TODO: Implement email service (SendGrid, Mailgun, etc.)
      const emailData = {
        to: order.customer.email,
        subject: `Order Update - ${order.orderNumber}`,
        template: 'order-processing',
        data: {
          orderNumber: order.orderNumber,
          customerName: order.customer.name || order.shippingAddress.name,
          items: order.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            status: item.fulfillmentStatus,
            trackingNumber: item.trackingNumber
          })),
          orderTotal: order.total,
          estimatedDelivery: this.calculateEstimatedDelivery(order)
        }
      };
      
      console.log('📧 Email data prepared:', emailData.subject);
      // await emailService.send(emailData);
      
    } catch (error) {
      console.error('❌ Failed to send fulfillment email:', error.message);
    }
  }

  // Send tracking email
  async sendTrackingEmail(order, item) {
    try {
      console.log(`📧 Sending tracking info for ${item.productName}`);
      
      // TODO: Implement email service
      const emailData = {
        to: order.customer.email,
        subject: `Your order has shipped - ${order.orderNumber}`,
        template: 'tracking-info',
        data: {
          orderNumber: order.orderNumber,
          customerName: order.customer.name || order.shippingAddress.name,
          productName: item.productName,
          trackingNumber: item.trackingNumber,
          trackingUrl: item.trackingUrl,
          estimatedDelivery: this.calculateEstimatedDelivery(order, item)
        }
      };
      
      console.log('📧 Tracking email prepared:', emailData.subject);
      // await emailService.send(emailData);
      
    } catch (error) {
      console.error('❌ Failed to send tracking email:', error.message);
    }
  }

  // Calculate estimated delivery date
  calculateEstimatedDelivery(order, item = null) {
    const now = new Date();
    let estimatedDays = 5; // Default
    
    if (item) {
      // CJ products typically take 7-15 days
      if (item.supplier.platform === 'cjdropshipping') {
        estimatedDays = 10;
      }
      // Amazon products typically take 1-3 days
      else if (item.supplier.platform === 'amazon') {
        estimatedDays = 2;
      }
    } else {
      // Calculate based on longest delivery time in order
      const cjItems = order.items.filter(i => i.supplier.platform === 'cjdropshipping');
      if (cjItems.length > 0) {
        estimatedDays = 10;
      }
    }
    
    const estimatedDate = new Date(now.getTime() + (estimatedDays * 24 * 60 * 60 * 1000));
    return estimatedDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // Retry failed fulfillments
  async retryFailedFulfillments() {
    try {
      console.log('🔄 Checking for failed fulfillments to retry...');
      
      const failedOrders = await Order.find({
        fulfillmentStatus: 'failed',
        paymentStatus: 'paid',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      });
      
      console.log(`Found ${failedOrders.length} orders with failed fulfillments`);
      
      for (const order of failedOrders) {
        console.log(`🔄 Retrying fulfillment for order ${order.orderNumber}`);
        
        try {
          await this.processOrder(order);
          console.log(`✅ Retry successful for order ${order.orderNumber}`);
        } catch (error) {
          console.error(`❌ Retry failed for order ${order.orderNumber}:`, error.message);
        }
        
        // Delay between retries
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
    } catch (error) {
      console.error('❌ Error retrying failed fulfillments:', error.message);
    }
  }

  // Get fulfillment statistics
  async getFulfillmentStats(days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const orders = await Order.find({
        paymentStatus: 'paid',
        createdAt: { $gte: startDate }
      });
      
      const stats = {
        totalOrders: orders.length,
        totalItems: orders.reduce((sum, order) => sum + order.items.length, 0),
        fulfillmentStats: {
          pending: 0,
          processing: 0,
          ordered: 0,
          shipped: 0,
          delivered: 0,
          failed: 0
        },
        supplierStats: {
          amazon: { orders: 0, items: 0 },
          cjdropshipping: { orders: 0, items: 0 }
        }
      };
      
      orders.forEach(order => {
        order.items.forEach(item => {
          stats.fulfillmentStats[item.fulfillmentStatus]++;
          stats.supplierStats[item.supplier.platform].items++;
        });
        
        // Count unique suppliers per order
        const suppliers = [...new Set(order.items.map(item => item.supplier.platform))];
        suppliers.forEach(supplier => {
          stats.supplierStats[supplier].orders++;
        });
      });
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error getting fulfillment stats:', error.message);
      return null;
    }
  }
}

module.exports = AutoFulfillment;