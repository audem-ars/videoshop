// server/routes/checkout.js - Stripe Checkout & Order Processing
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Product = require('../models/Product');
const AutoFulfillment = require('../services/auto-fulfillment');

// Initialize auto-fulfillment service
const autoFulfillment = new AutoFulfillment();

// @route   POST /api/checkout/create-session
// @desc    Create Stripe checkout session
// @access  Public
router.post('/create-session', async (req, res) => {
  try {
    const { items, customer, shippingAddress } = req.body;
    
    console.log('🛒 Creating checkout session for:', items.length, 'items');
    
    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cart is empty or invalid' 
      });
    }
    
    // Validate customer info
    if (!customer || !customer.email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Customer email is required' 
      });
    }
    
    // Validate shipping address
    if (!shippingAddress || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.postal_code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Complete shipping address is required' 
      });
    }
    
    // Get product details and calculate totals
    const orderItems = [];
    let subtotal = 0;
    let totalProfit = 0;
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ 
          success: false, 
          error: `Product ${item.productId} not found` 
        });
      }
      
      const quantity = parseInt(item.quantity) || 1;
      const unitPrice = parseFloat(product.price);
      const supplierPrice = parseFloat(product.supplierPrice || product.pricing?.supplierPrice || 0);
      const totalPrice = unitPrice * quantity;
      const profit = (unitPrice - supplierPrice) * quantity;
      
      const orderItem = {
        productId: product._id,
        productName: product.name,
        quantity: quantity,
        unitPrice: unitPrice,
        supplierPrice: supplierPrice,
        totalPrice: totalPrice,
        profit: profit,
        supplier: {
          platform: product.supplier?.platform || 'amazon',
          productId: product.supplier?.productId || product.amazonProductId || product.cjProductId,
          supplierUrl: product.supplier?.supplierUrl
        },
        imageUrl: product.imageUrl
      };
      
      orderItems.push(orderItem);
      subtotal += totalPrice;
      totalProfit += profit;
    }
    
    // Calculate shipping and tax
    const shipping = subtotal > 50 ? 0 : 9.99; // Free shipping over $50
    const tax = subtotal * 0.08; // 8% tax (adjust based on location)
    const total = subtotal + shipping + tax;
    
    console.log(`💰 Order totals: Subtotal: $${subtotal}, Shipping: $${shipping}, Tax: $${tax}, Total: $${total}, Profit: $${totalProfit}`);
    
    // Create Stripe line items
    const lineItems = orderItems.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.productName,
          description: `Trending product from VideoShop`,
          images: item.imageUrl ? [item.imageUrl] : []
        },
        unit_amount: Math.round(item.unitPrice * 100) // Convert to cents
      },
      quantity: item.quantity
    }));
    
    // Add shipping as line item if not free
    if (shipping > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Shipping',
            description: 'Standard shipping'
          },
          unit_amount: Math.round(shipping * 100)
        },
        quantity: 1
      });
    }
    
    // Add tax as line item
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Tax',
          description: 'Sales tax'
        },
        unit_amount: Math.round(tax * 100)
      },
      quantity: 1
    });
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: `${process.env.DOMAIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN}/checkout/cancel`,
      customer_email: customer.email,
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU'] // Expand as needed
      },
      metadata: {
        orderType: 'dropshipping',
        itemCount: items.length.toString(),
        totalProfit: totalProfit.toFixed(2)
      }
    });
    
    // Pre-create order record (will be completed on successful payment)
    const order = new Order({
      stripeSessionId: session.id,
      customer: {
        email: customer.email,
        name: customer.name || '',
        phone: customer.phone || ''
      },
      shippingAddress: {
        name: shippingAddress.name || customer.name || '',
        line1: shippingAddress.line1,
        line2: shippingAddress.line2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state || '',
        postal_code: shippingAddress.postal_code,
        country: shippingAddress.country || 'US'
      },
      items: orderItems,
      subtotal: subtotal,
      shipping: shipping,
      tax: tax,
      total: total,
      totalProfit: totalProfit,
      status: 'pending',
      paymentStatus: 'pending'
    });
    
    await order.save();
    
    console.log(`✅ Created order ${order.orderNumber} with session ${session.id}`);
    
    res.json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url,
      orderNumber: order.orderNumber
    });
    
  } catch (error) {
    console.error('❌ Checkout session creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
});

// @route   POST /api/checkout/webhook
// @desc    Handle Stripe webhooks (payment confirmation)
// @access  Private (Stripe only)
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  console.log(`🔔 Received webhook: ${event.type}`);
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
      
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
      
    case 'payment_method.attached':
      console.log('💳 Payment method attached:', event.data.object.id);
      break;
      
    default:
      console.log(`🤷‍♂️ Unhandled event type: ${event.type}`);
  }
  
  res.json({received: true});
});

// Handle successful checkout
async function handleCheckoutCompleted(session) {
  try {
    console.log(`✅ Checkout completed for session: ${session.id}`);
    
    // Find the order
    const order = await Order.findOne({ stripeSessionId: session.id });
    if (!order) {
      console.error('❌ Order not found for session:', session.id);
      return;
    }
    
    // Update order with payment info
    order.stripePaymentIntentId = session.payment_intent;
    order.stripeCustomerId = session.customer;
    order.paymentStatus = 'paid';
    order.status = 'processing';
    order.paidAt = new Date();
    
    // Update shipping address from Stripe if different
    if (session.shipping_address) {
      order.shippingAddress = {
        name: session.shipping_address.name,
        line1: session.shipping_address.line1,
        line2: session.shipping_address.line2 || '',
        city: session.shipping_address.city,
        state: session.shipping_address.state || '',
        postal_code: session.shipping_address.postal_code,
        country: session.shipping_address.country
      };
    }
    
    await order.save();
    
    console.log(`💰 Order ${order.orderNumber} payment confirmed - $${order.total} (Profit: $${order.totalProfit})`);
    
    // Trigger automatic fulfillment
    try {
      await autoFulfillment.processOrder(order);
      console.log(`🚀 Auto-fulfillment initiated for order ${order.orderNumber}`);
    } catch (fulfillmentError) {
      console.error('❌ Auto-fulfillment failed:', fulfillmentError);
      // Order is still valid, we'll retry fulfillment later
    }
    
    // Send confirmation email (implement later)
    // await sendOrderConfirmationEmail(order);
    
  } catch (error) {
    console.error('❌ Error handling checkout completion:', error);
  }
}

// Handle successful payment
async function handlePaymentSucceeded(paymentIntent) {
  try {
    console.log(`💳 Payment succeeded: ${paymentIntent.id}`);
    
    // Update order if needed
    const order = await Order.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (order && order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.paidAt = new Date();
      await order.save();
      console.log(`✅ Updated payment status for order ${order.orderNumber}`);
    }
    
  } catch (error) {
    console.error('❌ Error handling payment success:', error);
  }
}

// @route   GET /api/checkout/success/:sessionId
// @desc    Get order details after successful payment
// @access  Public
router.get('/success/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Get session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Get order from database
    const order = await Order.findOne({ stripeSessionId: sessionId })
      .populate('items.productId', 'name imageUrl');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        items: order.items,
        shippingAddress: order.shippingAddress,
        orderDate: order.orderDate
      },
      session: {
        id: session.id,
        payment_status: session.payment_status
      }
    });
    
  } catch (error) {
    console.error('❌ Error retrieving order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve order details'
    });
  }
});

// @route   GET /api/checkout/orders/:email
// @desc    Get customer orders by email
// @access  Public (with email verification)
router.get('/orders/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const orders = await Order.find({ 
      'customer.email': email,
      paymentStatus: 'paid'
    })
    .select('-stripeSessionId -stripePaymentIntentId -internalNotes')
    .sort({ orderDate: -1 })
    .limit(20);
    
    res.json({
      success: true,
      orders: orders
    });
    
  } catch (error) {
    console.error('❌ Error retrieving customer orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve orders'
    });
  }
});

module.exports = router;