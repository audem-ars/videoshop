// server/routes/automation.js - Updated for REAL Automation Pipeline
const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const RealAutomationPipeline = require('../services/real-automation-pipeline');
const Product = require('../models/Product');
const Video = require('../models/Video');
const auth = require('../middleware/auth'); // ADD THIS LINE
const { getCachedVideos } = require('../services/youtube-video-scraper');
const adminAuth = require('../middleware/admin');
const Subscription = require('../models/Subscription');

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

// GET /api/automation/products - Get all automated products WITH FULL DATA + TRENDING FILTER
router.get('/products', async (req, res) => {
  try {
    const { limit = 50, trending = false } = req.query;
    
    let query = { 
      source: 'reddit_automation',
      'automation.isAutomated': true 
    };
    let sortOrder = { createdAt: -1 }; // Default sort
    
    // If trending=true, only get products with trending data
    if (trending === 'true') {
      console.log('🔥 Fetching TRENDING products only...');
      query = {
        ...query,
        $or: [
          { 'trendingData.engagementScore': { $exists: true, $gt: 0 } },
          { 'redditSource.engagementScore': { $exists: true, $gt: 0 } },
          { description: { $regex: '\\[TRENDING' } } // Also include marked trending products
        ]
      };
      // Sort trending products by engagement score
      sortOrder = { 
        'trendingData.engagementScore': -1, 
        'redditSource.engagementScore': -1,
        createdAt: -1 
      };
    }

    const automatedProducts = await Product.find(query)
  .select('name price imageUrl supplier category reviewsData redditSource analytics trendingData automation variants images specifications inStock pricing createdAt') // Add reviewsData
  .sort(sortOrder)
  .limit(parseInt(limit));

    console.log(`📊 Found ${automatedProducts.length} products (trending: ${trending})`);

    const productSummary = automatedProducts.map(product => ({
      id: product._id,
      name: product.name,
      price: product.price,
      supplierPrice: product.pricing?.supplierPrice,
      profit: product.pricing?.markupAmount,
      category: product.category,
      subreddit: product.redditSource?.subreddit,
      trendingScore: product.analytics?.trendingScore || product.redditSource?.engagementScore || 0,
      createdAt: product.createdAt,
      realProduct: product.supplier?.specifications?.realProduct || false,
      imageUrl: product.imageUrl,
      amazonProductId: product.supplier?.productId,
      supplier: product.supplier?.platform,
      reviewsData: product.reviewsData, // ADD THIS LINE
      
      // Enhanced image and variant support
      images: product.images && Array.isArray(product.images) ? product.images : [product.imageUrl],
      variants: product.variants && Array.isArray(product.variants) ? product.variants : [],
      specifications: product.specifications || {},
      description: product.description,
      inStock: product.inStock !== false,
      hasVariants: product.variants && Array.isArray(product.variants) && product.variants.length > 0,
      supplierData: product.supplier || {},
      
      // Add trending-specific data if available
      ...(trending === 'true' && {
        trendingData: product.trendingData || {},
        redditSource: product.redditSource || {},
        analytics: product.analytics || {}
      })
    }));

    // Add trending stats if this is a trending request
    const responseData = {
      success: true,
      count: automatedProducts.length,
      products: productSummary
    };

    if (trending === 'true') {
      responseData.stats = {
        totalProducts: automatedProducts.length,
        totalVideos: await Video.countDocuments({ apiCallMade: true, isActive: true }),
        lastUpdated: automatedProducts[0]?.redditSource?.discoveredAt ? 
          new Date(automatedProducts[0].redditSource.discoveredAt).toLocaleString() : 
          new Date().toLocaleTimeString()
      };
    }

    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      products: []
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

// DELETE /api/automation/reset - Reset all automation data
router.delete('/reset', async (req, res) => {
  try {
    console.log('🔄 RESETTING ALL AUTOMATION DATA...');
    
    const productResult = await Product.deleteMany({});
    console.log(`🗑️ Deleted ${productResult.deletedCount} products`);
    
    const videoResult = await Video.deleteMany({});
    console.log(`🗑️ Deleted ${videoResult.deletedCount} videos`);
    
    res.json({
      success: true,
      message: 'All automation data reset successfully',
      deleted: {
        products: productResult.deletedCount,
        videos: videoResult.deletedCount
      }
    });
    
  } catch (error) {
    console.error('❌ Reset error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/automation/video-stats - Get video statistics
router.get('/video-stats', async (req, res) => {
  try {
    const totalVideos = await Video.countDocuments({ apiCallMade: true });
    const activeVideos = await Video.countDocuments({ apiCallMade: true, isActive: true });
    const totalViews = await Video.aggregate([
      { $match: { apiCallMade: true, isActive: true } },
      { $group: { _id: null, totalViews: { $sum: '$viewCount' } } }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalCachedVideos: totalVideos,
        activeVideos: activeVideos,
        inactiveVideos: totalVideos - activeVideos,
        totalViews: totalViews[0]?.totalViews || 0,
        apiCallsSaved: "Every page load is 0 API calls!",
        cacheStatus: "ACTIVE - Videos load instantly"
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting video stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import YouTube scraper at the top
const YouTubeVideoScraper = require('../services/youtube-video-scraper');

// Initialize YouTube scraper
const youtubeScraper = new YouTubeVideoScraper();

// GET /api/automation/videos - Get cached videos
router.get('/videos', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const videos = await getCachedVideos(limit);
    
    res.json({
      success: true,
      count: videos.length,
      videos: videos,
      quotaStatus: {
        used: 0,
        remaining: 10000,
        percentage: '0%',
        message: "Using cached videos - no quota used!"
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching cached videos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/automation/videos/:videoId - Remove video from display
router.delete('/videos/:videoId', async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.videoId, 
      { 
        isActive: false,
        updatedAt: new Date()
      }
    );
    
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    
    res.json({ 
      success: true, 
      message: `Video "${video.title}" removed from display` 
    });
    
  } catch (error) {
    console.error('❌ Error removing video:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/automation/videos/sync - Sync videos to database  
router.post('/videos/sync', async (req, res) => {
  try {
    console.log('📱 Syncing YouTube videos to database...');
    
    const products = await Product.find({ 
      source: 'reddit_automation' 
    }).limit(3); 

    if (products.length === 0) {
      return res.json({
        success: true,
        message: 'No products found to sync videos for',
        videosSaved: 0
      });
    }

    let totalVideosSaved = 0;

    for (const product of products) {
      console.log(`🎬 Getting videos for: ${product.name}`);
      
      const productVideos = await youtubeScraper.searchProductVideos(product.name, 2);
      
      for (const videoData of productVideos) {
        try {
          const existingVideo = await Video.findOne({ 
            'youtube.videoId': videoData.videoId 
          });

          if (existingVideo) {
            console.log(`⏭️ Video already exists: ${videoData.title}`);
            continue;
          }

          const tempUserId = new mongoose.Types.ObjectId();

          const newVideo = new Video({
            user: tempUserId,
            title: videoData.title,
            description: videoData.description || `Video about ${product.name}`,
            videoUrl: videoData.embedUrl,
            thumbnailUrl: videoData.thumbnailUrl,
            isPublished: true,
            views: 0,
            
            youtube: {
              videoId: videoData.videoId,
              channelTitle: videoData.channelTitle,
              channelId: videoData.channelId,
              publishedAt: new Date(videoData.publishedAt),
              viewCount: videoData.viewCount || 0,
              likeCount: videoData.likeCount || 0,
              commentCount: videoData.commentCount || 0,
              duration: videoData.duration,
              watchUrl: videoData.watchUrl
            },
            
            relatedProducts: [product._id],
            category: product.category || 'general',
            
            source: 'youtube_automation',
            automation: {
              isAutomated: true,
              lastSyncAt: new Date(),
              relevanceScore: videoData.relevanceScore || 0
            }
          });

          await newVideo.save();
          totalVideosSaved++;
          
          console.log(`✅ Saved video: ${videoData.title.substring(0, 50)}...`);

        } catch (saveError) {
          console.error(`❌ Error saving video: ${saveError.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Successfully synced ${totalVideosSaved} videos to database`,
      videosSaved: totalVideosSaved,
      quotaStatus: youtubeScraper.getQuotaStatus()
    });

  } catch (error) {
    console.error('❌ Video sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/automation/products/:id/images/:imageIndex - Admin remove product image
router.delete('/products/:id/images/:imageIndex', auth, adminAuth, async (req, res) => {
  try {
    const { id, imageIndex } = req.params;
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    if (product.images && product.images[imageIndex]) {
      product.images.splice(imageIndex, 1);
      await product.save();
      res.json({ success: true, message: 'Image removed successfully' });
    } else {
      res.status(404).json({ success: false, error: 'Image not found' });
    }
  } catch (error) {
    console.error('Error removing image:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/automation/products/:id - Admin delete product
router.delete('/products/:id', auth, adminAuth, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/automation/trending - Copy main automation pattern
router.post('/trending', async (req, res) => {
  try {
    console.log('🔥 TRENDING - Using main automation pattern (1 product per run)');
    
    const startTime = Date.now();
    
    // Use the same working automation pipeline
    const options = {
      timeFrame: 'day',
      limit: 50,
      maxProducts: 1  // Only get 1 product like main automation
    };
    
    const result = await automation.runRealPipeline(options);
    
    if (result.success && result.realProducts.length > 0) {
      // Mark the product as trending by updating its description
      const product = result.realProducts[0];
      
      // Count existing trending products to get rank
      const existingTrending = await Product.countDocuments({ 
        description: { $regex: '\\[TRENDING' }
      });
      
      // Update product to be trending
      product.description = product.description + ` [TRENDING #${existingTrending + 1}]`;
      await product.save();
      
      const runtime = ((Date.now() - startTime) / 1000).toFixed(1);
      
      res.json({
        success: true,
        message: `🔥 Trending automation complete! 1 product added in ${runtime}s`,
        data: {
          summary: {
            runtime: `${runtime} seconds`,
            timestamp: new Date().toISOString(),
            totalProductsProcessed: 1,
            totalVideosAdded: result.report.summary.totalVideosAdded,
            status: "SUCCESS",
            dataSource: "Reddit + CJDropshipping + YouTube"
          },
          trendingProduct: {
            name: product.name,
            price: product.price,
            rank: existingTrending + 1,
            profit: result.report.profitAnalysis.totalProfit
          },
          totalTrendingProducts: existingTrending + 1
        }
      });
      
    } else {
      res.json({
        success: true,
        message: "No new trending products found (rate limited or no matches)",
        data: { summary: { status: "NO_NEW_PRODUCTS" } }
      });
    }
    
  } catch (error) {
    console.error('❌ Trending automation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DEPRECATED: Keep for backward compatibility but redirect to main products route
router.get('/trending-products', async (req, res) => {
  try {
    console.log('🔄 Redirecting /trending-products to main /products route with trending filter...');
    
    // Just redirect to the main products route with trending=true
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/automation/products?trending=true&limit=20`);
    const data = await response.json();
    
    res.json(data);
    
  } catch (error) {
    console.error('❌ Error in trending-products redirect:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// TEMPORARY DEBUG ROUTE
router.get('/debug-trending', async (req, res) => {
  try {
    const allProducts = await Product.find({}).sort({ createdAt: -1 }).limit(10);
    const trendingProducts = await Product.find({ 
      'trendingData.trendingRank': { $exists: true }
    });
    
    res.json({
      allProductsCount: allProducts.length,
      trendingProductsCount: trendingProducts.length,
      lastProducts: allProducts.map(p => ({
        name: p.name,
        source: p.source,
        hasTrendingData: !!p.trendingData,
        createdAt: p.createdAt
      })),
      trendingProducts: trendingProducts.map(p => ({
        name: p.name,
        source: p.source,
        trendingRank: p.trendingData?.trendingRank
      }))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// DEBUG: Check latest videos in database
router.get('/debug-videos', async (req, res) => {
  try {
    const allVideos = await Video.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title createdAt youtube.videoId apiCallMade isActive');
    
    res.json({
      totalVideos: await Video.countDocuments({}),
      latestVideos: allVideos
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// GET /api/automation/subscriptions - Get user's subscriptions
router.get('/subscriptions', auth, async (req, res) => {
  try {
    const subscriptions = await Subscription.findByUser(req.user.id);
    
    res.json({
      success: true,
      subscriptions: subscriptions
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/automation/subscriptions - Create new subscription
router.post('/subscriptions', auth, async (req, res) => {
  try {
    const { type, target, displayName, frequency } = req.body;
    
    console.log('🔍 User object:', req.user); // Debug log
    console.log('📧 User email:', req.user.email); // Debug log
    
    // Get user email - try multiple sources
    let userEmail = req.user.email;
    if (!userEmail) {
      // If email not in token, get from database
      const User = require('../models/User');
      const fullUser = await User.findById(req.user.id);
      userEmail = fullUser?.email;
    }
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'User email not found. Please sign out and sign in again.'
      });
    }
    
    console.log('✅ Using email:', userEmail); // Debug log
    
    // Check if subscription already exists
    const existingSubscription = await Subscription.findOne({
      user: req.user.id,
      type: type,
      target: target,
      isActive: true
    });
    
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'You are already subscribed to this'
      });
    }
    
    const subscription = new Subscription({
      user: req.user.id,
      email: userEmail, // Use the found email
      type: type,
      target: target,
      displayName: displayName,
      frequency: frequency || 'daily'
    });
    
    await subscription.save();
    
    res.json({
      success: true,
      message: `Subscribed to ${displayName}`,
      subscription: subscription
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/automation/subscriptions/:id - Delete subscription
router.delete('/subscriptions/:id', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Subscription deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/automation/subscriptions/:id/toggle - Toggle subscription status
router.put('/subscriptions/:id/toggle', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }
    
    subscription.isActive = !subscription.isActive;
    await subscription.save();
    
    res.json({
      success: true,
      message: subscription.isActive ? 'Subscription resumed' : 'Subscription paused',
      subscription: subscription
    });
  } catch (error) {
    console.error('Error toggling subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/automation/subscriptions/preferences - Update email preferences
router.put('/subscriptions/preferences', auth, async (req, res) => {
  try {
    const { frequency, enabled } = req.body;
    
    // Update all user's subscriptions
    await Subscription.updateMany(
      { user: req.user.id },
      { 
        frequency: frequency,
        isActive: enabled
      }
    );
    
    res.json({
      success: true,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/automation/products/compare - Get specific products for comparison
router.get('/products/compare', async (req, res) => {
  try {
    const { ids } = req.query; // comma-separated product IDs
    const productIds = ids.split(',').slice(0, 3); // Max 3 products
    
    const products = await Product.find({ 
      _id: { $in: productIds },
      source: 'reddit_automation'
    });
    
    res.json({
      success: true,
      products: products.map(product => ({
        id: product._id,
        name: product.name,
        price: product.price,
        supplier: product.supplier?.platform,
        trendingScore: product.analytics?.trendingScore || 0,
        subreddit: product.redditSource?.subreddit,
        imageUrl: product.imageUrl,
        description: product.description,
        inStock: product.inStock !== false,
        hasVariants: product.variants?.length > 0
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/automation/products/social - Social Shopping Assistant (Community Discovered)
router.get('/products/social', async (req, res) => {
  try {
    // Products with high community engagement (comments + upvotes)
    const products = await Product.find({ 
      source: 'reddit_automation',
      'automation.isAutomated': true,
      'redditSource.comments': { $gt: 20 }, // Real community discussion
      'redditSource.upvotes': { $gt: 100 }   // Real community approval
    })
    .sort({ 
      'redditSource.comments': -1,  // Sort by community discussion
      'redditSource.upvotes': -1 
    })
    .limit(8);

    res.json({
      success: true,
      count: products.length,
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl,
        supplier: p.supplier?.platform,
        trendingScore: p.analytics?.trendingScore || p.redditSource?.engagementScore || 0,
        subreddit: p.redditSource?.subreddit,
        communityEngagement: {
          comments: p.redditSource?.comments || 0,
          upvotes: p.redditSource?.upvotes || 0,
          discussionScore: (p.redditSource?.comments || 0) + (p.redditSource?.upvotes || 0)
        }
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/automation/products/viral - Viral Product Scanner (Cross-Platform Trending)  
router.get('/products/viral', async (req, res) => {
  try {
    // Products trending across multiple metrics - REAL viral detection
    const products = await Product.find({ 
      source: 'reddit_automation',
      'automation.isAutomated': true,
      $and: [
        { 'redditSource.engagementScore': { $gt: 200 } }, // High Reddit engagement
        { 'analytics.trendingScore': { $gt: 70 } },       // High overall trending
        { 'redditSource.upvotes': { $gt: 500 } }          // Viral upvotes
      ]
    })
    .sort({ 
      'redditSource.engagementScore': -1,
      'analytics.trendingScore': -1 
    })
    .limit(8);

    res.json({
      success: true,
      count: products.length,
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl,
        supplier: p.supplier?.platform,
        trendingScore: p.analytics?.trendingScore || p.redditSource?.engagementScore || 0,
        subreddit: p.redditSource?.subreddit,
        viralMetrics: {
          redditEngagement: p.redditSource?.engagementScore || 0,
          upvotes: p.redditSource?.upvotes || 0,
          trendingScore: p.analytics?.trendingScore || 0,
          viralRank: Math.floor(((p.redditSource?.engagementScore || 0) + (p.analytics?.trendingScore || 0)) / 10)
        }
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/automation/products/smart - Smart Product Feed (AI Curated Based on Data)
router.get('/products/smart', async (req, res) => {
  try {
    // Smart curation: Good profit + decent engagement (less strict requirements)
    const products = await Product.find({ 
      source: 'reddit_automation',
      'automation.isAutomated': true,
      $or: [
        { 'pricing.markupAmount': { $gt: 5 } },          // Good profit OR
        { 'redditSource.engagementScore': { $gt: 30 } },  // Decent engagement OR
        { 'supplier.platform': 'CJDropshipping' }               // decent shipping
      ]
    })
    .sort({ 
      'pricing.markupAmount': -1,
      'redditSource.engagementScore': -1,
      createdAt: -1
    })
    .limit(8);

    res.json({
      success: true,
      count: products.length,
      products: products.map(p => ({
        id: p._id,
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl,
        supplier: p.supplier?.platform,
        trendingScore: p.analytics?.trendingScore || p.redditSource?.engagementScore || 0,
        subreddit: p.redditSource?.subreddit,
        smartScore: {
          profit: p.pricing?.markupAmount || 0,
          profitMargin: p.profitMargin || 0,
          engagement: p.redditSource?.engagementScore || 0,
          qualityScore: 50 + (p.supplier?.platform === 'spocket' ? 30 : 0) + (p.pricing?.markupAmount > 10 ? 20 : 0)
        }
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test Real Reviews Scraper
router.get('/test-real-reviews', async (req, res) => {
  try {
    const RealReviewsScraper = require('../services/real-reviews-scraper');
    const scraper = new RealReviewsScraper();
    
    const productName = req.query.product || "wireless bluetooth speaker";
    console.log(`🧪 Testing real reviews for: ${productName}`);
    
    const result = await scraper.getProductReviews(productName);
    await scraper.close();
    
    res.json({
      success: true,
      message: 'Real reviews scraper test completed',
      productName,
      result
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Debug individual review sources
router.get('/debug-review-source', async (req, res) => {
  try {
    const RealReviewsScraper = require('../services/real-reviews-scraper');
    const scraper = new RealReviewsScraper();
    
    const source = req.query.source || 'amazon'; // amazon, reddit, youtube, google
    const product = req.query.product || 'bluetooth speaker';
    
    console.log(`🔍 Testing ${source} for: ${product}`);
    
    let result;
    switch(source) {
      case 'amazon':
        result = await scraper.scrapeAmazonReviews(product);
        break;
      case 'reddit':
        result = await scraper.scrapeRedditReviews(product);
        break;
      case 'youtube':
        result = await scraper.scrapeYouTubeReviews(product);
        break;
      case 'google':
        result = await scraper.scrapeGoogleReviews(product);
        break;
      default:
        result = { success: false, error: 'Invalid source' };
    }
    
    await scraper.close();
    
    res.json({
      success: true,
      source,
      product,
      result
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;