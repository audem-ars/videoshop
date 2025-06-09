// Reddit Product Discovery Engine - FIXED FOR REAL PRODUCTS
const axios = require('axios');

class RedditProductScraper {
  constructor() {
    // Product-focused subreddits only
    this.productSubreddits = [
      'BuyItForLife',         // "Best coffee maker I've owned for 10 years"
      'shutupandtakemymoney', // "This wireless charging pad is amazing"
      'ProductPorn',          // Actual product showcases
      'gadgets',              // "New iPhone 15 Pro Max review"
      'DidntKnowIWantedThat', // "This portable projector is incredible"
      'amazon',               // Amazon product discussions
      'deals'                 // "50% off this Bluetooth speaker"
    ];
    
    this.baseUrl = 'https://www.reddit.com/r/';
    this.headers = {
      'User-Agent': 'VideoShop Product Discovery Bot 1.0'
    };
  }

  // Get trending products from multiple subreddits
  async discoverTrendingProducts(timeFrame = 'day', limit = 25) {
    console.log('🔍 Starting Reddit product discovery...');
    
    const allProducts = [];
    
    for (const subreddit of this.productSubreddits) {
      try {
        console.log(`📱 Scraping r/${subreddit}...`);
        const products = await this.scrapeSubreddit(subreddit, timeFrame, limit);
        allProducts.push(...products);
      } catch (error) {
        console.error(`❌ Error scraping r/${subreddit}:`, error.message);
      }
    }
    
    // Filter for ACTUAL products only
    const realProducts = this.filterRealProducts(allProducts);
    
    console.log(`✅ Found ${realProducts.length} REAL trending products`);
    return realProducts;
  }

  // Scrape individual subreddit
  async scrapeSubreddit(subreddit, timeFrame = 'day', limit = 25) {
    const url = `${this.baseUrl}${subreddit}/top.json?t=${timeFrame}&limit=${limit}`;
    
    try {
      const response = await axios.get(url, { headers: this.headers });
      const posts = response.data.data.children;
      
      const products = [];
      
      for (const post of posts) {
        const postData = post.data;
        
        // Skip if deleted or removed
        if (!postData.title || postData.removed_by_category) continue;
        
        // Analyze if post is about a REAL product
        const productInfo = await this.analyzeRealProduct(postData, subreddit); // MODIFIED: Added await
        
        if (productInfo.isRealProduct) {
          products.push(productInfo);
        }
      }
      
      return products;
      
    } catch (error) {
      console.error(`Error fetching r/${subreddit}:`, error.message);
      return [];
    }
  }

  // Analyze if post is about a REAL product (not random discussion)
  async analyzeRealProduct(postData, subreddit) { // MODIFIED: Added async
    const title = postData.title.toLowerCase();
    const selfText = (postData.selftext || '').toLowerCase();
    const url = postData.url || '';
    
    // REAL product indicators (specific product mentions)
    const realProductPatterns = [
      // Brand + product combinations
      /\b(apple|samsung|sony|lg|dell|hp|lenovo|asus|acer|canon|nikon|nike|adidas|amazon|google|microsoft|intel|amd|nvidia)\s+[\w\s]+/i,
      // Product names with models
      /\b(iphone|galaxy|pixel|macbook|surface|thinkpad|airpods|echo|kindle|fire\s?stick|chromecast|roku|apple\s?watch|fitbit)\s*[\d\w\s]*/i,
      // Specific product types
      /\b(wireless\s+earbuds|bluetooth\s+speaker|gaming\s+chair|mechanical\s+keyboard|coffee\s+maker|air\s+fryer|robot\s+vacuum|smart\s+watch|fitness\s+tracker|dash\s+cam|power\s+bank|phone\s+case|laptop\s+stand|monitor\s+arm|desk\s+lamp|office\s+chair|standing\s+desk|portable\s+charger|wireless\s+charger|usb\s+hub|hdmi\s+cable|ethernet\s+cable|surge\s+protector|extension\s+cord|wall\s+mount|phone\s+holder|car\s+mount|bike\s+rack|water\s+bottle|travel\s+mug|backpack|luggage|suitcase|wallet|purse|sunglasses|watch|headphones|earphones|speakers|microphone|webcam|keyboard|mouse|mousepad|monitor|tv|tablet|laptop|phone|charger|cable|adapter|hub|dock|stand|mount|holder|case|cover|screen\s+protector|tempered\s+glass)\b/i,
      // Review/recommendation patterns
      /\b(best|top|review|recommend|worth\s+it|love\s+this|amazing|incredible|perfect|awesome|great|excellent|favorite|must\s+have|game\s+changer)\s+[\w\s]+\b/i
    ];
    
    // Product purchase indicators
    const purchasePatterns = [
      /\b(bought|purchased|ordered|got|received|delivered|arrived|unboxed|review|using|tried|tested|owned|recommend|worth\s+buying|just\s+got|finally\s+got|picked\s+up|found\s+this|check\s+out|look\s+at\s+this)\b/i
    ];
    
    // Price indicators
    const pricePatterns = [
      /\$\d+/,
      /\d+\s*dollars?/i,
      /\d+\s*bucks?/i,
      /cheap|expensive|deal|sale|discount|price|cost|budget|affordable|worth\s+it/i
    ];
    
    // Check for real product patterns
    const hasRealProduct = realProductPatterns.some(pattern => 
      pattern.test(title) || pattern.test(selfText)
    );
    
    const hasPurchaseIndicator = purchasePatterns.some(pattern => 
      pattern.test(title) || pattern.test(selfText)
    );
    
    const hasPriceInfo = pricePatterns.some(pattern => 
      pattern.test(title) || pattern.test(selfText)
    );
    
    const hasProductUrl = this.containsProductUrl(url);
    
    // Exclude random discussions
    const excludePatterns = [
      /\b(what|why|how|when|where|should\s+i|help|advice|question|discuss|opinion|thoughts|anyone|anybody|does\s+anyone|has\s+anyone)\b/i,
      /\b(twisted\s+ankle|go-to|meal|tips|hacks|experience|terrible|wrong|problem|issue|broke|broken|failed|disappointed)\b/i
    ];
    
    const isRandomDiscussion = excludePatterns.some(pattern => 
      pattern.test(title) || pattern.test(selfText)
    );
    
    // Calculate engagement score
    const engagementScore = this.calculateEngagementScore(postData);
    
    // Determine if it's a REAL product post
    const isRealProduct = (hasRealProduct || hasPurchaseIndicator || hasProductUrl) && 
                         !isRandomDiscussion && 
                         engagementScore > 10; // Minimum engagement
    
    if (!isRealProduct) {
      return { isRealProduct: false };
    }
    
    // Extract REAL product name
    const productName = this.extractProductName(title, selfText);

    // Get real comments (add after the redditData object)
    const comments = await this.getProductComments(postData.id, postData.permalink, 3); // MODIFIED: Added this line
    
    return {
      isRealProduct: true,
      title: productName, // Use extracted product name, not Reddit title
      redditData: {
        postId: postData.id,
        title: postData.title,
        description: postData.selftext || '',
        subreddit: subreddit,
        author: postData.author,
        upvotes: postData.ups,
        downvotes: postData.downs,
        numComments: postData.num_comments, // MODIFIED: Renamed from 'comments'
        engagementScore: engagementScore,
        createdAt: new Date(postData.created_utc * 1000),
        url: postData.url,
        permalink: `https://reddit.com${postData.permalink}`,
        comments: comments  // MODIFIED: ADDED THIS LINE
      },
      productInfo: {
        extractedName: productName,
        extractedPrices: this.extractPrices(title + ' ' + selfText),
        hasDirectLink: hasProductUrl,
        estimatedCategory: this.categorizeProduct(productName)
      }
    };
  }

  // ADD THIS NEW FUNCTION (don't change existing ones)
  async getProductComments(postId, permalink, limit = 3) {
    try {
      // Use the permalink to get comments (it already has the full path)
      const commentsUrl = `https://www.reddit.com${permalink}.json?limit=${limit}&sort=top`;
      
      const response = await axios.get(commentsUrl, { 
        headers: this.headers,
        timeout: 10000 
      });
      
      const comments = [];
      const commentData = response.data[1]?.data?.children || [];
      
      for (const commentPost of commentData.slice(0, limit)) {
        const comment = commentPost.data;
        
        // Skip deleted/removed comments
        if (!comment.body || comment.body === '[deleted]' || comment.body === '[removed]') {
          continue;
        }
        
        // Only include comments with decent upvotes
        if (comment.ups >= 5) {
          comments.push({
            text: comment.body.substring(0, 200), // Limit length
            upvotes: comment.ups,
            username: comment.author,
            createdAt: new Date(comment.created_utc * 1000)
          });
        }
      }
      
      return comments;
      
    } catch (error) {
      console.error(`Error fetching comments for ${postId}:`, error.message);
      return [];
    }
  }

  // Extract actual product name from Reddit post
  extractProductName(title, selfText) {
    const text = title + ' ' + selfText;
    
    // Try to extract brand + product combinations
    const brandProductMatches = text.match(/\b(apple|samsung|sony|lg|dell|hp|lenovo|asus|acer|canon|nikon|nike|adidas|amazon|google|microsoft|intel|amd|nvidia)\s+[\w\s]+/i);
    if (brandProductMatches) {
      return this.cleanProductName(brandProductMatches[0]);
    }
    
    // Try to extract specific product names
    const productMatches = text.match(/\b(iphone|galaxy|pixel|macbook|surface|thinkpad|airpods|echo|kindle|fire\s?stick|chromecast|roku|apple\s?watch|fitbit)[\s\d\w]*/i);
    if (productMatches) {
      return this.cleanProductName(productMatches[0]);
    }
    
    // Try to extract product type descriptions
    const typeMatches = text.match(/\b(wireless\s+earbuds|bluetooth\s+speaker|gaming\s+chair|mechanical\s+keyboard|coffee\s+maker|air\s+fryer|robot\s+vacuum|smart\s+watch|fitness\s+tracker|dash\s+cam|power\s+bank|phone\s+case|laptop\s+stand|monitor\s+arm|desk\s+lamp|office\s+chair|standing\s+desk|portable\s+charger|wireless\s+charger|water\s+bottle|travel\s+mug|backpack|headphones|speakers|keyboard|mouse|monitor|laptop|phone|charger|tablet)\b/i);
    if (typeMatches) {
      return this.cleanProductName(typeMatches[0]);
    }
    
    // Fallback to cleaned title
    return this.cleanProductName(title);
  }

  // Clean and format product name
  cleanProductName(name) {
    return name
      .replace(/[^\w\s]/g, ' ')       // Remove special characters
      .replace(/\s+/g, ' ')           // Normalize spaces
      .trim()                         // Remove leading/trailing spaces
      .split(' ')                     // Split into words
      .slice(0, 4)                    // Take first 4 words max
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Title case
      .join(' ');
  }

  // Check if URL contains product links
  containsProductUrl(url) {
    const productDomains = [
      'amazon.com', 'amzn.', 'ebay.com', 'etsy.com', 'aliexpress.com',
      'alibaba.com', 'walmart.com', 'target.com', 'bestbuy.com',
      'homedepot.com', 'lowes.com', 'wayfair.com', 'overstock.com'
    ];
    
    return productDomains.some(domain => url.includes(domain));
  }

  // Extract price mentions from text
  extractPrices(text) {
    const priceRegexes = [
      /\$\d+(?:\.\d{2})?/g,           // $99.99
      /\d+\s*dollars?/gi,             // 50 dollars
      /\d+\s*bucks?/gi,               // 20 bucks
      /under\s*\$?\d+/gi,             // under $50
      /around\s*\$?\d+/gi             // around $25
    ];
    
    const prices = [];
    priceRegexes.forEach(regex => {
      const matches = text.match(regex);
      if (matches) {
        prices.push(...matches);
      }
    });
    
    return [...new Set(prices)]; // Remove duplicates
  }

  // Calculate engagement score for ranking
  calculateEngagementScore(postData) {
    const upvotes = postData.ups || 0;
    const comments = postData.num_comments || 0;
    const hoursAge = (Date.now() - (postData.created_utc * 1000)) / (1000 * 60 * 60);
    
    // Weighted score considering recency
    const timeDecay = Math.max(0.1, 1 / (1 + hoursAge / 24)); // Decay over days
    const engagementScore = (upvotes + (comments * 2)) * timeDecay;
    
    return Math.round(engagementScore);
  }

  // Categorize product based on keywords
  categorizeProduct(productName) {
    const categories = {
      'electronics': ['phone', 'laptop', 'computer', 'headphones', 'speaker', 'camera', 'tablet', 'tv', 'gaming', 'iphone', 'samsung', 'apple', 'sony', 'lg', 'dell', 'hp', 'airpods', 'echo', 'kindle', 'chromecast', 'roku', 'watch', 'fitbit'],
      'home & garden': ['kitchen', 'furniture', 'decor', 'cleaning', 'organization', 'bed', 'bath', 'coffee', 'maker', 'fryer', 'vacuum', 'chair', 'desk', 'lamp', 'stand'],
      'clothing': ['shirt', 'pants', 'shoes', 'jacket', 'dress', 'clothing', 'fashion', 'wear', 'nike', 'adidas'],
      'sports & outdoors': ['sports', 'outdoor', 'hiking', 'camping', 'exercise', 'bike', 'fitness', 'tracker'],
      'automotive': ['car', 'auto', 'vehicle', 'motorcycle', 'truck', 'dash', 'cam'],
      'other': []
    };
    
    const nameLower = productName.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => nameLower.includes(keyword))) {
        return category;
      }
    }
    
    return 'other';
  }

  // Filter for REAL products only
  filterRealProducts(products) {
    // Remove duplicates based on similar product names
    const uniqueProducts = [];
    const seenNames = new Set();
    
    for (const product of products) {
      const nameKey = product.productInfo.extractedName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!seenNames.has(nameKey) && nameKey.length > 3) {
        seenNames.add(nameKey);
        uniqueProducts.push(product);
      }
    }
    
    // Sort by engagement score (highest first)
    return uniqueProducts
      .sort((a, b) => b.redditData.engagementScore - a.redditData.engagementScore)
      .slice(0, 50); // Limit to top 50
  }

  // Test connection to Reddit API
  async testConnection() {
    try {
      const testUrl = `${this.baseUrl}popular.json?limit=1`;
      const response = await axios.get(testUrl, { 
        headers: this.headers,
        timeout: 5000 
      });
      
      return response.status === 200 && response.data?.data?.children?.length > 0;
    } catch (error) {
      console.error('Reddit connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = RedditProductScraper;