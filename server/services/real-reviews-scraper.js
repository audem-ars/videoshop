// server/services/real-reviews-scraper.js
const puppeteer = require('puppeteer');

class RealReviewsScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initBrowser() {
    if (!this.browser) {
      console.log('🚀 Starting REAL reviews browser...');
      this.browser = await puppeteer.launch({
        headless: false, // Set to false for debugging
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows'
        ]
      });
      
      this.page = await this.browser.newPage();
      
      // Stealth mode setup
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Remove automation indicators
        delete navigator.__proto__.webdriver;
        
        // Mock chrome object
        window.chrome = {
          runtime: {},
        };
        
        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });
      
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await this.page.setViewport({ width: 1366, height: 768 });
      
      // Set extra headers
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
      });
    }
    return this.page;
  }

  // MAIN METHOD: Get real reviews from multiple sources
  async getProductReviews(productName) {
    console.log(`🎯 Getting REAL reviews for: ${productName}`);
    
    const strategies = [
      () => this.scrapeAmazonReviews(productName),
      () => this.scrapeRedditReviews(productName),
      () => this.scrapeYouTubeReviews(productName),
      () => this.scrapeGoogleReviews(productName)
    ];
    
    for (const [index, strategy] of strategies.entries()) {
      try {
        const strategyName = ['Amazon', 'Reddit', 'YouTube', 'Google'][index];
        console.log(`📋 Trying ${strategyName} reviews...`);
        
        const result = await strategy();
        
        if (result.success && result.reviews && result.reviews.length > 0) {
          console.log(`✅ SUCCESS! Got ${result.reviews.length} REAL reviews from ${strategyName}`);
          return result;
        } else {
          console.log(`❌ ${strategyName} failed or no reviews found`);
        }
      } catch (error) {
        console.log(`❌ Strategy ${index + 1} failed:`, error.message);
      }
    }
    
    return { success: false, error: 'No real reviews found from any source' };
  }

  // STRATEGY 1: Amazon Reviews
  async scrapeAmazonReviews(productName) {
    console.log(`🛒 Scraping Amazon for: ${productName}`);
    
    try {
      const page = await this.initBrowser();
      const searchQuery = this.cleanProductName(productName);
      
      // Try Amazon without location redirect
      const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}&ref=nb_sb_noss`;
      console.log(`🔍 Amazon search: ${amazonUrl}`);
      
      await page.goto(amazonUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Add random human-like delay
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      
      // Check if we got redirected to sign-in
      const currentUrl = page.url();
      if (currentUrl.includes('signin') || currentUrl.includes('login')) {
        console.log('🚫 Amazon redirected to sign-in, trying alternative approach...');
        
        // Try going to amazon.com first to set location
        await page.goto('https://www.amazon.com', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try search again
        await page.goto(amazonUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Random mouse movement to appear human
      await page.mouse.move(Math.random() * 1000, Math.random() * 600);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if still on sign-in page
      const finalUrl = page.url();
      if (finalUrl.includes('signin') || finalUrl.includes('login')) {
        console.log('❌ Amazon still requiring sign-in, skipping...');
        return { success: false, source: 'amazon', error: 'Amazon requires sign-in' };
      }
      
      // Look for products - try broader selectors
      const productData = await page.evaluate(() => {
        // Try multiple selectors for Amazon results
        const productSelectors = [
          '[data-component-type="s-search-result"]',
          '.s-result-item',
          '[data-asin]',
          '.a-section'
        ];
        
        let products = [];
        for (const selector of productSelectors) {
          products = document.querySelectorAll(selector);
          if (products.length > 0) {
            console.log(`Found ${products.length} products with selector: ${selector}`);
            break;
          }
        }
        
        if (products.length === 0) {
          return { error: 'No product containers found', pageTitle: document.title, bodyText: document.body.innerText.substring(0, 200) };
        }
        
        // Look for a product with reviews
        for (const product of products) {
          const titleEl = product.querySelector('h2 a span, .a-link-normal .a-text-normal, h2 a, .a-text-normal');
          const linkEl = product.querySelector('h2 a, .a-link-normal, a[href*="/dp/"]');
          const ratingEl = product.querySelector('.a-icon-alt, [aria-label*="star"], [class*="rating"]');
          
          if (titleEl && linkEl && ratingEl) {
            const title = titleEl.textContent?.trim();
            const href = linkEl.href || linkEl.getAttribute('href');
            const ratingText = ratingEl.textContent || ratingEl.getAttribute('aria-label') || '';
            
            if (title && href && ratingText.includes('star')) {
              return {
                title: title,
                productUrl: href.startsWith('http') ? href : `https://www.amazon.com${href}`,
                hasReviews: true
              };
            }
          }
        }
        
        return { error: 'No products with reviews found', productsFound: products.length };
      });
      
      console.log('📊 Amazon product search result:', productData);
      
      if (productData.error) {
        console.log(`❌ ${productData.error}`);
        return { success: false, source: 'amazon', error: productData.error };
      }
      
      if (!productData.hasReviews) {
        return { success: false, source: 'amazon', error: 'No products with reviews found' };
      }
      
      console.log(`✅ Found Amazon product: ${productData.title}`);
      
      // Go to product page
      await page.goto(productData.productUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Look for reviews on product page
      const reviews = await page.evaluate(() => {
        const extractedReviews = [];
        
        // Try to find reviews on the current page first
        const reviewSelectors = [
          '[data-hook="review"]',
          '.cr-original-review-text',
          '.review-text',
          '[class*="review"]'
        ];
        
        let reviewElements = [];
        for (const selector of reviewSelectors) {
          reviewElements = document.querySelectorAll(selector);
          if (reviewElements.length > 0) {
            console.log(`Found ${reviewElements.length} reviews with selector: ${selector}`);
            break;
          }
        }
        
        // If no reviews found, look for "see all reviews" button
        if (reviewElements.length === 0) {
          const seeAllButton = document.querySelector('a[href*="reviews"], a[href*="product-reviews"], [data-hook="see-all-reviews-link"]');
          if (seeAllButton) {
            return { needsNavigation: true, reviewsUrl: seeAllButton.href };
          }
          return [];
        }
        
        // Extract reviews from current page
        Array.from(reviewElements).forEach((reviewEl, index) => {
          if (index >= 33) return; // Limit to 33 reviews
          
          try {
            const ratingEl = reviewEl.querySelector('.a-icon-alt, [class*="rating"]');
            const textEl = reviewEl.querySelector('[data-hook="review-body"] span, .cr-original-review-text, .review-text');
            const authorEl = reviewEl.querySelector('.a-profile-name, [class*="author"]');
            const dateEl = reviewEl.querySelector('[data-hook="review-date"], .review-date');
            
            const rating = ratingEl ? ratingEl.textContent.match(/(\d+)/)?.[1] : null;
            const text = textEl ? textEl.textContent.trim() : '';
            const author = authorEl ? authorEl.textContent.trim() : 'Amazon Customer';
            const date = dateEl ? dateEl.textContent.trim() : null;
            
            if (rating && text && text.length > 10) {
              extractedReviews.push({
                rating: parseInt(rating),
                rawText: text, // Store raw text for cleaning
                reviewer: author,
                date: date,
                helpful: 0,
                verified: true,
                source: 'amazon'
              });
            }
          } catch (error) {
            console.log('Error processing Amazon review:', error);
          }
        });
        
        return extractedReviews;
      });
      
      // If we need to navigate to reviews page
      if (reviews.needsNavigation) {
        console.log('🔄 Navigating to reviews page...');
        await page.goto(reviews.reviewsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extract reviews from dedicated reviews page
        const dedicatedReviews = await page.evaluate(() => {
          const extractedReviews = [];
          const reviewElements = document.querySelectorAll('[data-hook="review"], .cr-original-review-text');
          
          Array.from(reviewElements).forEach((reviewEl, index) => {
            if (index >= 10) return;
            
            try {
              const ratingEl = reviewEl.querySelector('.a-icon-alt');
              const textEl = reviewEl.querySelector('[data-hook="review-body"] span, .cr-original-review-text');
              const authorEl = reviewEl.querySelector('.a-profile-name');
              
              const rating = ratingEl ? ratingEl.textContent.match(/(\d+)/)?.[1] : null;
              const text = textEl ? textEl.textContent.trim() : '';
              const author = authorEl ? authorEl.textContent.trim() : 'Amazon Customer';
              
              if (rating && text && text.length > 10) {
                extractedReviews.push({
                  rating: parseInt(rating),
                  rawText: text, // Store raw text for cleaning
                  reviewer: author,
                  date: null,
                  helpful: 0,
                  verified: true,
                  source: 'amazon'
                });
              }
            } catch (error) {
              console.log('Error processing dedicated review:', error);
            }
          });
          
          return extractedReviews;
        });
        
        reviews = dedicatedReviews;
      }
      
      // CLEAN THE REVIEWS BEFORE RETURNING
      const cleanedReviews = reviews
        .map(review => {
          const cleanedText = this.cleanReviewText(review.rawText);
          return {
            ...review,
            comment: cleanedText.substring(0, 400)
          };
        })
        .filter(review => review.comment.length > 20); // Filter out reviews that became too short after cleaning
      
      console.log(`✅ Extracted ${cleanedReviews.length} cleaned Amazon reviews`);
      
      if (cleanedReviews.length > 0) {
        const avgRating = cleanedReviews.reduce((sum, r) => sum + r.rating, 0) / cleanedReviews.length;
        
        return {
          success: true,
          source: 'amazon',
          productInfo: productData,
          reviews: cleanedReviews,
          overallRating: Math.round(avgRating * 10) / 10,
          totalReviews: cleanedReviews.length
        };
      }
      
      return { success: false, source: 'amazon', error: 'No clean reviews extracted from product page' };
      
    } catch (error) {
      console.error(`❌ Amazon scraping failed:`, error.message);
      return { success: false, source: 'amazon', error: error.message };
    }
  }

  // STRATEGY 2: Reddit Reviews
  async scrapeRedditReviews(productName) {
    console.log(`📱 Scraping Reddit for: ${productName}`);
    
    try {
      const page = await this.initBrowser();
      const searchQuery = this.cleanProductName(productName);
      
      // Search Reddit
      const redditUrl = `https://www.reddit.com/search/?q=${encodeURIComponent(searchQuery + ' review')}&type=comment&sort=top`;
      console.log(`🔍 Reddit search: ${redditUrl}`);
      
      await page.goto(redditUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Extract review comments
      const reviews = await page.evaluate(() => {
        const extractedReviews = [];
        const commentElements = document.querySelectorAll('[data-testid="comment"], .Comment, [class*="comment"]');
        
        Array.from(commentElements).forEach((commentEl, index) => {
          if (index >= 15) return; // Limit to 15 reviews
          
          try {
            const textEl = commentEl.querySelector('p, .md, [class*="text"]');
            const authorEl = commentEl.querySelector('[class*="author"], a[href*="/user/"]');
            const scoreEl = commentEl.querySelector('[class*="score"], [class*="points"]');
            
            const text = textEl ? textEl.textContent.trim() : '';
            const author = authorEl ? authorEl.textContent.trim() : 'Reddit User';
            const score = scoreEl ? scoreEl.textContent.match(/(\d+)/)?.[1] : 0;
            
            if (text && text.length > 20 && text.length < 500) {
              // Determine rating based on sentiment
              const rating = this.analyzeRedditSentiment(text);
              
              extractedReviews.push({
                rating: rating,
                comment: text,
                reviewer: author,
                date: null,
                helpful: score ? parseInt(score) : 0,
                verified: false,
                source: 'reddit'
              });
            }
          } catch (error) {
            console.log('Error processing Reddit comment:', error);
          }
        });
        
        return extractedReviews;
      });
      
      console.log(`✅ Extracted ${reviews.length} Reddit reviews`);
      
      if (reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        
        return {
          success: true,
          source: 'reddit',
          reviews: reviews,
          overallRating: Math.round(avgRating * 10) / 10,
          totalReviews: reviews.length
        };
      }
      
      return { success: false, source: 'reddit', error: 'No reviews found' };
      
    } catch (error) {
      console.error(`❌ Reddit scraping failed:`, error.message);
      return { success: false, source: 'reddit', error: error.message };
    }
  }

  // STRATEGY 3: YouTube Reviews  
  async scrapeYouTubeReviews(productName) {
    console.log(`🎬 Scraping YouTube for: ${productName}`);
    
    try {
      const page = await this.initBrowser();
      const searchQuery = this.cleanProductName(productName);
      
      // Search YouTube for review videos
      const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery + ' review')}`;
      console.log(`🔍 YouTube search: ${youtubeUrl}`);
      
      await page.goto(youtubeUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Find first review video
      const videoClicked = await page.evaluate(() => {
        const videos = document.querySelectorAll('a[href*="/watch"]');
        for (const video of videos) {
          const title = video.querySelector('#video-title');
          if (title && title.textContent.toLowerCase().includes('review')) {
            video.click();
            return true;
          }
        }
        return false;
      });
      
      if (!videoClicked) {
        return { success: false, source: 'youtube', error: 'No review videos found' };
      }
      
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Scroll to load comments
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Extract comments as reviews
      const reviews = await page.evaluate(() => {
        const extractedReviews = [];
        const commentElements = document.querySelectorAll('#content-text, ytd-comment-thread-renderer');
        
        Array.from(commentElements).forEach((commentEl, index) => {
          if (index >= 10) return; // Limit to 10 reviews
          
          try {
            const textEl = commentEl.querySelector('#content-text, .style-scope.ytd-comment-renderer');
            const authorEl = commentEl.querySelector('#author-text, .style-scope.ytd-comment-renderer a');
            const likesEl = commentEl.querySelector('#vote-count-middle, [aria-label*="like"]');
            
            const text = textEl ? textEl.textContent.trim() : '';
            const author = authorEl ? authorEl.textContent.trim() : 'YouTube User';
            const likes = likesEl ? likesEl.textContent.match(/(\d+)/)?.[1] : 0;
            
            if (text && text.length > 15 && text.length < 300) {
              // Determine rating based on sentiment
              const rating = this.analyzeYouTubeSentiment(text);
              
              extractedReviews.push({
                rating: rating,
                comment: text,
                reviewer: author,
                date: null,
                helpful: likes ? parseInt(likes) : 0,
                verified: false,
                source: 'youtube'
              });
            }
          } catch (error) {
            console.log('Error processing YouTube comment:', error);
          }
        });
        
        return extractedReviews;
      });
      
      console.log(`✅ Extracted ${reviews.length} YouTube reviews`);
      
      if (reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        
        return {
          success: true,
          source: 'youtube',
          reviews: reviews,
          overallRating: Math.round(avgRating * 10) / 10,
          totalReviews: reviews.length
        };
      }
      
      return { success: false, source: 'youtube', error: 'No reviews found' };
      
    } catch (error) {
      console.error(`❌ YouTube scraping failed:`, error.message);
      return { success: false, source: 'youtube', error: error.message };
    }
  }

  // STRATEGY 4: Google Reviews
  async scrapeGoogleReviews(productName) {
    console.log(`🔍 Scraping Google for: ${productName}`);
    
    try {
      const page = await this.initBrowser();
      const searchQuery = this.cleanProductName(productName);
      
      // Search Google for product reviews
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' review site:trustpilot.com OR site:sitejabber.com OR site:consumerreports.org')}`;
      console.log(`🔍 Google search: ${googleUrl}`);
      
      await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Click on first review site result
      const reviewSiteClicked = await page.evaluate(() => {
        const results = document.querySelectorAll('a[href*="trustpilot"], a[href*="sitejabber"], a[href*="consumerreports"]');
        if (results.length > 0) {
          results[0].click();
          return true;
        }
        return false;
      });
      
      if (!reviewSiteClicked) {
        return { success: false, source: 'google', error: 'No review sites found' };
      }
      
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Extract reviews from review site
      const reviews = await page.evaluate(() => {
        const extractedReviews = [];
        const reviewSelectors = [
          '.review-content, .review-text, .review-body',
          '[class*="review"] p, [class*="review"] .content',
          '.user-review, .customer-review'
        ];
        
        let reviewElements = [];
        for (const selector of reviewSelectors) {
          reviewElements = document.querySelectorAll(selector);
          if (reviewElements.length > 0) break;
        }
        
        Array.from(reviewElements).forEach((reviewEl, index) => {
          if (index >= 8) return; // Limit to 8 reviews
          
          try {
            const text = reviewEl.textContent.trim();
            
            if (text && text.length > 20 && text.length < 400) {
              // Look for star rating nearby
              const container = reviewEl.closest('.review, [class*="review"]') || reviewEl.parentElement;
              const starElements = container.querySelectorAll('.star, [class*="star"], [class*="rating"]');
              
              let rating = 4; // Default rating
              for (const starEl of starElements) {
                const ratingMatch = starEl.textContent.match(/(\d)/);
                if (ratingMatch) {
                  rating = parseInt(ratingMatch[1]);
                  break;
                }
              }
              
              extractedReviews.push({
                rating: rating,
                comment: text,
                reviewer: 'Verified Customer',
                date: null,
                helpful: 0,
                verified: true,
                source: 'review_site'
              });
            }
          } catch (error) {
            console.log('Error processing review site review:', error);
          }
        });
        
        return extractedReviews;
      });
      
      console.log(`✅ Extracted ${reviews.length} Google/review site reviews`);
      
      if (reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        
        return {
          success: true,
          source: 'review_sites',
          reviews: reviews,
          overallRating: Math.round(avgRating * 10) / 10,
          totalReviews: reviews.length
        };
      }
      
      return { success: false, source: 'google', error: 'No reviews found' };
      
    } catch (error) {
      console.error(`❌ Google scraping failed:`, error.message);
      return { success: false, source: 'google', error: error.message };
    }
  }

  // Helper: Clean review text from JavaScript/CSS artifacts
  cleanReviewText(text) {
    if (!text) return '';
    
    // Remove JavaScript artifacts
    const cleaned = text
      .replace(/\(function\(\)\s*{[\s\S]*?}\)\(\);?/g, '') // Remove function blocks
      .replace(/P\.when\([^)]*\)\.execute\([^)]*\)\s*{[\s\S]*?}\s*\);?/g, '') // Remove P.when calls
      .replace(/A\.toggleExpander[^;]*;?/g, '') // Remove toggleExpander
      .replace(/\.review-text-read-more[^{]*{[^}]*}/g, '') // Remove CSS
      .replace(/focus-visible[^{]*{[^}]*}/g, '') // Remove CSS
      .replace(/outline[^;]*;/g, '') // Remove CSS properties
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    return cleaned;
  }

  // Helper: Analyze Reddit sentiment for rating
  analyzeRedditSentiment(text) {
    const lowerText = text.toLowerCase();
    
    const veryPositive = ['amazing', 'perfect', 'excellent', 'outstanding', 'incredible', 'fantastic', 'love it', 'best ever'];
    const positive = ['good', 'great', 'nice', 'solid', 'recommend', 'happy', 'satisfied', 'works well'];
    const negative = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'waste', 'broken', 'useless'];
    const veryNegative = ['worst', 'garbage', 'scam', 'avoid', 'never again', 'complete shit'];
    
    if (veryNegative.some(word => lowerText.includes(word))) return 1;
    if (negative.some(word => lowerText.includes(word))) return 2;
    if (veryPositive.some(word => lowerText.includes(word))) return 5;
    if (positive.some(word => lowerText.includes(word))) return 4;
    
    return 3; // Neutral
  }

  // Helper: Analyze YouTube sentiment for rating
  analyzeYouTubeSentiment(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('👍') || lowerText.includes('❤️') || lowerText.includes('🔥')) return 5;
    if (lowerText.includes('👎') || lowerText.includes('💩')) return 1;
    
    return this.analyzeRedditSentiment(text);
  }

  // Helper: Clean product name for search
  cleanProductName(productName) {
    return productName
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 3) // First 3 words
      .join(' ');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = RealReviewsScraper;