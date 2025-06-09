// server/services/youtube-video-scraper.js
const axios = require('axios');
const Video = require('../models/Video');

class YouTubeVideoScraper {
  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    this.quotaUsed = 0;
    this.dailyLimit = 10000;
  }

  async searchProductVideos(productName, maxResults = 5, productId = null, category = '') {
    try {
      console.log(`🎬 Initiating YouTube search/cache for: ${productName}`);

      const videos = await this.getOrCacheVideo(productName, productId, category, maxResults);
      console.log(`✅ Found/Cached ${videos.length} videos for ${productName}`);
      return videos;

    } catch (error) {
      console.error(`❌ YouTube search error for ${productName}:`, error.message);
      return [];
    }
  }

  // MAIN CACHING FUNCTION
  async getOrCacheVideo(productName, productId, category = '', maxResults = 2) {
    try {
      console.log(`[CACHE] 🔍 Checking cache for product: ${productName} (ID: ${productId})`);
      
      // FIRST: Check database cache
      let queryConditions = [];
      if (productId) queryConditions.push({ relatedProductId: productId });
      if (productName) queryConditions.push({ relatedProductName: productName });
      
      if (queryConditions.length === 0) {
          console.warn("[CACHE] No product name or ID provided for cache lookup.");
      } else {
        const cachedVideos = await Video.find({
          $or: queryConditions,
          apiCallMade: true,
          isActive: true
        })
        .sort({ relevanceScore: -1, viewCount: -1 })
        .limit(maxResults);
        
        if (cachedVideos && cachedVideos.length > 0) {
          console.log(`[CACHE] ✅ ${cachedVideos.length} CACHED VIDEO(S) FOUND for ${productName} (NO API CALL)`);
          return cachedVideos;
        }
      }
      
      // ONLY if not cached: Make YouTube API call
      console.log(`[API] 🎬 NO CACHE - Making YouTube API call for: ${productName}`);
      
      const searchQueries = [
        `${productName} review`,
        `${productName} unboxing`,
        `best ${productName}`,
        `top ${productName} 2024`,
      ];
      
      let youtubeResults = [];
      for (const query of searchQueries.slice(0, 1)) {
          const apiVideos = await this.searchYouTubeAPI(query, maxResults + 2);
          youtubeResults.push(...apiVideos);
      }
      youtubeResults = this.removeDuplicateVideos(youtubeResults);

      if (youtubeResults && youtubeResults.length > 0) {
        const detailedVideos = await this.getVideoDetails(youtubeResults.slice(0, maxResults + 2));
        const savedVideos = [];
        
        for (let i = 0; i < Math.min(detailedVideos.length, maxResults); i++) {
          const videoData = detailedVideos[i];
          
          try {
            const existing = await Video.findOne({ 'youtube.videoId': videoData.videoId });
            if (existing) {
              console.log(`[CACHE] ℹ️ Video already exists in DB (ID: ${videoData.videoId}): ${videoData.title.substring(0,30)}...`);
              if (productId && (!existing.relatedProducts || !existing.relatedProducts.includes(productId))) {
                existing.relatedProducts = existing.relatedProducts || [];
                existing.relatedProducts.push(productId);
                existing.relatedProductName = existing.relatedProductName || productName;
                existing.productCategory = existing.productCategory || category;
                await existing.save();
                console.log(`[CACHE] 🔗 Linked existing video to product ID: ${productId}`);
              }
              savedVideos.push(existing);
              continue;
            }
            
            // SAVE TO DATABASE CACHE
const newVideo = new Video({
  title: videoData.title,
  description: videoData.description || `${productName} video review or unboxing.`,
  videoUrl: videoData.embedUrl,
  thumbnailUrl: videoData.thumbnailUrl,
  isPublished: true, 
  views: 0,
  
  // ADD THESE REQUIRED FIELDS AT THE TOP LEVEL:
  videoId: videoData.videoId,
  watchUrl: videoData.watchUrl,
  embedUrl: videoData.embedUrl,
  
  youtube: {
    videoId: videoData.videoId,
    channelTitle: videoData.channelTitle,
    channelId: videoData.channelId,
    publishedAt: new Date(videoData.publishedAt),
    viewCount: videoData.viewCount || 0,
    likeCount: videoData.likeCount || 0,
    commentCount: videoData.commentCount || 0,
    duration: videoData.duration,
    watchUrl: videoData.watchUrl,
  },
              
              relatedProducts: productId ? [productId] : [],
              relatedProductName: productName,
              category: category || 'product-video',
              tags: ['automated', 'product-video', productName.split(' ')[0]],
              
              source: 'youtube_automation_cache',
              automation: {
                isAutomated: true,
                lastSyncAt: new Date(),
                relevanceScore: videoData.relevanceScore || 0,
              },

              // CACHE FLAGS
              apiCallMade: true,
              lastFetched: new Date(),
              isActive: true
            });
            
            await newVideo.save();
            console.log(`[CACHE] 💾 VIDEO CACHED: ${newVideo.title.substring(0,30)}...`);
            savedVideos.push(newVideo);
            
          } catch (saveError) {
            console.error(`[CACHE] ❌ Error saving video to cache: ${videoData.title.substring(0,30)}...`, saveError.message);
          }
        }
        return savedVideos;
      }
      
      console.log(`[API] ℹ️ No videos found via API for: ${productName}`);
      return [];
      
    } catch (error) {
      console.error(`[CACHE] ❌ Error in getOrCacheVideo for ${productName}:`, error.message);
      return [];
    }
  }

  async searchYouTubeAPI(query, maxResults = 5) {
    if (!this.apiKey) {
      console.error('❌ YouTube API key not found. Cannot perform search.');
      return [];
    }
    if (this.quotaUsed + 100 > this.dailyLimit) {
      console.warn('⚠️ YouTube API daily quota likely exceeded. Aborting search.');
      return [];
    }

    try {
      console.log(`[API] 🌐 Calling YouTube Search API for query: "${query}", maxResults: ${maxResults}`);
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          key: this.apiKey,
          q: query,
          type: 'video',
          part: 'snippet',
          maxResults: maxResults,
          order: 'relevance',
          safeSearch: 'moderate',
          videoDefinition: 'any',
          videoDuration: 'any'
        }
      });

      this.quotaUsed += 100;
      console.log(`[API] 📊 YouTube quota used: ${this.quotaUsed}/${this.dailyLimit}`);

      if (!response.data || !response.data.items) {
        console.warn(`[API] No items found in YouTube API response for query: "${query}"`);
        return [];
      }

      return response.data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt
      }));

    } catch (error) {
      console.error(`[API] ❌ YouTube API search error for query "${query}":`, error.response?.data?.error?.message || error.message);
      if (error.response?.data?.error?.errors[0]?.reason === 'quotaExceeded') {
        this.quotaUsed = this.dailyLimit;
        console.error("[API] DAILY QUOTA EXCEEDED for YouTube API.");
      }
      return [];
    }
  }

  async getVideoDetails(videos) {
    if (!this.apiKey) {
      console.error('❌ YouTube API key not found. Cannot get video details.');
      return videos;
    }
    if (videos.length === 0) return [];

    const videoIds = videos.map(v => v.videoId).join(',');
    const costPerVideo = 1;
    
    if (this.quotaUsed + (videos.length * costPerVideo) > this.dailyLimit) {
      console.warn('⚠️ YouTube API daily quota likely exceeded. Aborting getVideoDetails.');
      return videos.map(v => ({ 
        ...v, 
        embedUrl: `https://www.youtube.com/embed/${v.videoId}`, 
        watchUrl: `https://www.youtube.com/watch?v=${v.videoId}`, 
        duration: 'N/A', 
        viewCount:0, 
        likeCount:0, 
        commentCount:0, 
        relevanceScore:0 
      }));
    }
    
    try {
      console.log(`[API] 📋 Calling YouTube Videos API for details of ${videos.length} video(s).`);
      const response = await axios.get(`${this.baseUrl}/videos`, {
        params: {
          key: this.apiKey,
          id: videoIds,
          part: 'snippet,statistics,contentDetails'
        }
      });

      this.quotaUsed += (response.data.items.length * costPerVideo); 
      console.log(`[API] 📊 YouTube quota used: ${this.quotaUsed}/${this.dailyLimit}`);
      
      return response.data.items.map(item => {
        const basicInfo = videos.find(v => v.videoId === item.id) || {};
        
        return {
          videoId: item.id,
          title: item.snippet.title || basicInfo.title,
          description: item.snippet.description || basicInfo.description,
          thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || basicInfo.thumbnailUrl,
          channelTitle: item.snippet.channelTitle || basicInfo.channelTitle,
          channelId: item.snippet.channelId || basicInfo.channelId,
          publishedAt: item.snippet.publishedAt || basicInfo.publishedAt,
          viewCount: parseInt(item.statistics?.viewCount || 0),
          likeCount: parseInt(item.statistics?.likeCount || 0),
          commentCount: parseInt(item.statistics?.commentCount || 0),
          duration: this.parseDuration(item.contentDetails?.duration),
          embedUrl: `https://www.youtube.com/embed/${item.id}`,
          watchUrl: `https://www.youtube.com/watch?v=${item.id}`,
          relevanceScore: this.calculateRelevanceScore(item, basicInfo.title)
        };
      });

    } catch (error) {
      console.error('[API] ❌ YouTube video details error:', error.response?.data?.error?.message || error.message);
      if (error.response?.data?.error?.errors[0]?.reason === 'quotaExceeded') {
        this.quotaUsed = this.dailyLimit;
        console.error("[API] DAILY QUOTA EXCEEDED for YouTube API.");
      }
      return videos.map(v => ({ 
        ...v, 
        embedUrl: `https://www.youtube.com/embed/${v.videoId}`, 
        watchUrl: `https://www.youtube.com/watch?v=${v.videoId}`, 
        duration: 'N/A', 
        viewCount:0, 
        likeCount:0, 
        commentCount:0, 
        relevanceScore:0 
      }));
    }
  }

  // GET CACHED VIDEOS FOR FRONTEND (NO API CALLS) - FIXED MAPPING
  async getCachedVideos(limit = 10, category = null) {
    try {
      let query = {
        $or: [
          { 'youtube.videoId': { $ne: null } },
          { 'videoId': { $ne: null } }
        ]
      };
      if (category) {
        query.category = category;
      }

      const videos = await Video.find(query)
      .sort({ 
        createdAt: -1,  // Newest first!
        'automation.relevanceScore': -1,
        'youtube.viewCount': -1
      })
      .limit(limit)
      .lean();
      
      console.log(`[FRONTEND] 📺 SERVING ${videos.length} CACHED VIDEOS (0 API CALLS) ${category ? 'for category ' + category : ''}`);
      
      return videos.map(v => ({
        videoId: v.youtube?.videoId || v.videoId,
        title: v.title,
        description: v.description,
        thumbnailUrl: v.thumbnailUrl,
        channelTitle: v.youtube?.channelTitle || 'Unknown',
        channelId: v.youtube?.channelId || '',
        publishedAt: v.youtube?.publishedAt || v.createdAt,
        viewCount: v.youtube?.viewCount || 0,
        likeCount: v.youtube?.likeCount || 0,
        commentCount: v.youtube?.commentCount || 0,
        duration: v.youtube?.duration || '0:00',
        embedUrl: v.videoUrl,
        watchUrl: v.youtube?.watchUrl || '',
        relevanceScore: v.automation?.relevanceScore || 0,
      }));
      
    } catch (error) {
      console.error('[FRONTEND] ❌ Error fetching cached videos:', error.message);
      return [];
    }
  }

  removeDuplicateVideos(videos) {
    const seen = new Set();
    return videos.filter(video => {
      if (!video.videoId || seen.has(video.videoId)) {
        return false;
      }
      seen.add(video.videoId);
      return true;
    });
  }

  parseDuration(duration) {
    if (!duration || typeof duration !== 'string') return '0:00';
    
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:00';
    
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  calculateRelevanceScore(videoItem, originalQuery = "") {
    const stats = videoItem.statistics;
    const snippet = videoItem.snippet;

    const views = parseInt(stats?.viewCount || 0);
    const likes = parseInt(stats?.likeCount || 0);
    const comments = parseInt(stats?.commentCount || 0);
    
    let score = 0;

    score += Math.log10(views + 1) * 10;

    const likeToViewRatio = views > 0 ? (likes / views) * 100 : 0;
    const commentToViewRatio = views > 0 ? (comments / views) * 100 : 0;
    score += Math.min(likeToViewRatio * 5, 50);
    score += Math.min(commentToViewRatio * 10, 50);

    score += this.getRecencyScore(snippet?.publishedAt);

    const title = snippet?.title?.toLowerCase() || "";
    const description = snippet?.description?.toLowerCase() || "";
    const queryTerms = originalQuery.toLowerCase().split(" ").filter(term => term.length > 2);
    let keywordMatches = 0;
    queryTerms.forEach(term => {
        if (title.includes(term)) keywordMatches++;
        if (description.includes(term)) keywordMatches++;
    });
    score += keywordMatches * 5;

    const durationStr = videoItem.contentDetails?.duration;
    if (durationStr) {
        const totalSeconds = this.durationToSeconds(durationStr);
        if (totalSeconds < 60 || totalSeconds > 3600) {
            score -= 20;
        } else if (totalSeconds > 120 && totalSeconds < 1200) {
            score += 10;
        }
    }
    
    return Math.max(0, Math.round(score));
  }

  durationToSeconds(duration) {
    if (!duration || typeof duration !== 'string') return 0;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  getRecencyScore(publishedAt) {
    if (!publishedAt) return 0;
    const now = new Date();
    const published = new Date(publishedAt);
    const daysDiff = (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 7) return 50;
    if (daysDiff < 30) return 40;
    if (daysDiff < 90) return 30;
    if (daysDiff < 180) return 20;
    if (daysDiff < 365) return 10;
    return 0;
  }

  async searchTrendingVideos(categories = ['technology reviews', 'gadget unboxing', 'viral tech'], maxResultsPerCategory = 3, totalMaxResults = 9) {
    try {
      const allVideosRaw = [];
      
      for (const categoryQuery of categories) {
        const videos = await this.searchYouTubeAPI(categoryQuery, maxResultsPerCategory);
        allVideosRaw.push(...videos);
      }
      
      const uniqueVideos = this.removeDuplicateVideos(allVideosRaw);
      const detailedVideos = await this.getVideoDetails(uniqueVideos.slice(0, totalMaxResults + 5)); 
      
      return detailedVideos
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, totalMaxResults);
      
    } catch (error) {
      console.error('❌ Trending videos search error:', error.message);
      return [];
    }
  }

  async getChannelInfo(channelId) {
    if (!this.apiKey) return null;
    if (this.quotaUsed + 1 > this.dailyLimit) {
      console.warn('⚠️ YouTube API daily quota likely exceeded. Aborting getChannelInfo.');
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/channels`, {
        params: {
          key: this.apiKey,
          id: channelId,
          part: 'snippet,statistics'
        }
      });

      this.quotaUsed += 1;
      console.log(`[API] 📊 YouTube quota used: ${this.quotaUsed}/${this.dailyLimit}`);
      
      if (response.data.items.length === 0) return null;
      
      const channel = response.data.items[0];
      return {
        channelId: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnailUrl: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
        subscriberCount: parseInt(channel.statistics.subscriberCount || 0),
        videoCount: parseInt(channel.statistics.videoCount || 0),
        viewCount: parseInt(channel.statistics.viewCount || 0)
      };

    } catch (error) {
      console.error('❌ Channel info error:', error.message);
      return null;
    }
  }

  getQuotaStatus() {
    return {
      used: this.quotaUsed,
      remaining: this.dailyLimit - this.quotaUsed,
      limit: this.dailyLimit,
      percentage: ((this.quotaUsed / this.dailyLimit) * 100).toFixed(1)
    };
  }

  resetQuotaUsage() {
    console.log("🔄 Resetting YouTube API quota usage for the day.");
    this.quotaUsed = 0;
  }

  async testConnection() {
    if (!this.apiKey) {
        console.error('❌ YouTube API key not configured. Connection test failed.');
        return false;
    }
    try {
      const response = await axios.get(`${this.baseUrl}/videos`, {
        params: {
          key: this.apiKey,
          id: 'dQw4w9WgXcQ',
          part: 'id'
        }
      });
      
      this.quotaUsed +=1;
      if (response.data && response.data.items && response.data.items.length > 0) {
        console.log('✅ YouTube API connection successful.');
        return true;
      } else {
        console.warn('⚠️ YouTube API connection test returned no items, but no error. Check API key and permissions.');
        return false;
      }
      
    } catch (error) {
      console.error('❌ YouTube API connection failed:', error.response?.data?.error?.message || error.message);
      return false;
    }
  }
}

// STANDALONE FUNCTIONS FOR EXTERNAL USE
async function getOrCacheVideo(productName, productId, category = '') {
  const scraper = new YouTubeVideoScraper();
  return await scraper.getOrCacheVideo(productName, productId, category);
}

async function getCachedVideos(limit = 10) {
  const scraper = new YouTubeVideoScraper();
  return await scraper.getCachedVideos(limit, null);
}

module.exports = YouTubeVideoScraper;
module.exports.getOrCacheVideo = getOrCacheVideo;
module.exports.getCachedVideos = getCachedVideos;