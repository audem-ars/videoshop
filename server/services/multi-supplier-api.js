// server/services/multi-supplier-api.js - CJ ONLY (Clean Version)
const axios = require('axios');
const Product = require('../models/Product');

class MultiSupplierAPI {
  constructor() {
    // CJ API Configuration (ONLY SUPPLIER)
    this.cjConfig = {
      baseUrl: 'https://developers.cjdropshipping.com/api2.0/v1',
      email: process.env.CJ_EMAIL,
      password: process.env.CJ_PASSWORD,
      accessToken: null,
      tokenExpiry: null,
      refreshToken: null,
      refreshTokenExpiry: null,
      lastRequestTime: 0,
      rateLimitDelay: 310000, // 5+ minutes between requests (310 seconds)
      processedProductIds: new Set() // TRACK PROCESSED CJ PRODUCTS
    };

    // CJ ONLY
    this.activeSuppliers = ['cj'];
  }

  // Health check for CJ only
  async healthCheck() {
    const health = {
      status: 'healthy',
      suppliers: {},
      activeCount: 0,
      errors: []
    };

    // Check CJ only
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

    return health;
  }

  // MAIN METHOD: Find products from CJ only
  async findRealProductMatches(trendingProducts) {
    const allMatches = [];
    const maxProducts = 3;

    console.log(`🎯 Processing ${maxProducts} products - CJ ONLY with REAL IMAGES...`);

    for (let i = 0; i < Math.min(trendingProducts.length, maxProducts); i++) {
      const trendingProduct = trendingProducts[i];
      const title = trendingProduct.redditData?.title || trendingProduct.title || 'trending product';
      console.log(`🔍 Searching for product ${i + 1}/${maxProducts}: ${title}`);
      
      // CJ ONLY - try all products not just first one
      const timeSinceLastCJRequest = Date.now() - this.cjConfig.lastRequestTime;
      if (timeSinceLastCJRequest > this.cjConfig.rateLimitDelay) {
        try {
          console.log(`🏭 Searching CJ for REAL product images...`);
          const cjMatches = await this.searchCJProductsWithDuplicateCheck(trendingProduct);
          if (cjMatches.length > 0) {
            console.log(`✅ CJ found ${cjMatches.length} NEW products with REAL images`);
            allMatches.push(...cjMatches);
          }
        } catch (error) {
          console.error(`CJ search failed: ${error.message}`);
        }
      } else {
        const waitTime = Math.ceil((this.cjConfig.rateLimitDelay - timeSinceLastCJRequest) / 1000);
        console.log(`⏳ CJ rate limited, wait ${waitTime}s more for REAL images`);
      }

      // Small delay between products
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`🎯 Total CJ products found: ${allMatches.length}`);
    return allMatches;
  }

  // CJ search with duplicate checking
  async searchCJProductsWithDuplicateCheck(trendingProduct) {
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
      console.log(`🏭 CJ search for NEW products: "${searchTerms}"`);

      this.cjConfig.lastRequestTime = Date.now();

      // Get MORE products to find non-duplicates
      const response = await axios.get(`${this.cjConfig.baseUrl}/product/list?keyword=${encodeURIComponent(searchTerms)}&pageNum=1&pageSize=20`, {
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

      await new Promise(resolve => setTimeout(resolve, 1100));

      if (response.data && response.data.result && response.data.data && response.data.data.list) {
        const allProducts = response.data.data.list;
        console.log(`🔍 Scanning ${allProducts.length} CJ products for duplicates...`);
        
        // Find first non-duplicate product
        let selectedProduct = null;
        for (const product of allProducts) {
          // Check if we already processed this product ID
          if (this.cjConfig.processedProductIds.has(product.pid)) {
            console.log(`⏭️ Skipping already processed: ${product.productNameEn} (${product.pid})`);
            continue;
          }

          // Check database for duplicates
          try {
            const existingProducts = await Product.find({ 
              'supplier.productId': product.pid 
            }).limit(1);

            if (existingProducts.length > 0) {
              console.log(`⏭️ Skipping duplicate in database: ${product.productNameEn}`);
              this.cjConfig.processedProductIds.add(product.pid); // Remember this
              continue;
            }
          } catch (dupError) {
            console.log('⚠️ Duplicate check failed, continuing anyway');
          }

          // Found a new product!
          selectedProduct = product;
          this.cjConfig.processedProductIds.add(product.pid); // Remember this
          console.log(`✅ New CJ product selected: ${product.productNameEn}`);
          break;
        }

        if (!selectedProduct) {
          console.log('❌ No new CJ products found - all are duplicates');
          return [];
        }

        // Process the selected product
        try {
          console.log(`📦 Getting detailed info for: "${selectedProduct.productNameEn}"`);
          
          const detailResponse = await axios.get(`${this.cjConfig.baseUrl}/product/variant/query?pid=${selectedProduct.pid}`, {
            headers: {
              'CJ-Access-Token': this.cjConfig.accessToken
            },
            timeout: 15000
          });
          
          console.log(`🔍 CJ Detail API Response:`, {
            success: detailResponse.data?.result,
            message: detailResponse.data?.message,
            variantCount: detailResponse.data?.data?.length || 0
          });
          
          // Combine basic + detailed product info
          const detailedProduct = {
            ...selectedProduct,
            detailedInfo: detailResponse.data?.data || [],
            variants: detailResponse.data?.data || [],
            allImages: this.extractAllImages(selectedProduct, detailResponse.data?.data),
            specifications: this.extractSpecifications(selectedProduct, detailResponse.data?.data)
          };
          
          const supplierPrice = this.extractPrice(selectedProduct.sellPrice);
          const finalPrice = supplierPrice * 1.28;
          const profit = finalPrice - supplierPrice;
          
          console.log(`📦 NEW CJ Product: "${selectedProduct.productNameEn}"`);
          console.log(`🖼️ REAL CJ Images: ${detailedProduct.allImages.length} images`);
          console.log(`🎨 REAL CJ Variants: ${detailedProduct.variants.length} variants`);
          console.log(`💰 REAL CJ Price: $${supplierPrice}`);
          
          return [{
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
              productId: selectedProduct.pid,
              supplierUrl: selectedProduct.productUrl,
              supplierPrice: supplierPrice,
              supplierTitle: selectedProduct.productNameEn,
              seller: {
                name: 'Global Supplier',
                rating: 4.5,
                years: 5
              },
              shipping: {
                freeShipping: true,
                estimatedDays: '7-15',
                global: true
              },
              soldCount: selectedProduct.sellCount || 0,
              inStock: selectedProduct.productStatus === 1,
              specifications: {
                realProduct: true,
                realImages: true,
                realPrices: true,
                variantsAvailable: detailedProduct.variants.length > 0
              }
            },
            
            productData: {
              title: selectedProduct.productNameEn || `${this.cleanSearchTerms(searchTerms)} Pro`,
              description: this.generateRichDescription(detailedProduct),
              
              // MULTIPLE IMAGES - All product images
              images: detailedProduct.allImages,
              mainImage: detailedProduct.allImages[0] || selectedProduct.productImage,
              imageUrl: detailedProduct.allImages[0] || selectedProduct.productImage,
              
              // PRODUCT VARIANTS - Sizes, colors, etc.
              variants: this.processVariants(detailedProduct.variants),
              hasVariants: detailedProduct.variants.length > 0,
              
              // SPECIFICATIONS
              specifications: detailedProduct.specifications,
              
              category: this.mapCategory(selectedProduct.categoryName),
              supplierPrice: supplierPrice,
              markupPercentage: 28,
              markupAmount: profit,
              finalPrice: finalPrice,
              compareAtPrice: supplierPrice * 1.4,
              inStock: selectedProduct.productStatus === 1,
              stockQuantity: 999,
              sku: `CJ-${selectedProduct.pid}`,
              tags: this.generateTags(selectedProduct.productNameEn),
              seoTitle: `${selectedProduct.productNameEn} - Fast Global Shipping`,
              seoDescription: `${selectedProduct.productNameEn} with fast global shipping worldwide.`,
              realProduct: true,
              cjProductId: selectedProduct.pid
            },
            
            trendingScore: trendingProduct.redditData?.engagementScore || (trendingProduct.score + trendingProduct.num_comments),
            realProduct: true
          }];
          
        } catch (detailError) {
          console.error(`❌ Failed to get CJ product details: ${detailError.message}`);
          return [];
        }
      } else {
        console.log('❌ No CJ products found for this search');
        return [];
      }

    } catch (error) {
      console.error('❌ CJ search error:', error.message);
      this.cjConfig.lastRequestTime = Date.now();
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

  extractAllImages(basicProduct, variantData) {
    const images = [];
    
    // Main product image
    if (basicProduct.productImage) {
      images.push(basicProduct.productImage);
    }
    
    // All variant images
    if (Array.isArray(variantData)) {
      variantData.forEach(variant => {
        if (variant.variantImage && !images.includes(variant.variantImage)) {
          images.push(variant.variantImage);
        }
      });
    }
    
    // Images from product description
    if (basicProduct.remark) {
      const imgMatches = basicProduct.remark.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp)/gi);
      if (imgMatches) {
        imgMatches.forEach(imgUrl => {
          if (!images.includes(imgUrl)) {
            images.push(imgUrl);
          }
        });
      }
    }
    
    return [...new Set(images)].filter(img => img && img.startsWith('http'));
  }

  // Process product variants (sizes, colors, etc.)
  processVariants(variants) {
    if (!variants || !Array.isArray(variants)) {
      return [];
    }
    
    return variants.map(variant => ({
      id: variant.vid || variant.id,
      name: variant.variantNameEn || variant.variantName || variant.name,
      sku: variant.variantSku || variant.sku,
      price: parseFloat(variant.variantSellPrice || variant.sellPrice || variant.price || 0),
      image: variant.variantImage || variant.image,
      key: variant.variantKey,
      attributes: {
        weight: variant.variantWeight,
        dimensions: variant.variantStandard,
        volume: variant.variantVolume
      },
      inStock: true,
      stockQuantity: variant.inventoryNum || 999
    }));
  }

  // Extract specifications from CJ data
  extractSpecifications(basicProduct, variantData) {
    const specs = {};
    
    // Basic specifications
    if (basicProduct.productWeight) specs['Weight'] = `${basicProduct.productWeight}g`;
    if (basicProduct.categoryName) specs['Category'] = basicProduct.categoryName;
    if (basicProduct.productType) specs['Type'] = basicProduct.productType;
    
    // Variant specifications
    if (Array.isArray(variantData) && variantData.length > 0) {
      const firstVariant = variantData[0];
      if (firstVariant.variantStandard) specs['Dimensions'] = firstVariant.variantStandard;
    }
    
    return specs;
  }

  // Generate rich product description
  generateRichDescription(product) {
    let description = product.productNameEn || 'Premium Quality Product';
    
    // Add variant information
    if (product.variants && product.variants.length > 0) {
      const variantNames = product.variants.map(v => v.variantKey || v.name).filter(Boolean);
      if (variantNames.length > 0) {
        description += `\n\nAvailable variants: ${variantNames.slice(0, 3).join(', ')}`;
        if (variantNames.length > 3) {
          description += ` and ${variantNames.length - 3} more options`;
        }
      }
    }
    
    // Add specifications if available
    if (product.specifications && Object.keys(product.specifications).length > 0) {
      description += '\n\nSpecifications:\n';
      Object.entries(product.specifications).forEach(([key, value]) => {
        description += `• ${key}: ${value}\n`;
      });
    }
    
    description += '\n\n✅ Fast global shipping worldwide\n✅ Quality guaranteed\n✅ Multiple payment options';    
    return description;
  }

  // Extract price from CJ price string
  extractPrice(priceString) {
    if (!priceString) return 0;
    
    // Handle price ranges like "7.09 -- 8.82"
    const prices = priceString.toString().match(/[\d.]+/g);
    if (prices && prices.length > 0) {
      return parseFloat(prices[0]); // Use lowest price
    }
    
    return 0;
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

  mapCategory(category) {
    if (!category) return 'other';
    
    const categoryMap = {
      'Electronics': 'tech',
      'Home & Kitchen': 'home',
      'Home Office Storage': 'home',
      'Health & Personal Care': 'health',
      'Health & Beauty': 'health',
      'Clothing': 'fashion',
      'Sports & Outdoors': 'sports',
      'Accessories': 'fashion',
      'Automotive': 'automotive',
      'Books & Media': 'books',
      'Food & Beverage': 'food',
      'Pet Supplies': 'pets'
    };
    
    const lowerCategory = category.toLowerCase();
    
    // IMPROVED FASHION DETECTION - Now includes shirt, blouse, dress, etc.
    if (lowerCategory.includes('cloth') || lowerCategory.includes('wear') || lowerCategory.includes('fashion') || 
        lowerCategory.includes('shirt') || lowerCategory.includes('blouse') || lowerCategory.includes('dress') ||
        lowerCategory.includes('top') || lowerCategory.includes('bottom') || lowerCategory.includes('sleeve') ||
        lowerCategory.includes('apparel') || lowerCategory.includes('garment') || lowerCategory.includes('outfit')) {
      return 'fashion';
    }
    
    // TECH DETECTION
    if (lowerCategory.includes('tech') || lowerCategory.includes('phone') || lowerCategory.includes('electronic') ||
        lowerCategory.includes('gadget') || lowerCategory.includes('device') || lowerCategory.includes('computer')) {
      return 'tech';
    }
    
    // HOME DETECTION
    if (lowerCategory.includes('water') || lowerCategory.includes('drink') || lowerCategory.includes('kitchen') ||
        lowerCategory.includes('office') || lowerCategory.includes('storage') || lowerCategory.includes('home') ||
        lowerCategory.includes('furniture') || lowerCategory.includes('decor')) {
      return 'home';
    }
    
    // HEALTH & BEAUTY DETECTION
    if (lowerCategory.includes('beauty') || lowerCategory.includes('care') || lowerCategory.includes('health') ||
        lowerCategory.includes('cosmetic') || lowerCategory.includes('wellness') || lowerCategory.includes('skincare')) {
      return 'health';
    }
    
    // OTHER CATEGORIES
    if (lowerCategory.includes('watch') || lowerCategory.includes('jewelry')) return 'fashion';
    if (lowerCategory.includes('sport') || lowerCategory.includes('fitness') || lowerCategory.includes('outdoor')) return 'sports';
    
    return categoryMap[category] || 'other';
  }

  // Generate SEO tags
  generateTags(title) {
    if (!title) return [];
    const words = title.toLowerCase().split(' ').filter(word => word.length > 3);
    return words.slice(0, 5);
  }

  // Filter out low-quality Chinese text images
filterQualityImages(images) {
  return images.filter(imageUrl => {
    // Skip images with Chinese text indicators
    const lowQualityIndicators = [
      'product/2025/05/27/08/',
      'product/2025/05/27/09/',
      'oss-cf.cjdropshipping.com/product/2025/05/27/08/',
      'oss-cf.cjdropshipping.com/product/2025/05/27/09/',
      'facdb5a8-e71c-419c-b85c-c35b900cff35',
      'b57ba9ee-2428-4b81-87b0-1137324600d7',
      // Skip very small or thumbnail images
      'w=100', 'h=100', 'thumbnail',
      // Skip obvious Chinese character images
      'screenshot', 'spec', 'detail',
      // Screenshot filters
      'trans.jpeg', '_trans', 'detail.jpg', 'specs.jpg',
      'info.jpg', 'size.jpg', 'chart', 'guide',
      'instruction', 'manual', 'description.jpg',
      // HTML/URL screenshot filters
      '.html', 'https://', 'http://',
      'webpage', 'browser', 'url',
      // Chinese character patterns
      '%E', '%C', '%D', // URL encoded Chinese
      'zh-', 'cn-', 'chinese',
      // Common Chinese text image patterns
      'text.jpg', 'info.png', 'desc.jpg',
      'param', 'attribute', 'property',
      // Additional screenshot filters
      'offerlists', 'spm', 'cosite'
    ];
    
    // Filter URLs that look like Chinese text (lots of % encoding)
    const percentCount = (imageUrl.match(/%/g) || []).length;
    if (percentCount > 5) return false; // Too many % = Chinese URL encoding
    
    return !lowQualityIndicators.some(indicator => imageUrl.includes(indicator));
  });
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
  // Add this method to your MultiSupplierAPI class in multi-supplier-api.js
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
}


module.exports = MultiSupplierAPI;