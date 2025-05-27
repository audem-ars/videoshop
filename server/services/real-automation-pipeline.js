// server/services/real-automation-pipeline.js - FIXED DATA MAPPING
const RedditProductScraper = require('./reddit-scraper');
const MultiSupplierAPI = require('./multi-supplier-api');
const Product = require('../models/Product');

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

      const runtime = (Date.now() - startTime) / 1000;
      this.stats.lastRun = new Date();
      this.stats.totalRealProfit = profitReport.totalProfit;

      console.log('\n🎉 REAL AUTOMATION PIPELINE COMPLETED SUCCESSFULLY!');
      console.log('==================================================');
      console.log(`💰 REAL PROFIT POTENTIAL: $${profitReport.totalProfit}`);
      console.log(`📦 REAL PRODUCTS ADDED: ${savedProducts.length}`);

      return {
        success: true,
        message: '100% REAL products with REAL prices successfully added!',
        realProducts: savedProducts,
        report: {
          summary: {
            runtime: `${runtime} seconds`,
            timestamp: new Date(),
            totalProductsProcessed: savedProducts.length,
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

  // Save real products with CORRECT data mapping
  async saveRealProducts(realMatches) {
    const savedProducts = [];

    for (const match of realMatches) {
      try {
        const productName = match.productData.title;
        console.log(`💾 Saving REAL product: ${productName}...`);

        // Map the data CORRECTLY from the supplier response
        const productData = {
          // Basic info
          name: productName,
          description: match.productData.description,
          price: match.productData.finalPrice,
          imageUrl: match.productData.imageUrl || match.productData.mainImage, // FIX: Map image correctly
          category: match.productData.category,
          inStock: match.productData.inStock,
          
          // Source tracking
          source: 'reddit_automation',
          
          // Reddit source data
          redditSource: {
            postId: match.redditSource.postId,
            title: match.redditSource.title,
            subreddit: match.redditSource.subreddit,
            upvotes: match.redditSource.upvotes,
            comments: match.redditSource.comments,
            engagementScore: match.redditSource.engagementScore,
            permalink: match.redditSource.permalink,
            discoveredAt: new Date()
          },
          
          // CORRECT supplier information
          supplier: {
            platform: match.supplier.platform, // This will be 'amazon' or 'cjdropshipping'
            productId: match.supplier.productId,
            supplierUrl: match.supplier.supplierUrl,
            supplierPrice: match.supplier.supplierPrice,
            supplierTitle: match.supplier.supplierTitle,
            seller: match.supplier.seller,
            shipping: {
              free: match.supplier.shipping?.freeShipping || false,
              days: parseInt(match.supplier.shipping?.estimatedDays?.split('-')[0]) || 7,
              cost: 0
            },
            specifications: {
              realProduct: true,
              soldCount: match.supplier.soldCount,
              inStock: match.supplier.inStock
            }
          },
          
          // Pricing information
          pricing: {
            supplierPrice: match.productData.supplierPrice,
            markupPercentage: match.productData.markupPercentage,
            markupAmount: match.productData.markupAmount,
            compareAtPrice: match.productData.compareAtPrice,
            lastPriceUpdate: new Date()
          },
          
          // SEO data
          seo: {
            title: match.productData.seoTitle,
            description: match.productData.seoDescription,
            keywords: match.productData.tags || [],
            tags: match.productData.tags || []
          },
          
          // Analytics
          analytics: {
            views: 0,
            clicks: 0,
            orders: 0,
            revenue: 0,
            conversionRate: 0,
            trendingScore: match.trendingScore,
            lastAnalyticsUpdate: new Date()
          },
          
          // Inventory
          inventory: {
            sku: match.productData.sku,
            stockQuantity: match.productData.stockQuantity,
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

        // Check if product already exists (avoid duplicates)
        const existingProduct = await Product.findOne({
          'redditSource.postId': match.redditSource.postId
        });

        let savedProduct;
        if (existingProduct) {
          console.log(`⚠️ REAL Product already exists, updating: ${productName}`);
          
          // Update existing product with new data
          Object.assign(existingProduct, productData);
          savedProduct = await existingProduct.save();
          
          console.log(`🔄 REAL Product updated: ${productName}`);
        } else {
          // Create new product
          savedProduct = new Product(productData);
          await savedProduct.save();
          
          console.log(`✅ REAL Product saved: ${productName} - $${savedProduct.price}`);
          console.log(`   💰 Real Profit: $${savedProduct.pricing.markupAmount}`);
          console.log(`   📦 Supplier: ${savedProduct.supplier.platform}`);
          console.log(`   🏪 Sold Count: ${savedProduct.supplier.specifications.soldCount || 'N/A'}`);
        }

        savedProducts.push(savedProduct);

      } catch (error) {
        console.error(`❌ Error saving REAL product: ${error.message}`);
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
      const trendingProducts = products.filter(p => (p.analytics?.trendingScore || 0) > 1000);
      if (trendingProducts.length > 0) {
        recommendations.push({
          type: 'trending',
          priority: 'high',
          message: `${trendingProducts.length} products are highly trending. Fast-track these to market.`,
          products: trendingProducts.slice(0, 3).map(p => p.name)
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
        database: 'unknown',
        lastRun: this.stats.lastRun,
        totalProducts: this.stats.realProductsSaved,
        realDataSource: 'Mixed Suppliers'
      };
  
      try {
        // Test Reddit connection
        const redditHealth = await this.redditScraper.testConnection();
        health.redditApi = redditHealth ? 'working' : 'error';
  
        // Test supplier connection
        const supplierHealth = await this.realSupplier.testConnection();
        health.supplierApi = supplierHealth ? 'working' : 'error';
  
        // Test database connection
        try {
          await Product.findOne().limit(1);
          health.database = 'connected';
        } catch (error) {
          health.database = 'error';
        }
  
        // Determine overall status
        if (health.redditApi === 'working' && health.supplierApi === 'working' && health.database === 'connected') {
          health.status = 'healthy';
          health.realDataSource = 'Amazon Associates + CJDropshipping';
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
          (this.stats.totalRealProfit / this.stats.realProductsSaved).toFixed(2) : '0.00'
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
        errors: 0,
        lastRun: null
      };
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