
// server/routes/videos.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// @route   POST api/videos
// @desc    Upload a video
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (!req.files || !req.files.video || !req.files.thumbnail) {
      return res.status(400).json({ msg: 'Video and thumbnail files are required' });
    }

    const { title, description } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ msg: 'Title and description are required' });
    }

    // Handle video file
    const videoFile = req.files.video;
    const videoExtension = path.extname(videoFile.name);
    const videoFileName = `${req.user.id}-${Date.now()}${videoExtension}`;
    const videoPath = `${__dirname}/../../public/uploads/videos/${videoFileName}`;
    
    // Handle thumbnail file
    const thumbnailFile = req.files.thumbnail;
    const thumbnailExtension = path.extname(thumbnailFile.name);
    const thumbnailFileName = `${req.user.id}-${Date.now()}${thumbnailExtension}`;
    const thumbnailPath = `${__dirname}/../../public/uploads/thumbnails/${thumbnailFileName}`;
    
    // Create directories if they don't exist
    const videoDir = path.dirname(videoPath);
    const thumbnailDir = path.dirname(thumbnailPath);
    
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }
    
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    // Move files to the upload directory
    await videoFile.mv(videoPath);
    await thumbnailFile.mv(thumbnailPath);

    // Create new video
    const video = new Video({
      user: req.user.id,
      title,
      description,
      videoUrl: `/uploads/videos/${videoFileName}`,
      thumbnailUrl: `/uploads/thumbnails/${thumbnailFileName}`
    });

    await video.save();
    res.json(video);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/videos
// @desc    Get all videos
// @access  Public
router.get('/', async (req, res) => {
  try {
    const videos = await Video.find({ isPublished: true })
      .sort({ createdAt: -1 })
      .populate('user', ['name', 'profileImage']);
      
    res.json(videos);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/videos/featured
// @desc    Get featured videos (promoted videos first)
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    // First get promoted videos
    const promotedVideos = await Video.find({ isPublished: true, isPromoted: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', ['name', 'profileImage']);
    
    // Then get regular videos
    const regularVideos = await Video.find({ 
      isPublished: true, 
      isPromoted: false,
      _id: { $nin: promotedVideos.map(v => v._id) }
    })
      .sort({ views: -1, createdAt: -1 })
      .limit(10)
      .populate('user', ['name', 'profileImage']);
      
    res.json([...promotedVideos, ...regularVideos]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/videos/:id
// @desc    Get video by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('user', ['name', 'profileImage'])
      .populate('comments.user', ['name', 'profileImage']);
      
    if (!video) {
      return res.status(404).json({ msg: 'Video not found' });
    }
    
    // Increment view count
    video.views += 1;
    await video.save();
    
    res.json(video);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Video not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   PUT api/videos/:id
// @desc    Update video
// @access  Private
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ msg: 'Video not found' });
    }
    
    // Check video ownership
    if (video.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }
    
    const { title, description, isPublished } = req.body;
    
    // Update fields
    if (title) video.title = title;
    if (description) video.description = description;
    if (isPublished !== undefined) video.isPublished = isPublished;
    
    await video.save();
    res.json(video);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/videos/:id/comment
// @desc    Add comment to video
// @access  Private
router.post('/:id/comment', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ msg: 'Video not found' });
    }
    
    const newComment = {
      user: req.user.id,
      text: req.body.text,
      name: user.name
    };
    
    video.comments.unshift(newComment);
    await video.save();
    
    res.json(video.comments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/videos/:id/like
// @desc    Like a video
// @access  Private
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ msg: 'Video not found' });
    }
    
    // Check if video has already been liked by this user
    if (video.likes.some(like => like.toString() === req.user.id)) {
      return res.status(400).json({ msg: 'Video already liked' });
    }
    
    // Remove from dislikes if needed
    if (video.dislikes.some(dislike => dislike.toString() === req.user.id)) {
      video.dislikes = video.dislikes.filter(
        dislike => dislike.toString() !== req.user.id
      );
    }
    
    // Add to likes
    video.likes.unshift(req.user.id);
    await video.save();
    
    res.json({ likes: video.likes, dislikes: video.dislikes });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;