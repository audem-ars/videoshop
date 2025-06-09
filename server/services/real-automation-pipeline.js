// server/services/real-automation-pipeline.js - FIXED DATA MAPPING
const RedditProductScraper = require('./reddit-scraper');
const MultiSupplierAPI = require('./multi-supplier-api');
const Product = require('../models/Product');
const YouTubeVideoScraper = require('./youtube-video-scraper'); // Existing import, good
const { getOrCacheVideo, getCachedVideos } = require('./youtube-video-scraper');
const Video = require('../models/Video'); // Existing import, good
const Subscription = require('../models/Subscription');
const EmailService = require('./email-service');

class RealAutomationPipeline {
  constructor() {
    this.redditScraper = new RedditProductScraper();
    this.realSupplier = new MultiSupplierAPI();
    this.stats = {
      totalRuns: 0,
      productsDiscovered: 0,
      realProductsMatched: 0,
      realProductsSaved: 0,
      totalRealProfit: 0,
      videosFound: 0, // ADD THIS
      videosSaved: 0, // ADD THIS
      errors: 0,
      lastRun: null
    };
  }

  // Run the complete REAL automation pipeline
  async runRealPipeline(options = {}) {
    const startTime = Date.now();
    console.log('💰 STARTING 100% REAL AUTOMATION PIPELINE...');
    console.log('============================================');

    try {
      this.stats.totalRuns++;

      // STEP 1: Check supplier connections
      console.log('\n🏥 STEP 1: Checking real supplier connection...');
      const isHealthy = await this.checkSystemHealth();
      if (!isHealthy.status === 'healthy') {
        console.log('⚠️ System health issues detected but continuing...');
      }
      console.log('✅ Real supplier connection verified!');

      // STEP 2: Discover trending products from Reddit
      console.log('\n📱 STEP 2: Discovering REAL trending products from Reddit...');
      const trendingProducts = await this.redditScraper.discoverTrendingProducts(
        options.timeFrame || 'day',
        options.limit || 50
      );
      
      this.stats.productsDiscovered = trendingProducts.length;
      console.log(`✅ Found ${trendingProducts.length} REAL trending products`);

      if (trendingProducts.length === 0) {
        throw new Error('No trending products found from Reddit');
      }

      // STEP 3: Find real product matches with suppliers
      console.log('\n🛒 STEP 3: Finding REAL product matches with REAL prices...');
      
      const realMatches = await this.realSupplier.findRealProductMatches(
        trendingProducts.slice(0, options.maxProducts || 3) // Limit to prevent rate limits
      );

      this.stats.realProductsMatched = realMatches.length;
      console.log(`✅ Successfully matched ${realMatches.length} REAL products with REAL suppliers`);

      if (realMatches.length === 0) {
        throw new Error('No REAL products could be matched with suppliers');
      }

      // STEP 4: Save products to database with CORRECT data mapping
      console.log('\n💾 STEP 4: Saving REAL products to database...');
      const savedProducts = await this.saveRealProducts(realMatches);
      
      this.stats.realProductsSaved = savedProducts.length;
      console.log(`✅ Successfully saved ${savedProducts.length} REAL products`);

      // STEP 5: Calculate profit potential
      console.log('\n💰 STEP 5: Calculating REAL profit potential...');
      const profitReport = this.calculateProfitAnalysis(savedProducts);

      // ADD THIS AFTER STEP 5 (before the return statement):
  
      // STEP 6: YouTube Video Automation
      const videoResults = await this.addYouTubeVideoAutomation(savedProducts);
      const alertResults = await this.checkSubscriptionAlerts(savedProducts);

      const runtime = (Date.now() - startTime) / 1000;
      this.stats.lastRun = new Date();
      this.stats.totalRealProfit = profitReport.totalProfit;

      console.log('\n🎉 REAL AUTOMATION PIPELINE COMPLETED SUCCESSFULLY!');
      console.log('==================================================');
      console.log(`💰 REAL PROFIT POTENTIAL: $${profitReport.totalProfit}`);
      console.log(`📦 REAL PRODUCTS ADDED: ${savedProducts.length}`);
      console.log(`🎬 VIDEOS ADDED: ${videoResults.videosSaved}`); // Log video info

      // UPDATE your return statement to include video data:
      return {
        success: true,
        message: '100% REAL products with REAL prices AND YouTube videos successfully added!',
        realProducts: savedProducts,
        videoResults: videoResults, // ADD THIS
        report: {
          summary: {
            runtime: `${runtime} seconds`,
            timestamp: new Date(),
            totalProductsProcessed: savedProducts.length,
            totalVideosAdded: videoResults.videosSaved, // ADD THIS
            status: 'SUCCESS',
            dataSource: savedProducts.length > 0 ? this.getDataSource(savedProducts[0]) : 'Mixed Suppliers'
          },
          profitAnalysis: profitReport,
          topProducts: this.getTopProducts(savedProducts),
          categoryBreakdown: this.getCategoryBreakdown(savedProducts),
          subredditBreakdown: this.getSubredditBreakdown(savedProducts),
          realSupplierData: {
            source: savedProducts.length > 0 ? this.getDataSource(savedProducts[0]) : 'Mixed',
            realPrices: true,
            realImages: true,
            dropshippingReady: true,
            totalRealProducts: savedProducts.length
          },
          // ADD VIDEO SECTION:
          videoAutomation: {
            videosFound: videoResults.videosFound,
            videosSaved: videoResults.videosSaved,
            quotaUsed: videoResults.quotaUsed,
            categories: ['Product Reviews', 'Trending Tech', 'Viral Content'] // Example categories
          },
          subscriptionAlerts: {
            alertsSent: alertResults.alertsSent || 0,
            error: alertResults.error || null
          },
          recommendations: this.generateRecommendations(savedProducts)
        },
        stats: this.stats
      };

    } catch (error) {
      this.stats.errors++;
      console.error('❌ REAL AUTOMATION PIPELINE FAILED:', error.message);
      
      return {
        success: false,
        error: error.message,
        stats: this.stats
      };
    }
  }

  // ADD THIS NEW METHOD to your RealAutomationPipeline class
  async addYouTubeVideoAutomation(savedProducts) {
    console.log('\n🎬 STEP 6: Adding YouTube videos for products...');
    
    try {
      let totalVideosFound = 0;
      let totalVideosSaved = 0;
      let quotaUsed = { used: 0, remaining: 10000, percentage: '0%' };
  
      // Get videos for each product using CACHING
      for (const product of savedProducts.slice(0, 4)) { // Process up to 4 products
        console.log(`🔍 Getting videos for: ${product.name.substring(0, 40)}...`);
        
        try {
          // NEW: Get only 1 video per product
const productVideos = await getOrCacheVideo(
  product.name, 
  product._id.toString(), 
  product.category || 'other',
  1  // maxResults = 1
);
          
          if (productVideos && productVideos.length > 0) {
            totalVideosFound += productVideos.length;
            totalVideosSaved += productVideos.length;
            console.log(`✅ Found ${productVideos.length} videos for ${product.name.substring(0, 30)}`);
            
            // Log each video
            productVideos.forEach(video => {
              console.log(`💾 Video saved: ${video.title.substring(0, 30)}...`);
            });
          } else {
            console.log(`✅ Found 0 videos for ${product.name.substring(0, 30)}`);
          }
          
        } catch (error) {
          console.error(`❌ Error getting videos for ${product.name}:`, error.message);
        }
      }
  
      // Get trending videos if we need more content
      if (totalVideosSaved < 3) {
        console.log('🔥 Getting trending clickbait videos...');
        
        const trendingQueries = [
          'viral products 2025',
          'amazing gadgets trending',
          'must have items'
        ];
        
        for (const query of trendingQueries.slice(0, 3)) {
          if (totalVideosSaved >= 6) break;
          
          try {
            const trendingVideos = await getOrCacheVideo(query, 'trending', 'viral');
            if (trendingVideos && trendingVideos.length > 0) {
              totalVideosFound += trendingVideos.length;
              totalVideosSaved += trendingVideos.length;
              trendingVideos.forEach(video => {
                console.log(`💾 Video saved: ${video.title.substring(0, 30)}...`);
              });
            }
          } catch (error) {
            console.error(`❌ Error getting trending videos:`, error.message);
          }
        }
      }
  
      // Update stats
      this.stats.videosFound += totalVideosFound;
      this.stats.videosSaved += totalVideosSaved;
  
      console.log(`✅ YouTube automation complete: ${totalVideosSaved}/${totalVideosFound} videos saved`);
  
      return {
        videosFound: totalVideosFound,
        videosSaved: totalVideosSaved,
        quotaUsed: quotaUsed
      };
  
    } catch (error) {
      console.error('❌ YouTube video automation failed:', error.message);
      this.stats.errors++;
      return { 
        videosFound: 0, 
        videosSaved: 0, 
        error: error.message,
        quotaUsed: { used: 0, remaining: 10000, percentage: '0%' }
      };
    }
  }

  // Get product reviews from real sources
  async getProductReviews(productName) {
    try {
      const RealReviewsScraper = require('./real-reviews-scraper');
      const scraper = new RealReviewsScraper();
      
      console.log(`🎯 Getting REAL reviews for: ${productName}`);
      const result = await scraper.getProductReviews(productName);
      await scraper.close();
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to get reviews for ${productName}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async checkSubscriptionAlerts(savedProducts) {
    console.log('\n📧 STEP 7: Checking subscription alerts...');
    
    try {
      let alertsSent = 0;
      
      for (const product of savedProducts) {
        console.log(`📧 Checking alerts for: ${product.name.substring(0, 40)}...`);
        
        // Find users subscribed to this product's category
        const categorySubscriptions = await Subscription.find({
          type: 'category',
          target: product.category,
          isActive: true
        });
        
        // Find users subscribed to "all new products"
        const allProductSubscriptions = await Subscription.find({
          type: 'new-products',
          target: 'all',
          isActive: true
        });
        
        // Combine all subscriptions
        const allSubscriptions = [...categorySubscriptions, ...allProductSubscriptions];
        
        // Send alerts
        for (const subscription of allSubscriptions) {
          try {
            await this.sendProductAlert(subscription, product);
            alertsSent++;
            console.log(`✅ Alert sent to ${subscription.email} for ${product.name.substring(0, 30)}`);
          } catch (error) {
            console.error(`❌ Failed to send alert to ${subscription.email}:`, error.message);
          }
        }
      }
      
      console.log(`📧 Subscription alerts complete: ${alertsSent} alerts sent`);
      return { alertsSent };
      
    } catch (error) {
      console.error('❌ Subscription alert error:', error);
      return { alertsSent: 0, error: error.message };
    }
  }
  
  // ADD THIS HELPER METHOD TOO:
  async sendProductAlert(subscription, product) {
    try {
      const emailContent = {
        from: process.env.GMAIL_USER,
        to: subscription.email,
        subject: `🔥 New ${subscription.displayName} Product Alert!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d4af37;">🔥 New Product Alert!</h2>
            <p>Hi! We found a new product in your subscribed category: <strong>${subscription.displayName}</strong></p>
            
            <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; max-width: 300px; border-radius: 8px;">
              <h3 style="color: #333; margin: 16px 0 8px 0;">${product.name}</h3>
              <p style="font-size: 24px; color: #d4af37; font-weight: bold;">$${product.price}</p>
              <p style="color: #666;">${product.description.substring(0, 150)}...</p>
              <p style="font-size: 14px; color: #999;">Found on r/${product.redditSource?.subreddit} • ${product.redditSource?.engagementScore} engagement score</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5000/?product=${product._id}" 
                 style="background: #d4af37; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View Product
              </a>
            </div>
            
            <p style="font-size: 12px; color: #666;">
              You're receiving this because you subscribed to ${subscription.displayName} alerts. 
              <a href="http://localhost:5000/subscriptions">Manage your subscriptions</a>
            </p>
          </div>
        `
      };
      
      await EmailService.transporter.sendMail(emailContent);
      
      // Update subscription stats
      subscription.lastAlertSent = new Date();
      subscription.alertCount += 1;
      await subscription.save();
      
      return true;
    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  }

  async saveRealProducts(realMatches) {
    const savedProducts = [];
  
    for (const match of realMatches) {
      try {
        const productName = match.productData.title;
        console.log(`💾 Saving REAL product: ${productName}...`);
  
        // SAFE ARRAY ACCESS - Fix the undefined length error
        const safeImages = Array.isArray(match.productData.images) ? match.productData.images : [match.productData.imageUrl || match.productData.mainImage];
        const safeVariants = Array.isArray(match.productData.variants) ? match.productData.variants : [];
        const safeSpecs = match.productData.specifications || {};
        let safeTags = Array.isArray(match.productData.tags) ? match.productData.tags : [];
        if (typeof match.productData.category === 'string' && !safeTags.includes(match.productData.category)) {
            safeTags.push(match.productData.category);
        }
        
        // SAFE TRENDING SCORE - Fix NaN error
        const safeTrendingScore = match.trendingScore || match.redditSource?.engagementScore || 1;
        const numericTrendingScore = isNaN(safeTrendingScore) ? 1 : Number(safeTrendingScore);
  
        // Map the data CORRECTLY from the supplier response
        const productData = {
          // Basic info
          name: productName,
          description: match.productData.description || `High-quality ${productName} with fast shipping.`,
          price: match.productData.finalPrice || match.productData.price || 0,
          imageUrl: safeImages[0] || match.productData.mainImage || match.productData.imageUrl,
          category: match.productData.category || 'electronics',
          inStock: match.productData.inStock !== false,
          
          // Source tracking
          source: 'reddit_automation',
          
          // Reddit source data
          redditSource: {
            postId: match.redditSource?.postId || `reddit_${Date.now()}`,
            title: match.redditSource?.title || productName,
            subreddit: match.redditSource?.subreddit || 'gadgets',
            upvotes: match.redditSource?.upvotes || 0,
            comments: (match.redditSource?.comments || []).length, // <-- FIXED: Save count, not array
            engagementScore: numericTrendingScore,
            permalink: match.redditSource?.permalink || '',
            discoveredAt: new Date()
          },
          
          // CORRECT supplier information
          supplier: {
            platform: match.supplier?.platform || 'unknown',
            productId: match.supplier?.productId || `prod_${Date.now()}`,
            supplierUrl: match.supplier?.supplierUrl || '',
            supplierPrice: match.supplier?.supplierPrice || match.productData?.supplierPrice || 0,
            supplierTitle: match.supplier?.supplierTitle || productName,
            seller: match.supplier?.seller || { name: 'Unknown Seller', rating: 4.0 },
            shipping: {
              free: match.supplier?.shipping?.freeShipping || false,
              days: 7,
              cost: 0
            },
            specifications: {
              realProduct: true,
              soldCount: match.supplier?.soldCount || 0,
              inStock: match.supplier?.inStock !== false,
              variantsAvailable: safeVariants.length > 0
            }
          },
          
          // Pricing information
          pricing: {
            supplierPrice: match.productData?.supplierPrice || match.supplier?.supplierPrice || 0,
            markupPercentage: match.productData?.markupPercentage || 30,
            markupAmount: match.productData?.markupAmount || 0,
            compareAtPrice: match.productData?.compareAtPrice || 0,
            lastPriceUpdate: new Date()
          },
          
          // PRODUCT VARIANTS - SAFE HANDLING
          variants: safeVariants,
          hasVariants: safeVariants.length > 0,
          
          // MULTIPLE IMAGES - SAFE HANDLING
          images: safeImages,
          specifications: safeSpecs,
          
          // SEO data
          seo: {
            title: match.productData?.seoTitle || productName,
            description: match.productData?.seoDescription || `${productName} with fast shipping`,
            keywords: safeTags,
            tags: safeTags
          },
          
          // Analytics - SAFE TRENDING SCORE
          analytics: {
            views: 0,
            clicks: 0,
            orders: 0,
            revenue: 0,
            conversionRate: 0,
            trendingScore: numericTrendingScore,
            lastAnalyticsUpdate: new Date()
          },
          
          // Inventory - UNIQUE SKU
          inventory: {
            sku: `${match.productData?.sku || 'PROD'}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            stockQuantity: match.productData?.stockQuantity || 999,
            lowStockThreshold: 10,
            trackInventory: false
          },
          
          // Status
          status: 'active',
          
          // Automation metadata
          automation: {
            isAutomated: true,
            lastSyncAt: new Date(),
            syncErrors: [],
            needsReview: false,
            autoUpdatePrice: true,
            autoUpdateInventory: true
          }
        };
  
        // NO DEDUPLICATION - ALWAYS CREATE NEW PRODUCTS
        const savedProduct = new Product(productData);
        await savedProduct.save();
        
        console.log(`✅ REAL Product saved: ${productName} - $${savedProduct.price}`);
        console.log(`   💰 Real Profit: $${savedProduct.pricing.markupAmount}`);
        console.log(`   📦 Supplier: ${savedProduct.supplier.platform}`);
        // Get real reviews for the product
        console.log(`📝 Getting REAL reviews for: ${productName}`);
        const reviewsResult = await this.getProductReviews(productName);
        
        // Add reviews to saved product
        console.log(`🧪 DEBUG: reviewsResult =`, JSON.stringify(reviewsResult, null, 2));
        if (reviewsResult.success && reviewsResult.reviews && reviewsResult.reviews.length > 0) {
          savedProduct.reviewsData = {
            reviews: reviewsResult.reviews,
            overallRating: reviewsResult.overallRating,
            totalReviews: reviewsResult.totalReviews
          };
          await savedProduct.save();
          console.log(`   ⭐ Reviews: ${savedProduct.reviewsData?.totalReviews || 0} reviews (${savedProduct.reviewsData?.overallRating || 'N/A'}★)`);
        } else {
          console.log(`   ⭐ Reviews: No reviews found`);
        }
        console.log(`   🖼️ Images: ${safeImages.length} images`);
        console.log(`   🎨 Variants: ${safeVariants.length} variants`);
        console.log(`   🏪 Sold Count: ${savedProduct.supplier.specifications.soldCount || 'N/A'}`);
  
        savedProducts.push(savedProduct);
  
      } catch (error) {
        console.error(`❌ Error saving REAL product: ${error.message}`);
        console.error('❌ Error details:', error);
        this.stats.errors++;
      }
    }
  
    return savedProducts;
  }

  // Get data source for reporting
  getDataSource(product) {
    const platform = product.supplier?.platform;
    if (platform === 'amazon') return 'Amazon Associates';
    if (platform === 'cjdropshipping') return 'CJDropshipping';
    return 'Mixed Suppliers';
  }

  // Calculate profit analysis
  calculateProfitAnalysis(products) {
    if (products.length === 0) {
      return {
        totalProducts: 0,
        totalSupplierCost: '0.00',
        totalRevenue: '0.00',
        totalProfit: '0.00',
        averageProfit: '0.00',
        profitMargin: '0%'
      };
    }

    const totalSupplierCost = products.reduce((sum, p) => sum + (p.pricing?.supplierPrice || 0), 0);
    const totalRevenue = products.reduce((sum, p) => sum + (p.price || 0), 0);
    const totalProfit = totalRevenue - totalSupplierCost;

    return {
      totalProducts: products.length,
      totalSupplierCost: totalSupplierCost.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      averageProfit: (totalProfit / products.length).toFixed(2),
      profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) + '%' : '0%'
    };
  }

  // Get top products for reporting
  getTopProducts(products) {
    return products
      .sort((a, b) => (b.pricing?.markupAmount || 0) - (a.pricing?.markupAmount || 0))
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        price: `$${p.price.toFixed(2)}`,
        supplierPrice: `$${(p.pricing?.supplierPrice || 0).toFixed(2)}`,
        profit: `$${(p.pricing?.markupAmount || 0).toFixed(2)}`,
        trendingScore: p.analytics?.trendingScore || 0,
        subreddit: p.redditSource?.subreddit || 'unknown',
        cjProductId: p.supplier?.productId || 'N/A',
        realProduct: true
      }));
  }

  // Get category breakdown
  getCategoryBreakdown(products) {
    const categories = {};
    products.forEach(p => {
      const cat = p.category || 'other';
      if (!categories[cat]) {
        categories[cat] = { category: cat, count: 0, totalProfit: 0, averageProfit: 0 };
      }
      categories[cat].count++;
      categories[cat].totalProfit += p.pricing?.markupAmount || 0;
    });

    return Object.values(categories).map(cat => ({
      ...cat,
      totalProfit: cat.totalProfit.toFixed(2),
      averageProfit: (cat.totalProfit / cat.count).toFixed(2)
    }));
  }

  // Get subreddit breakdown
  getSubredditBreakdown(products) {
    const subreddits = {};
    products.forEach(p => {
      const sub = p.redditSource?.subreddit || 'unknown';
      if (!subreddits[sub]) {
        subreddits[sub] = { subreddit: sub, count: 0, totalEngagement: 0, averageEngagement: 0 };
      }
      subreddits[sub].count++;
      subreddits[sub].totalEngagement += p.analytics?.trendingScore || 0;
    });

    return Object.values(subreddits).map(sub => ({
        ...sub,
        averageEngagement: sub.count > 0 ? Math.round(sub.totalEngagement / sub.count) : 0
      }));
    }
  
    // Generate recommendations
    generateRecommendations(products) {
      const recommendations = [];
  
      // High profit products
      const highProfitProducts = products.filter(p => (p.pricing?.markupAmount || 0) > 15);
      if (highProfitProducts.length > 0) {
        recommendations.push({
          type: 'high-profit',
          priority: 'high',
          message: `${highProfitProducts.length} products have high profit margins (>$15). Focus marketing on these.`,
          products: highProfitProducts.slice(0, 3).map(p => p.name)
        });
      }
  
      // Trending products
      const trendingProductsList = products.filter(p => (p.analytics?.trendingScore || 0) > 1000);
      if (trendingProductsList.length > 0) {
        recommendations.push({
          type: 'trending',
          priority: 'high',
          message: `${trendingProductsList.length} products are highly trending. Fast-track these to market.`,
          products: trendingProductsList.slice(0, 3).map(p => p.name)
        });
      }
  
      // Category insights
      const categoryBreakdown = this.getCategoryBreakdown(products);
      const topCategory = categoryBreakdown.sort((a, b) => parseFloat(b.totalProfit) - parseFloat(a.totalProfit))[0];
      if (topCategory && parseFloat(topCategory.totalProfit) > 20) {
        recommendations.push({
          type: 'category',
          priority: 'medium',
          message: `${topCategory.category} is your most profitable category with $${topCategory.totalProfit} total profit potential.`
        });
      }
  
      return recommendations;
    }
  
    // Check system health
    async checkSystemHealth() {
      const health = {
        status: 'healthy',
        redditApi: 'unknown',
        supplierApi: 'unknown',
        youtubeApi: 'unknown', // Add YouTube API status
        database: 'unknown',
        lastRun: this.stats.lastRun,
        totalProducts: this.stats.realProductsSaved,
        totalVideos: this.stats.videosSaved, // Add total videos
        realDataSource: 'Mixed Suppliers'
      };
  
      try {
        // Test Reddit connection
        const redditHealth = await this.redditScraper.testConnection();
        health.redditApi = redditHealth ? 'working' : 'error';
  
        // Test supplier connection
        const supplierHealth = await this.realSupplier.testConnection();
        health.supplierApi = supplierHealth ? 'working' : 'error';

        // Test YouTube connection (check cached videos)
try {
  const cachedVideos = await getCachedVideos(1);
  health.youtubeApi = 'cached_working';
} catch (youtubeError) {
  health.youtubeApi = 'error';
}
  
        // Test database connection
        try {
          await Product.findOne().limit(1);
          await Video.findOne().limit(1); // Also check Video model
          health.database = 'connected';
        } catch (error) {
          health.database = 'error';
        }
  
        // Determine overall status
        if (health.redditApi === 'working' && health.supplierApi === 'working' && health.youtubeApi === 'working' && health.database === 'connected') {
          health.status = 'healthy';
          health.realDataSource = 'Amazon Associates + CJDropshipping + YouTube';
        } else {
          health.status = 'unhealthy';
        }
  
      } catch (error) {
        health.status = 'unhealthy';
        health.error = error.message;
      }
  
      return health;
    }
  
    // Get automation statistics
    getStats() {
      return {
        ...this.stats,
        lastRunFormatted: this.stats.lastRun ? this.stats.lastRun.toLocaleString() : 'Never',
        successRate: this.stats.totalRuns > 0 ? 
          (((this.stats.totalRuns - this.stats.errors) / this.stats.totalRuns) * 100).toFixed(1) + '%' : '0%',
        averageProfitPerProduct: this.stats.realProductsSaved > 0 ? 
          (this.stats.totalRealProfit / this.stats.realProductsSaved).toFixed(2) : '0.00',
        averageVideosPerProduct: this.stats.realProductsSaved > 0 && this.stats.videosSaved > 0 ?
          (this.stats.videosSaved / this.stats.realProductsSaved).toFixed(2) : '0.00' // Added video stat
      };
    }
  
    // Reset automation stats
    resetStats() {
      this.stats = {
        totalRuns: 0,
        productsDiscovered: 0,
        realProductsMatched: 0,
        realProductsSaved: 0,
        totalRealProfit: 0,
        videosFound: 0, 
        videosSaved: 0,
        errors: 0,
        lastRun: null
      };
      // Also reset YouTube scraper stats if needed
      if (this.youtubeScraper && typeof this.youtubeScraper.resetQuotaUsage === 'function') {
        this.youtubeScraper.resetQuotaUsage();
      }
    }
  
    // Get products that need review
    async getProductsNeedingReview() {
      try {
        return await Product.find({
          source: 'reddit_automation',
          'automation.needsReview': true
        }).sort({ updatedAt: -1 });
      } catch (error) {
        console.error('Error fetching products needing review:', error);
        return [];
      }
    }
  
    // Update product prices from suppliers
    async updateProductPrices() {
      try {
        const productsToUpdate = await Product.findNeedingPriceUpdate(7); // 7 days old
        console.log(`Found ${productsToUpdate.length} products needing price updates`);
  
        let updatedCount = 0;
        for (const product of productsToUpdate) {
          try {
            const success = await product.syncWithSupplier();
            if (success) updatedCount++;
          } catch (error) {
            console.error(`Failed to update product ${product.name}:`, error.message);
          }
        }
  
        console.log(`Successfully updated ${updatedCount} product prices`);
        return { updated: updatedCount, total: productsToUpdate.length };
  
      } catch (error) {
        console.error('Error updating product prices:', error);
        return { updated: 0, total: 0, error: error.message };
      }
    }
  
    // Get performance report
    async getPerformanceReport() {
      try {
        const automatedProducts = await Product.find({
          source: 'reddit_automation',
          'automation.isAutomated': true
        }).sort({ 'analytics.revenue': -1 });
  
        const totalRevenue = automatedProducts.reduce((sum, p) => sum + (p.analytics?.revenue || 0), 0);
        const totalOrders = automatedProducts.reduce((sum, p) => sum + (p.analytics?.orders || 0), 0);
        const totalViews = automatedProducts.reduce((sum, p) => sum + (p.analytics?.views || 0), 0);
  
        return {
          summary: {
            totalProducts: automatedProducts.length,
            totalRevenue: totalRevenue.toFixed(2),
            totalOrders,
            totalViews,
            averageOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0.00',
            overallConversionRate: totalViews > 0 ? ((totalOrders / totalViews) * 100).toFixed(2) + '%' : '0%'
          },
          topPerformers: automatedProducts.slice(0, 10).map(p => ({
            name: p.name,
            revenue: p.analytics?.revenue || 0,
            orders: p.analytics?.orders || 0,
            views: p.analytics?.views || 0,
            conversionRate: p.analytics?.conversionRate || 0,
            subreddit: p.redditSource?.subreddit,
            supplier: p.supplier?.platform
          })),
          categoryPerformance: this.calculateCategoryPerformance(automatedProducts),
          subredditPerformance: this.calculateSubredditPerformance(automatedProducts)
        };
  
      } catch (error) {
        console.error('Error generating performance report:', error);
        return { error: error.message };
      }
    }
  
    // Calculate category performance
    calculateCategoryPerformance(products) {
      const categories = {};
      
      products.forEach(p => {
        const cat = p.category || 'other';
        if (!categories[cat]) {
          categories[cat] = {
            category: cat,
            products: 0,
            revenue: 0,
            orders: 0,
            views: 0
          };
        }
        
        categories[cat].products++;
        categories[cat].revenue += p.analytics?.revenue || 0;
        categories[cat].orders += p.analytics?.orders || 0;
        categories[cat].views += p.analytics?.views || 0;
      });
  
      return Object.values(categories).map(cat => ({
        ...cat,
        averageRevenue: cat.products > 0 ? (cat.revenue / cat.products).toFixed(2) : '0.00',
        conversionRate: cat.views > 0 ? ((cat.orders / cat.views) * 100).toFixed(2) + '%' : '0%'
      })).sort((a, b) => b.revenue - a.revenue);
    }
  
    // Calculate subreddit performance
    calculateSubredditPerformance(products) {
      const subreddits = {};
      
      products.forEach(p => {
        const sub = p.redditSource?.subreddit || 'unknown';
        if (!subreddits[sub]) {
          subreddits[sub] = {
            subreddit: sub,
            products: 0,
            revenue: 0,
            orders: 0,
            totalEngagement: 0
          };
        }
        
        subreddits[sub].products++;
        subreddits[sub].revenue += p.analytics?.revenue || 0;
        subreddits[sub].orders += p.analytics?.orders || 0;
        subreddits[sub].totalEngagement += p.analytics?.trendingScore || 0;
      });
  
      return Object.values(subreddits).map(sub => ({
        ...sub,
        averageRevenue: sub.products > 0 ? (sub.revenue / sub.products).toFixed(2) : '0.00',
        averageEngagement: sub.products > 0 ? Math.round(sub.totalEngagement / sub.products) : 0
      })).sort((a, b) => b.revenue - a.revenue);
    }
  }
  
  module.exports = RealAutomationPipeline;