// server/index.js - Complete server with your .env configuration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const mongoose = require('mongoose');

// Import models
const Video = require('./models/Video');
const Product = require('./models/Product');
const User = require('./models/User');

// Import automation routes
const automationRoutes = require('./routes/automation');

// Initialize express
const app = express();
const PORT = process.env.PORT || 5000;

// Database connection - Uses your MONGO_URI from .env
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/videoshop', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected to:', process.env.MONGO_URI || 'mongodb://localhost:27017/videoshop'))
.catch(err => console.log('❌ MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  createParentPath: true,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max file size
}));

// Create upload directories
const publicDir = path.join(__dirname, '../public');
const cssDir = path.join(publicDir, 'css');
const jsDir = path.join(publicDir, 'js');
const uploadsDir = path.join(publicDir, 'uploads');
const videosDir = path.join(uploadsDir, 'videos');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
const productsDir = path.join(uploadsDir, 'products');

// Create directories if they don't exist
[publicDir, cssDir, jsDir, uploadsDir, videosDir, thumbnailsDir, productsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Create directories if they don't exist
[publicDir, cssDir, jsDir, uploadsDir, videosDir, thumbnailsDir, productsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Automation routes
app.use('/api/automation', automationRoutes);

// Helper function to generate unique filename
function generateUniqueFilename(originalName) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const ext = path.extname(originalName);
  return `${timestamp}_${random}${ext}`;
}

// VIDEO UPLOAD ENDPOINT
app.post('/api/videos/upload', async (req, res) => {
  try {
    console.log('📹 Video upload request received');
    console.log('Body:', req.body);
    console.log('Files:', req.files ? Object.keys(req.files) : 'No files');

    if (!req.files || !req.files.videoFile || !req.files.thumbnailFile) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video file and thumbnail are required' 
      });
    }

    const { title, description, publish } = req.body;
    const videoFile = req.files.videoFile;
    const thumbnailFile = req.files.thumbnailFile;

    // Validate file types
    const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

    if (!allowedVideoTypes.includes(videoFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video format. Please upload MP4, AVI, MOV, or WMV files.'
      });
    }

    if (!allowedImageTypes.includes(thumbnailFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid thumbnail format. Please upload JPEG, PNG, or GIF files.'
      });
    }

    // Generate unique filenames
    const videoFilename = generateUniqueFilename(videoFile.name);
    const thumbnailFilename = generateUniqueFilename(thumbnailFile.name);

    // File paths
    const videoPath = path.join(videosDir, videoFilename);
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);

    // Move files
    await videoFile.mv(videoPath);
    await thumbnailFile.mv(thumbnailPath);

    // Create database entry (temporary user ID until auth is implemented)
    const newVideo = new Video({
      user: new mongoose.Types.ObjectId(), // Temporary
      title: title || 'Untitled Video',
      description: description || 'No description provided',
      videoUrl: `/uploads/videos/${videoFilename}`,
      thumbnailUrl: `/uploads/thumbnails/${thumbnailFilename}`,
      isPublished: publish === 'true' || publish === true,
      views: 0
    });

    const savedVideo = await newVideo.save();

    console.log('✅ Video uploaded successfully:', savedVideo._id);

    res.json({
      success: true,
      message: 'Video uploaded successfully!',
      video: {
        id: savedVideo._id,
        title: savedVideo.title,
        description: savedVideo.description,
        videoUrl: savedVideo.videoUrl,
        thumbnailUrl: savedVideo.thumbnailUrl,
        isPublished: savedVideo.isPublished
      }
    });

  } catch (error) {
    console.error('❌ Video upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during video upload',
      error: error.message
    });
  }
});

// PRODUCT UPLOAD ENDPOINT
app.post('/api/products/upload', async (req, res) => {
  try {
    console.log('🛍️ Product upload request received');
    console.log('Body:', req.body);
    console.log('Files:', req.files ? Object.keys(req.files) : 'No files');

    if (!req.files || !req.files.productImage) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product image is required' 
      });
    }

    const { name, description, price, category, inStock } = req.body;
    const productImage = req.files.productImage;

    // Validate image type
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedImageTypes.includes(productImage.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image format. Please upload JPEG, PNG, or GIF files.'
      });
    }

    // Validate required fields
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, price, and category are required'
      });
    }

    // Generate unique filename
    const imageFilename = generateUniqueFilename(productImage.name);
    const imagePath = path.join(productsDir, imageFilename);

    // Move image file
    await productImage.mv(imagePath);

    // Create database entry
    const newProduct = new Product({
      name: name,
      description: description,
      price: parseFloat(price),
      imageUrl: `/uploads/products/${imageFilename}`,
      category: category,
      inStock: inStock !== 'false'
    });

    const savedProduct = await newProduct.save();

    console.log('✅ Product uploaded successfully:', savedProduct._id);

    res.json({
      success: true,
      message: 'Product uploaded successfully!',
      product: {
        id: savedProduct._id,
        name: savedProduct.name,
        description: savedProduct.description,
        price: savedProduct.price,
        imageUrl: savedProduct.imageUrl,
        category: savedProduct.category,
        inStock: savedProduct.inStock
      }
    });

  } catch (error) {
    console.error('❌ Product upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during product upload',
      error: error.message
    });
  }
});

// GET VIDEOS ENDPOINT
app.get('/api/videos', async (req, res) => {
  try {
    const videos = await Video.find({ isPublished: true })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({
      success: true,
      videos: videos
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching videos'
    });
  }
});

// GET PRODUCTS ENDPOINT
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({ inStock: true })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({
      success: true,
      products: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products'
    });
  }
});

// Test routes
app.get('/api/auth/test', (req, res) => {
  res.json({ msg: 'Auth route works', env: process.env.NODE_ENV });
});

app.get('/api/videos/test', (req, res) => {
  res.json({ msg: 'Videos route works', mongodb: 'Connected' });
});

app.get('/api/products/test', (req, res) => {
  res.json({ msg: 'Products route works' });
});

// Function to generate placeholder pages
function generatePlaceholderPage(title, description) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - VideoShop</title>
  <link rel="stylesheet" href="/css/style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="ambient-background"></div>
  <header>
    <div class="hamburger-menu" id="hamburger-menu">
      <div class="hamburger-line"></div>
      <div class="hamburger-line"></div>
      <div class="hamburger-line"></div>
    </div>
    <a href="/" class="logo">Video<span>Shop</span></a>
    <div class="search-bar">
      <input type="text" placeholder="Search">
      <button>🔍</button>
    </div>
    <div class="user-actions">
      <button id="upload-btn">Upload</button>
      <a href="#" class="sign-in" onclick="openModal('login-modal')">Sign In</a>
    </div>
  </header>
  <div class="container">
    <nav class="sidebar">
      <a href="/" class="sidebar-item ${title === 'Home' ? 'active' : ''}">
        <span class="sidebar-icon">🏠</span>
        <span class="sidebar-text">Home</span>
      </a>
      <a href="/trending" class="sidebar-item ${title === 'Trending' ? 'active' : ''}">
        <span class="sidebar-icon">🔥</span>
        <span class="sidebar-text">Trending</span>
      </a>
      <a href="/subscriptions" class="sidebar-item ${title === 'Subscriptions' ? 'active' : ''}">
        <span class="sidebar-icon">📋</span>
        <span class="sidebar-text">Subscriptions</span>
      </a>
      <a href="/shop" class="sidebar-item ${title === 'Shop' ? 'active' : ''}">
        <span class="sidebar-icon">🛒</span>
        <span class="sidebar-text">Shop</span>
      </a>
      <a href="/library" class="sidebar-item ${title === 'Library' ? 'active' : ''}">
        <span class="sidebar-icon">📚</span>
        <span class="sidebar-text">Library</span>
      </a>
      <a href="/history" class="sidebar-item ${title === 'History' ? 'active' : ''}">
        <span class="sidebar-icon">⏱️</span>
        <span class="sidebar-text">History</span>
      </a>
      <a href="/your-videos" class="sidebar-item ${title === 'Your Videos' ? 'active' : ''}">
        <span class="sidebar-icon">⏯️</span>
        <span class="sidebar-text">Your Videos</span>
      </a>
      <a href="/watch-later" class="sidebar-item ${title === 'Watch Later' ? 'active' : ''}">
        <span class="sidebar-icon">⏰</span>
        <span class="sidebar-text">Watch Later</span>
      </a>
      <a href="/liked-videos" class="sidebar-item ${title === 'Liked Videos' ? 'active' : ''}">
        <span class="sidebar-icon">👍</span>
        <span class="sidebar-text">Liked Videos</span>
      </a>
    </nav>
    <div class="main-content">
      <div style="width: 100%; padding: 40px; background-color: #212121; border-radius: 12px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">
        <h1 style="margin-bottom: 16px;">${title}</h1>
        <p style="font-size: 18px; line-height: 1.6;">${description}</p>
      </div>
    </div>
  </div>
  <div class="sidebar-overlay"></div>
  <script src="/js/main.js"></script>
  <script src="/js/subtle-effect.js"></script>
</body>
</html>`;
}

// Routes for sidebar pages
app.get('/trending', (req, res) => {
  res.send(generatePlaceholderPage('Trending', 'Discover popular videos that are currently getting lots of views and engagement.'));
});

app.get('/subscriptions', (req, res) => {
  res.send(generatePlaceholderPage('Subscriptions', 'Your subscriptions feed shows videos from channels you\'ve subscribed to.'));
});

app.get('/shop', (req, res) => {
  res.send(generatePlaceholderPage('Shop', 'Browse our curated selection of health and wellness products.'));
});

app.get('/library', (req, res) => {
  res.send(generatePlaceholderPage('Library', 'Your personal library stores all your saved videos, playlists, and watch history.'));
});

app.get('/history', (req, res) => {
  res.send(generatePlaceholderPage('History', 'View your watch history here.'));
});

app.get('/your-videos', (req, res) => {
  res.send(generatePlaceholderPage('Your Videos', 'Manage all the videos you\'ve uploaded.'));
});

app.get('/watch-later', (req, res) => {
  res.send(generatePlaceholderPage('Watch Later', 'Your Watch Later playlist.'));
});

app.get('/liked-videos', (req, res) => {
  res.send(generatePlaceholderPage('Liked Videos', 'All the videos you\'ve liked.'));
});

// Serve static assets
app.use(express.static(publicDir));

// Home route
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(generatePlaceholderPage(
      'Home',
      'Welcome to VideoShop! Upload videos, shop for health products, and discover amazing content.'
    ));
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️ Database: ${process.env.MONGO_URI || 'mongodb://localhost:27017/videoshop'}`);
});