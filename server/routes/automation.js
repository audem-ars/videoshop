// server/routes/automation.js - Updated for REAL Automation Pipeline
const express = require('express');
const router = express.Router();
const RealAutomationPipeline = require('../services/real-automation-pipeline');
const Product = require('../models/Product');

// Initialize REAL automation pipeline
const automation = new RealAutomationPipeline();

// POST /api/automation/run - Run REAL automation pipeline
router.post('/run', async (req, res) => {
  try {
    console.log('🚀 REAL Automation pipeline triggered via API');
    
    const options = {
      timeFrame: req.body.timeFrame || 'day',
      limit: req.body.limit || 50,
      maxProducts: req.body.maxProducts || 8
    };
    
    const result = await automation.runRealPipeline(options);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.report,
        stats: result.stats,
        productsAdded: result.realProducts.length
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'REAL Automation pipeline failed',
        error: result.error,
        stats: result.stats
      });
    }
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// GET /api/automation/health - System health check
router.get('/health', async (req, res) => {
  try {
    const health = await automation.checkSystemHealth();
    res.json({
      success: true,
      ...health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// GET /api/automation/stats - Get automation statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = automation.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/automation/products - Get all automated products
router.get('/products', async (req, res) => {
  try {
    const automatedProducts = await Product.find({ 
      source: 'reddit_automation',
      'automation.isAutomated': true 
    })
    .sort({ createdAt: -1 })
    .limit(req.query.limit || 50);

    const productSummary = automatedProducts.map(product => ({
        id: product._id,
        name: product.name,
        price: product.price,
        supplierPrice: product.pricing?.supplierPrice,
        profit: product.pricing?.markupAmount,
        category: product.category,
        subreddit: product.redditSource?.subreddit,
        trendingScore: product.analytics?.trendingScore,
        createdAt: product.createdAt,
        realProduct: product.supplier?.specifications?.realProduct || false,
        // ADD THESE MISSING FIELDS:
        imageUrl: product.imageUrl,
        amazonProductId: product.supplier?.productId,
        supplier: product.supplier?.platform
      }));

    res.json({
      success: true,
      count: automatedProducts.length,
      products: productSummary
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/automation/report - Generate detailed report
router.get('/report', async (req, res) => {
  try {
    const automatedProducts = await Product.find({ 
      source: 'reddit_automation',
      'automation.isAutomated': true 
    });

    const totalProducts = automatedProducts.length;
    const totalRevenue = automatedProducts.reduce((sum, p) => sum + p.price, 0);
    const totalSupplierCost = automatedProducts.reduce((sum, p) => sum + (p.pricing?.supplierPrice || 0), 0);
    const totalProfit = totalRevenue - totalSupplierCost;

    const report = {
      summary: {
        totalProducts,
        totalRevenue: totalRevenue.toFixed(2),
        totalSupplierCost: totalSupplierCost.toFixed(2),
        totalProfit: totalProfit.toFixed(2),
        averageProfit: totalProducts > 0 ? (totalProfit / totalProducts).toFixed(2) : '0.00',
        profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) + '%' : '0%'
      },
      categories: {},
      subreddits: {},
      recentProducts: automatedProducts.slice(0, 10).map(p => ({
        name: p.name,
        price: p.price,
        profit: p.pricing?.markupAmount || 0,
        subreddit: p.redditSource?.subreddit,
        createdAt: p.createdAt
      }))
    };

    // Category breakdown
    automatedProducts.forEach(product => {
      const category = product.category || 'other';
      if (!report.categories[category]) {
        report.categories[category] = { count: 0, totalProfit: 0 };
      }
      report.categories[category].count++;
      report.categories[category].totalProfit += product.pricing?.markupAmount || 0;
    });

    // Subreddit breakdown
    automatedProducts.forEach(product => {
      const subreddit = product.redditSource?.subreddit || 'unknown';
      if (!report.subreddits[subreddit]) {
        report.subreddits[subreddit] = { count: 0, totalEngagement: 0 };
      }
      report.subreddits[subreddit].count++;
      report.subreddits[subreddit].totalEngagement += product.redditSource?.engagementScore || 0;
    });

    res.json({
      success: true,
      report
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/automation/reset - Reset automation (clear all automated products)
router.delete('/reset', async (req, res) => {
  try {
    const result = await Product.deleteMany({ 
      source: 'reddit_automation',
      'automation.isAutomated': true 
    });
    
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} automated products`,
      deletedCount: result.deletedCount
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;