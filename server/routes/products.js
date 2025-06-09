// server/routes/products.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// @route   POST api/products
// @desc    Create a new product
// @access  Private/Admin
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ msg: 'Product image is required' });
    }

    const { name, description, price, category } = req.body;
    
    if (!name || !description || !price || !category) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    // Handle image file
    const imageFile = req.files.image;
    const imageExtension = path.extname(imageFile.name);
    const imageFileName = `${Date.now()}${imageExtension}`;
    const imagePath = `${__dirname}/../../public/uploads/products/${imageFileName}`;
    
    // Create directory if it doesn't exist
    const imageDir = path.dirname(imagePath);
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    // Move file to the upload directory
    await imageFile.mv(imagePath);

    // Create new product
    const product = new Product({
      name,
      description,
      price,
      category,
      imageUrl: `/uploads/products/${imageFileName}`,
      isPromoted: req.body.isPromoted === 'true'
    });

    await product.save();
    res.json(product);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/products
// @desc    Get all products with full data including images and variants
// @access  Public
router.get('/', async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ isPromoted: -1, createdAt: -1 });
    
    // Transform to include all needed fields for frontend
    const transformedProducts = products.map(product => ({
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      price: product.price,
      supplierPrice: product.pricing?.supplierPrice || 0,
      profit: product.pricing?.markupAmount || 0,
      category: product.category,
      subreddit: product.redditSource?.subreddit || 'general',
      trendingScore: product.analytics?.trendingScore || 0,
      createdAt: product.createdAt,
      realProduct: product.source === 'reddit_automation',
      imageUrl: product.imageUrl,
      
      // FULL IMAGES ARRAY - This was missing!
      images: product.images && Array.isArray(product.images) ? product.images : [product.imageUrl],
      
      // PRODUCT VARIANTS - This was missing!
      variants: product.variants && Array.isArray(product.variants) ? product.variants : [],
      
      // SPECIFICATIONS
      specifications: product.specifications || {},
      
      // SUPPLIER INFO
      supplier: product.supplier?.platform || (product.source === 'reddit_automation' ? 'automated' : 'manual'),
      supplierData: product.supplier || {},
      
      // ADDITIONAL FRONTEND DATA
      inStock: product.inStock !== false,
      hasVariants: product.variants && Array.isArray(product.variants) && product.variants.length > 0,
      isPromoted: product.isPromoted || false,
      
      // KEEP LEGACY FIELD FOR COMPATIBILITY
      amazonProductId: product.supplier?.productId || product.inventory?.sku
    }));
      
    res.json(transformedProducts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/products/automation
// @desc    Get automation products specifically with full data
// @access  Public
router.get('/automation', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    
    const products = await Product.find({
      source: 'reddit_automation',
      status: 'active'
    })
    .sort({ 'analytics.trendingScore': -1, createdAt: -1 })
    .limit(limit);

    // Transform products to include all needed fields
    const transformedProducts = products.map(product => ({
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      price: product.price,
      supplierPrice: product.pricing?.supplierPrice || 0,
      profit: product.pricing?.markupAmount || 0,
      category: product.category,
      subreddit: product.redditSource?.subreddit || 'unknown',
      trendingScore: product.analytics?.trendingScore || 0,
      createdAt: product.createdAt,
      realProduct: true,
      imageUrl: product.imageUrl,
      
      // FULL IMAGES ARRAY - Fixed!
      images: product.images && Array.isArray(product.images) ? product.images : [product.imageUrl],
      
      // PRODUCT VARIANTS - Fixed!
      variants: product.variants && Array.isArray(product.variants) ? product.variants : [],
      
      // SPECIFICATIONS
      specifications: product.specifications || {},
      
      // SUPPLIER INFO
      supplier: product.supplier?.platform || 'unknown',
      supplierData: product.supplier || {},
      
      // ADDITIONAL DATA
      inStock: product.inStock !== false,
      hasVariants: product.variants && Array.isArray(product.variants) && product.variants.length > 0,
      
      // COMPATIBILITY
      amazonProductId: product.supplier?.productId || product.inventory?.sku
    }));

    res.json({
      success: true,
      products: transformedProducts,
      count: transformedProducts.length
    });
    
  } catch (err) {
    console.error('Automation products error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Server error',
      products: []
    });
  }
});

// @route   GET api/products/featured
// @desc    Get featured products
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    // First get promoted products
    const promotedProducts = await Product.find({ inStock: true, isPromoted: true })
      .sort({ createdAt: -1 })
      .limit(4);
    
    // If we need more products to make up 4 total
    let regularProducts = [];
    if (promotedProducts.length < 4) {
      regularProducts = await Product.find({ 
        inStock: true, 
        isPromoted: false,
        _id: { $nin: promotedProducts.map(p => p._id) }
      })
        .sort({ 'ratings.1': -1, createdAt: -1 })
        .limit(4 - promotedProducts.length);
    }
    
    const allProducts = [...promotedProducts, ...regularProducts];
    
    // Transform with full data
    const transformedProducts = allProducts.map(product => ({
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      imageUrl: product.imageUrl,
      images: product.images && Array.isArray(product.images) ? product.images : [product.imageUrl],
      variants: product.variants && Array.isArray(product.variants) ? product.variants : [],
      inStock: product.inStock,
      isPromoted: product.isPromoted,
      hasVariants: product.variants && Array.isArray(product.variants) && product.variants.length > 0,
      supplier: product.supplier?.platform || 'manual'
    }));
      
    res.json(transformedProducts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/products/:id
// @desc    Get product by ID with full data
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('ratings.user', ['name', 'profileImage']);
      
    if (!product) {
      return res.status(404).json({ msg: 'Product not found' });
    }
    
    // Transform with full data
    const transformedProduct = {
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      price: product.price,
      supplierPrice: product.pricing?.supplierPrice || 0,
      category: product.category,
      imageUrl: product.imageUrl,
      
      // FULL DATA
      images: product.images && Array.isArray(product.images) ? product.images : [product.imageUrl],
      variants: product.variants && Array.isArray(product.variants) ? product.variants : [],
      specifications: product.specifications || {},
      
      // OTHER DATA
      inStock: product.inStock,
      isPromoted: product.isPromoted,
      ratings: product.ratings,
      averageRating: product.averageRating,
      hasVariants: product.variants && Array.isArray(product.variants) && product.variants.length > 0,
      supplier: product.supplier?.platform || 'manual',
      supplierData: product.supplier || {},
      
      // REDDIT DATA IF AVAILABLE
      subreddit: product.redditSource?.subreddit,
      trendingScore: product.analytics?.trendingScore || 0,
      realProduct: product.source === 'reddit_automation'
    };
    
    res.json(transformedProduct);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Product not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   POST api/products/:id/rate
// @desc    Rate a product
// @access  Private
router.post('/:id/rate', authMiddleware, async (req, res) => {
  try {
    const { value, review } = req.body;
    
    if (!value || value < 1 || value > 5) {
      return res.status(400).json({ msg: 'Rating value must be between 1 and 5' });
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ msg: 'Product not found' });
    }
    
    // Check if user has already rated this product
    const existingRatingIndex = product.ratings.findIndex(
      rating => rating.user.toString() === req.user.id
    );
    
    if (existingRatingIndex !== -1) {
      // Update existing rating
      product.ratings[existingRatingIndex].value = value;
      if (review) {
        product.ratings[existingRatingIndex].review = review;
      }
    } else {
      // Add new rating
      const newRating = {
        user: req.user.id,
        value,
        review: review || ''
      };
      
      product.ratings.unshift(newRating);
    }
    
    await product.save();
    res.json(product.ratings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/products/:id
// @desc    Update a product
// @access  Private/Admin
router.put('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ msg: 'Product not found' });
    }
    
    const { name, description, price, category, inStock, isPromoted } = req.body;
    
    // Update fields if provided
    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = price;
    if (category) product.category = category;
    if (inStock !== undefined) product.inStock = inStock;
    if (isPromoted !== undefined) product.isPromoted = isPromoted;
    
    // Update image if provided
    if (req.files && req.files.image) {
      const imageFile = req.files.image;
      const imageExtension = path.extname(imageFile.name);
      const imageFileName = `${Date.now()}${imageExtension}`;
      const imagePath = `${__dirname}/../../public/uploads/products/${imageFileName}`;
      
      // Move file to the upload directory
      await imageFile.mv(imagePath);
      
      // Update image URL
      product.imageUrl = `/uploads/products/${imageFileName}`;
    }
    
    await product.save();
    res.json(product);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE api/products/:id
// @desc    Delete a product
// @access  Private/Admin
router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ msg: 'Product not found' });
    }
    
    await product.remove();
    res.json({ msg: 'Product removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Product not found' });
    }
    res.status(500).send('Server error');
  }
});

module.exports = router;