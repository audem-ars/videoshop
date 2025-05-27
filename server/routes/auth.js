// This is a simplified route file to get you started
// server/routes/auth.js
const express = require('express');
const router = express.Router();

// @route   GET api/auth/test
// @desc    Test route
// @access  Public
router.get('/test', (req, res) => {
  res.json({ msg: 'Auth route works' });
});

module.exports = router;