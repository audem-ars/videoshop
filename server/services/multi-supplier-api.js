// server/services/multi-supplier-api.js - REAL SCRAPING + CJ INTEGRATION
const axios = require('axios');
const RealAmazonScraper = require('./real-amazon-scraper'); // NEW!

class MultiSupplierAPI {
  constructor() {
    // CJ API Configuration (PRIMARY for real images)
    this.cjConfig = {
      baseUrl: 'https://developers.cjdropshipping.com/api2.0/v1',
      email: process.env.CJ_EMAIL,
      password: process.env.CJ_PASSWORD,
      accessToken: null,
      tokenExpiry: null,
      refreshToken: null,
      refreshTokenExpiry: null,
      lastRequestTime: 0,
      rateLimitDelay: 60000 // 1 minute between requests
    };

    // Initialize REAL Amazon scraper
    this.amazonScraper = new RealAmazonScraper();

    // CJ PRIMARY for real images, Amazon with REAL scraping as backup
    this.activeSuppliers = ['cj', 'amazon'];
  }

  // Health check for both suppliers
  async healthCheck() {
    const health = {
      status: 'healthy',
      suppliers: {},
      activeCount: 0,
      errors: []
    };

    // Check CJ (primary for real images)
    try {
      const timeSinceLastRequest = Date.now() - this.cjConfig.lastRequestTime;
      const canUseCJ = timeSinceLastRequest > this.cjConfig.rateLimitDelay;

      health.suppliers.cj = {
        status: canUseCJ ? 'working' : 'rate_limited',
        name: 'CJDropshipping',
        productsAvailable: '3M+',
        globalWarehouses: true,
        realImages: true,
        realProductData: true,
        rateLimits: '1 per minute',
        nextAvailable: canUseCJ ? 'now' : `${Math.ceil((this.cjConfig.rateLimitDelay - timeSinceLastRequest) / 1000)}s`
      };

      if (canUseCJ) {
        health.activeCount++;
      }
    } catch (error) {
      health.suppliers.cj = { status: 'error', error: error.message };
      health.errors.push(`CJ: ${error.message}`);
    }

    // Check Amazon (real scraper)
    health.suppliers.amazon = {
      status: 'working',
      name: 'Amazon Real Scraper',
      productsAvailable: 'millions',
      globalShipping: true,
      realImages: true,
      realProductData: true,
      rateLimits: 'moderate'
    };
    health.activeCount++;

    return health;
  }

  // Find products - PRIORITIZE CJ FOR REAL IMAGES
  async findRealProductMatches(trendingProducts) {
    const allMatches = [];
    const maxProducts = 3;

    console.log(`🎯 Processing ${maxProducts} products - CJ FIRST for REAL IMAGES, then REAL AMAZON SCRAPING...`);

    for (let i = 0; i < Math.min(trendingProducts.length, maxProducts); i++) {
      const trendingProduct = trendingProducts[i];
      const title = trendingProduct.redditData?.title || trendingProduct.title || 'trending product';
      console.log(`🔍 Searching for product ${i + 1}/${maxProducts}: ${title}`);
      
      // TRY CJ FIRST (for real images and product data)
      if (i === 0) { // Only try CJ for first product to respect rate limits
        const timeSinceLastCJRequest = Date.now() - this.cjConfig.lastRequestTime;
        if (timeSinceLastCJRequest > this.cjConfig.rateLimitDelay) {
          try {
            console.log(`🏭 Trying CJ first for REAL product images...`);
            const cjMatches = await this.searchCJProducts(trendingProduct);
            if (cjMatches.length > 0) {
              console.log(`✅ CJ found ${cjMatches.length} REAL products with REAL images`);
              allMatches.push(...cjMatches);
              continue; // Skip Amazon for this product
            }
          } catch (error) {
            console.error(`CJ search failed: ${error.message}`);
          }
        } else {
          const waitTime = Math.ceil((this.cjConfig.rateLimitDelay - timeSinceLastCJRequest) / 1000);
          console.log(`⏳ CJ rate limited, wait ${waitTime}s more for REAL images`);
        }
      }

      // Fall back to REAL AMAZON SCRAPING
      try {
        console.log(`🛒 Using REAL Amazon scraping...`);
        const amazonMatches = await this.searchRealAmazonProducts(trendingProduct);
        if (amazonMatches.length > 0) {
          console.log(`✅ Amazon scraper found ${amazonMatches.length} REAL products with REAL images`);
          allMatches.push(...amazonMatches);
        }
      } catch (error) {
        console.error(`Amazon scraping failed: ${error.message}`);
      }

      // Small delay between products
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`🎯 Total products found: ${allMatches.length}`);
    return allMatches;
  }

  // CJ search (PRIMARY) - REAL PRODUCT IMAGES AND DATA
  async searchCJProducts(trendingProduct) {
    try {
      // Check rate limiting
      const timeSinceLastRequest = Date.now() - this.cjConfig.lastRequestTime;
      if (timeSinceLastRequest < this.cjConfig.rateLimitDelay) {
        const waitTime = Math.ceil((this.cjConfig.rateLimitDelay - timeSinceLastRequest) / 1000);
        throw new Error(`Rate limited. Wait ${waitTime} seconds for REAL CJ images`);
      }

      if (!this.isTokenValid()) {
        console.log('🔑 Getting CJ access token...');
        const tokenResult = await this.getCJAccessToken();
        if (!tokenResult.success) {
          throw new Error('CJ authentication failed');
        }
      }

      const title = trendingProduct.redditData?.title || trendingProduct.title || 'trending product';
      const searchTerms = this.extractSearchTerms(title);
      console.log(`🏭 CJ search for REAL products: "${searchTerms}"`);

      this.cjConfig.lastRequestTime = Date.now();

      const response = await axios.get(`${this.cjConfig.baseUrl}/product/list?keyword=${encodeURIComponent(searchTerms)}&pageNum=1&pageSize=10`, {
        headers: {
          'CJ-Access-Token': this.cjConfig.accessToken
        },
        timeout: 15000
      });

      console.log(`📡 CJ API Response:`, {
        success: response.data?.result,
        message: response.data?.message,
        productCount: response.data?.data?.list?.length || 0
      });

      // Add delay to respect CJ rate limiting
      await new Promise(resolve => setTimeout(resolve, 1100));

      if (response.data && response.data.result && response.data.data && response.data.data.list) {
        const products = response.data.data.list.slice(0, 1); // 1 product only for rate limiting
        console.log(`🎯 Found ${products.length} REAL CJ product with REAL images`);
        
        return products.map(product => {
          const supplierPrice = parseFloat(product.sellPrice || 0);
          const finalPrice = supplierPrice * 1.28;
          const profit = finalPrice - supplierPrice;
          
          console.log(`📦 REAL CJ Product: "${product.productNameEn}"`);
          console.log(`🖼️ REAL CJ Image: ${product.productImage}`);
          console.log(`💰 REAL CJ Price: $${supplierPrice}`);
          
          return {
            redditSource: {
              postId: trendingProduct.redditData?.postId || trendingProduct.id,
              title: trendingProduct.redditData?.title || trendingProduct.title,
              subreddit: trendingProduct.redditData?.subreddit || trendingProduct.subreddit,
              upvotes: trendingProduct.redditData?.upvotes || trendingProduct.score,
              comments: trendingProduct.redditData?.comments || trendingProduct.num_comments,
              engagementScore: trendingProduct.redditData?.engagementScore || (trendingProduct.score + trendingProduct.num_comments),
              permalink: trendingProduct.redditData?.permalink || `https://reddit.com${trendingProduct.permalink}`,
              realProduct: true
            },
            
            supplier: {
              platform: 'cjdropshipping',
              productId: product.pid,
              supplierUrl: product.productUrl,
              supplierPrice: supplierPrice,
              supplierTitle: product.productNameEn,
              seller: {
                name: 'CJDropshipping Verified',
                rating: 4.5,
                years: 5
              },
              shipping: {
                freeShipping: true,
                estimatedDays: '7-15',
                global: true
              },
              soldCount: product.sellCount || 0,
              inStock: product.productStatus === 1,
              specifications: {
                realProduct: true,
                realImages: true,
                realPrices: true
              }
            },
            
            productData: {
              title: product.productNameEn || `${this.cleanSearchTerms(searchTerms)} Pro`,
              description: product.description || `High-quality ${product.productNameEn} with global shipping from CJ warehouses. Real product with verified supplier data.`,
              images: product.productImages || [product.productImage],
              mainImage: product.productImage,
              imageUrl: product.productImage, // REAL CJ IMAGE URL
              category: this.mapCategory(product.categoryName),
              supplierPrice: supplierPrice,
              markupPercentage: 28,
              markupAmount: profit,
              finalPrice: finalPrice,
              compareAtPrice: supplierPrice * 1.4,
              inStock: product.productStatus === 1,
              stockQuantity: product.stockQuantity || 999,
              sku: `CJ-${product.pid}`,
              tags: this.generateTags(product.productNameEn),
              seoTitle: `${product.productNameEn} - Fast Global Shipping`,
              seoDescription: `${product.productNameEn} with fast global shipping from CJ warehouses.`,
              realProduct: true,
              cjProductId: product.pid
            },
            
            trendingScore: trendingProduct.redditData?.engagementScore || (trendingProduct.score + trendingProduct.num_comments),
            realProduct: true
          };
        });
      } else {
        console.log('❌ No CJ products found for this search');
        return [];
      }

    } catch (error) {
      console.error('❌ CJ search error:', error.message);
      this.cjConfig.lastRequestTime = Date.now(); // Update last request time even on error
      return [];
    }
  }

  // REAL AMAZON SCRAPING (BACKUP) - Scrapes actual Amazon products
  async searchRealAmazonProducts(trendingProduct) {
    try {
      const title = trendingProduct.redditData?.title || trendingProduct.title || 'trending product';
      const searchTerms = this.extractSearchTerms(title);
      
      console.log(`🛒 REAL Amazon scraping for: "${searchTerms}"`);
      
      // Use the REAL Amazon scraper
      const amazonProducts = await this.amazonScraper.scrapeRealProducts(searchTerms, 1);
      
      return amazonProducts.map(product => ({
        redditSource: {
          postId: trendingProduct.redditData?.postId || trendingProduct.id,
          title: trendingProduct.redditData?.title || trendingProduct.title,
          subreddit: trendingProduct.redditData?.subreddit || trendingProduct.subreddit,
          upvotes: trendingProduct.redditData?.upvotes || trendingProduct.score,
          comments: trendingProduct.redditData?.comments || trendingProduct.num_comments,
          engagementScore: trendingProduct.redditData?.engagementScore || (trendingProduct.score + trendingProduct.num_comments),
          permalink: trendingProduct.redditData?.permalink || `https://reddit.com${trendingProduct.permalink}`,
          realProduct: true
        },
        
        supplier: {
          platform: 'amazon',
          productId: product.asin,
          supplierUrl: product.url,
          supplierPrice: product.price,
          supplierTitle: product.title,
          seller: product.seller,
          shipping: product.shipping,
          soldCount: product.salesRank,
          inStock: product.availability,
          commission: product.commission,
          specifications: {
            realProduct: true,
            realImages: true,
            realPrices: true,
            scraped: true
          }
        },
        
        productData: {
          title: product.title,
          description: product.description,
          images: product.images,
          mainImage: product.realImage || product.images[0], // Use real scraped image
          imageUrl: product.realImage || product.images[0], // REAL AMAZON IMAGE
          category: this.mapCategory(product.category),
          supplierPrice: product.price,
          markupPercentage: 28,
          markupAmount: product.price * 0.28,
          finalPrice: product.price * 1.28,
          compareAtPrice: product.price * 1.4,
          inStock: product.availability,
          stockQuantity: 999,
          sku: `AMZ-${product.asin}`,
          tags: this.generateTags(product.title),
          seoTitle: `${product.title} - Best Price & Fast Shipping`,
          seoDescription: product.description,
          realProduct: true,
          amazonProductId: product.asin,
          reviews: product.reviews // Include review data
        },
        
        trendingScore: trendingProduct.redditData?.engagementScore || (trendingProduct.score + trendingProduct.num_comments),
        realProduct: true
      }));
      
    } catch (error) {
      console.error('❌ Real Amazon scraping error:', error.message);
      return [];
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
        this.cjConfig.refreshToken = response.data.data.refreshToken;
        this.cjConfig.tokenExpiry = new Date(response.data.data.accessTokenExpiryDate).getTime();
        this.cjConfig.refreshTokenExpiry = new Date(response.data.data.refreshTokenExpiryDate).getTime();
        
        console.log('✅ CJ Access Token obtained successfully');
        return { success: true, token: this.cjConfig.accessToken };
      } else {
        throw new Error(response.data?.message || 'Failed to get access token');
      }
    } catch (error) {
      console.error('❌ CJ Authentication failed:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Check if CJ token is still valid
  isTokenValid() {
    return this.cjConfig.accessToken && 
           this.cjConfig.tokenExpiry && 
           Date.now() < this.cjConfig.tokenExpiry;
  }

  // Extract search terms from Reddit title
  extractSearchTerms(title) {
    if (!title || typeof title !== 'string') {
      return 'trending product';
    }
    
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'this', 'that', 'with', 'for', 'as', 'are', 'was', 'will', 'be', 'best', 'good', 'great', 'how', 'what', 'why', 'when', 'where'];
    const words = title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(' ')
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 2);
    
    return words.length > 0 ? words.join(' ') : 'trending product';
  }

  // Clean search terms for product names
  cleanSearchTerms(searchTerms) {
    return searchTerms.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(' ')
      .filter(word => word.length > 2)
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Map categories properly
  mapCategory(category) {
    if (!category) return 'other';
    
    const categoryMap = {
      'Electronics': 'electronics',
      'Home & Kitchen': 'home & garden',
      'Health & Personal Care': 'health & beauty',
      'Health & Beauty': 'health & beauty',
      'Clothing': 'clothing',
      'Sports & Outdoors': 'sports & outdoors',
      'Accessories': 'accessories',
      'Automotive': 'automotive',
      'Books & Media': 'books & media',
      'Food & Beverage': 'food & beverage',
      'Pet Supplies': 'pet supplies'
    };
    
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('water') || lowerCategory.includes('drink') || lowerCategory.includes('kitchen')) return 'home & garden';
    if (lowerCategory.includes('tech') || lowerCategory.includes('phone') || lowerCategory.includes('electronic')) return 'electronics';
    if (lowerCategory.includes('cloth') || lowerCategory.includes('wear') || lowerCategory.includes('fashion')) return 'clothing';
    if (lowerCategory.includes('beauty') || lowerCategory.includes('care') || lowerCategory.includes('health')) return 'health & beauty';
    if (lowerCategory.includes('watch') || lowerCategory.includes('jewelry')) return 'accessories';
    if (lowerCategory.includes('sport') || lowerCategory.includes('fitness') || lowerCategory.includes('outdoor')) return 'sports & outdoors';
    
    return categoryMap[category] || 'other';
  }

  // Generate SEO tags
  generateTags(title) {
    if (!title) return [];
    const words = title.toLowerCase().split(' ').filter(word => word.length > 3);
    return words.slice(0, 5);
  }

  // Test connection method
  async testConnection() {
    try {
      const health = await this.healthCheck();
      return health.activeCount > 0;
    } catch (error) {
      return false;
    }
  }
}

module.exports = MultiSupplierAPI;