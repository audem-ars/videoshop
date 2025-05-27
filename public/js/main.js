// main.js - Complete with Dynamic Glow System and Upload Functionality

document.addEventListener('DOMContentLoaded', function() {
  // Reference elements
  const uploadButton = document.getElementById('upload-btn');
  const videoCards = document.querySelectorAll('.video-card');
  const productCards = document.querySelectorAll('.product-card');
  const actionButtons = document.querySelectorAll('.video-action-btn');
  const featuredVideo = document.querySelector('.featured-video');
  const shopSection = document.querySelector('.shop-section');
  
  // Dynamic glow system
  class DynamicGlowSystem {
    constructor() {
      this.glowElements = [];
      this.observers = [];
      this.init();
    }
    
    init() {
      // Add glow containers to all major panels
      this.addGlowToElement(featuredVideo, 'featured-glow');
      this.addGlowToElement(shopSection, 'shop-glow');
      
      // Add glow to cream-colored buttons in header
      const uploadBtn = document.getElementById('upload-btn');
      const signInBtn = document.querySelector('.sign-in');
      if (uploadBtn) this.addGlowToElement(uploadBtn, 'upload-glow');
      if (signInBtn) this.addGlowToElement(signInBtn, 'signin-glow');
      
      videoCards.forEach((card, index) => {
        this.addGlowToElement(card, `video-glow-${index}`);
      });
      
      productCards.forEach((card, index) => {
        this.addGlowToElement(card, `product-glow-${index}`);
      });
      
      // Start analyzing content brightness
      this.analyzeContentBrightness();
      
      // Set up mutation observer for dynamic content
      this.setupContentObserver();
    }
    
    addGlowToElement(element, glowId) {
      if (!element) return;
      
      // Create glow container
      const glowContainer = document.createElement('div');
      glowContainer.className = 'dynamic-glow-container';
      glowContainer.id = glowId;
      
      // Position relative to element
      element.style.position = 'relative';
      element.style.zIndex = '2';
      
      // Insert glow behind element
      element.parentNode.insertBefore(glowContainer, element);
      
      // Position glow absolutely to match element
      this.updateGlowPosition(glowContainer, element);
      
      this.glowElements.push({
        element: element,
        glow: glowContainer,
        id: glowId
      });
    }
    
    updateGlowPosition(glowContainer, element) {
      const rect = element.getBoundingClientRect();
      
      glowContainer.style.cssText = `
        position: absolute;
        top: ${element.offsetTop}px;
        left: ${element.offsetLeft}px;
        width: ${element.offsetWidth}px;
        height: ${element.offsetHeight}px;
        pointer-events: none;
        z-index: 1;
        border-radius: inherit;
        transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
      `;
    }
    
    analyzeContentBrightness() {
      this.glowElements.forEach(glowData => {
        const brightness = this.calculateElementBrightness(glowData.element);
        const corners = this.analyzeCornerBrightness(glowData.element);
        this.applyDynamicGlow(glowData, brightness, corners);
      });
    }
    
    calculateElementBrightness(element) {
      // Analyze text content, background colors, and images
      const styles = window.getComputedStyle(element);
      const bgColor = styles.backgroundColor;
      const textElements = element.querySelectorAll('*');
      
      let totalBrightness = 0;
      let elementCount = 0;
      
      // Analyze background
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
        totalBrightness += this.getColorBrightness(bgColor);
        elementCount++;
      }
      
      // Analyze text colors
      textElements.forEach(el => {
        const color = window.getComputedStyle(el).color;
        if (color) {
          totalBrightness += this.getColorBrightness(color);
          elementCount++;
        }
      });
      
      // Analyze images (if any)
      const images = element.querySelectorAll('img');
      images.forEach(img => {
        if (img.complete) {
          totalBrightness += this.analyzeImageBrightness(img);
          elementCount++;
        }
      });
      
      return elementCount > 0 ? totalBrightness / elementCount : 0.3;
    }
    
    analyzeCornerBrightness(element) {
      const rect = element.getBoundingClientRect();
      const corners = {
        topLeft: 0.3,
        topRight: 0.3,
        bottomLeft: 0.3,
        bottomRight: 0.3
      };
      
      // Analyze corner regions for different brightness levels
      const childElements = element.querySelectorAll('*');
      
      childElements.forEach(child => {
        const childRect = child.getBoundingClientRect();
        const childColor = window.getComputedStyle(child).color;
        const brightness = this.getColorBrightness(childColor);
        
        // Determine which corner this element affects most
        const centerX = childRect.left + childRect.width / 2;
        const centerY = childRect.top + childRect.height / 2;
        
        const elementCenterX = rect.left + rect.width / 2;
        const elementCenterY = rect.top + rect.height / 2;
        
        if (centerX < elementCenterX && centerY < elementCenterY) {
          corners.topLeft = Math.max(corners.topLeft, brightness);
        } else if (centerX >= elementCenterX && centerY < elementCenterY) {
          corners.topRight = Math.max(corners.topRight, brightness);
        } else if (centerX < elementCenterX && centerY >= elementCenterY) {
          corners.bottomLeft = Math.max(corners.bottomLeft, brightness);
        } else {
          corners.bottomRight = Math.max(corners.bottomRight, brightness);
        }
      });
      
      return corners;
    }
    
    getColorBrightness(color) {
      // Convert color to RGB and calculate perceived brightness
      const rgb = this.parseColor(color);
      if (!rgb) return 0.3;
      
      // Using perceived brightness formula
      return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255;
    }
    
    parseColor(color) {
      const div = document.createElement('div');
      div.style.color = color;
      document.body.appendChild(div);
      const computedColor = window.getComputedStyle(div).color;
      document.body.removeChild(div);
      
      const match = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3])
        };
      }
      return null;
    }
    
    analyzeImageBrightness(img) {
      // Create canvas to analyze image brightness
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = 50; // Small sample size for performance
      canvas.height = 50;
      
      try {
        ctx.drawImage(img, 0, 0, 50, 50);
        const imageData = ctx.getImageData(0, 0, 50, 50);
        const data = imageData.data;
        
        let totalBrightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          totalBrightness += (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        }
        
        return totalBrightness / (data.length / 4);
      } catch (e) {
        return 0.3; // Default brightness if can't analyze
      }
    }
    
    applyDynamicGlow(glowData, brightness, corners) {
      const { glow } = glowData;
      const { id } = glowData;
      
      // Create sophisticated glow based on content brightness
      const glowIntensity = Math.max(0.1, Math.min(0.8, brightness));
      let glowSize = 20 + (glowIntensity * 40); // 20px to 60px glow
      
      // Reduce glow for main content panels to prevent blending, but allow recommended videos
      if (id.includes('featured') || id.includes('product-glow')) {
        glowSize = glowSize * 0.4; // Reduce main content glows by 60%
      } else if (id.includes('video-glow')) {
        glowSize = glowSize * 0.7; // Recommended videos get subtle glow (30% reduction)
      }
      
      // Enhanced handling for high-brightness cream panels (header buttons)
      if (brightness > 0.8 && (id.includes('upload') || id.includes('signin'))) {
        const creamGlow = `hsla(38, 40%, 70%, ${Math.min(0.4, brightness * 0.5)})`;
        
        glow.style.background = `
          radial-gradient(circle at center, ${creamGlow} 0%, transparent 80%)
        `;
        
        glow.style.boxShadow = `
          0 0 ${glowSize * 2}px hsla(38, 40%, 70%, ${glowIntensity * 0.5}),
          0 0 ${glowSize * 1.2}px hsla(38, 40%, 70%, ${glowIntensity * 0.3})
        `;
        
        glow.style.border = `1px solid hsla(38, 40%, 70%, ${glowIntensity * 0.2})`;
        glow.style.borderRadius = window.getComputedStyle(glowData.element).borderRadius;
        return;
      }
      
      // Special handling for high-brightness cream panels (general)
      if (brightness > 0.8) {
        const creamGlow = `hsla(35, 30%, 80%, ${Math.min(0.25, brightness * 0.3)})`;
        
        glow.style.background = `
          radial-gradient(circle at center, ${creamGlow} 0%, transparent 70%)
        `;
        
        glow.style.boxShadow = `
          0 0 ${glowSize}px hsla(35, 30%, 80%, ${glowIntensity * 0.3}),
          0 0 ${glowSize * 0.6}px hsla(35, 30%, 80%, ${glowIntensity * 0.15})
        `;
        
        glow.style.border = `1px solid hsla(35, 30%, 80%, ${glowIntensity * 0.1})`;
        glow.style.borderRadius = window.getComputedStyle(glowData.element).borderRadius;
        return;
      }
      
      // Chocolate-based color palette that adapts to brightness
      const baseHue = 25; // Chocolate hue
      const saturation = Math.min(30, glowIntensity * 50);
      const lightness = Math.min(20, glowIntensity * 40);
      
      // Reduce intensity for main content but allow recommended videos to have slight glow
      let finalIntensity = glowIntensity;
      if (id.includes('featured') || id.includes('product-glow')) {
        finalIntensity = glowIntensity * 0.5; // Reduce main content glow intensity
      } else if (id.includes('video-glow')) {
        finalIntensity = glowIntensity * 0.75; // Recommended videos get slight glow (25% reduction)
      }
      
      // Create corner-specific gradients
      const topLeftGlow = this.createCornerGlow(corners.topLeft, baseHue, 'top left');
      const topRightGlow = this.createCornerGlow(corners.topRight, baseHue, 'top right');
      const bottomLeftGlow = this.createCornerGlow(corners.bottomLeft, baseHue, 'bottom left');
      const bottomRightGlow = this.createCornerGlow(corners.bottomRight, baseHue, 'bottom right');
      
      // Apply multi-layered glow
      glow.style.background = `
        radial-gradient(circle at top left, ${topLeftGlow} 0%, transparent 50%),
        radial-gradient(circle at top right, ${topRightGlow} 0%, transparent 50%),
        radial-gradient(circle at bottom left, ${bottomLeftGlow} 0%, transparent 50%),
        radial-gradient(circle at bottom right, ${bottomRightGlow} 0%, transparent 50%)
      `;
      
      // Add subtle box shadow for depth
      glow.style.boxShadow = `
        0 0 ${glowSize}px hsla(${baseHue}, ${saturation}%, ${lightness}%, ${finalIntensity * 0.3}),
        inset 0 0 ${glowSize / 2}px hsla(${baseHue}, ${saturation}%, ${lightness + 10}%, ${finalIntensity * 0.1})
      `;
      
      // Add subtle border glow
      glow.style.border = `1px solid hsla(${baseHue}, ${saturation}%, ${lightness + 20}%, ${finalIntensity * 0.2})`;
      
      glow.style.borderRadius = window.getComputedStyle(glowData.element).borderRadius;
    }
    
    createCornerGlow(brightness, baseHue, corner) {
      const intensity = Math.max(0.05, Math.min(0.6, brightness)); // Increased max for cream panels
      
      // Special handling for high-brightness cream panels
      if (brightness > 0.8) {
        const creamIntensity = Math.min(0.4, brightness * 0.5);
        return `hsla(35, 25%, 85%, ${creamIntensity})`; // Warm cream glow
      }
      
      const saturation = Math.min(25, intensity * 60);
      const lightness = Math.min(15, intensity * 30);
      
      // Slight hue variation based on corner for more dynamic feel
      let hueShift = 0;
      if (corner.includes('right')) hueShift += 5;
      if (corner.includes('bottom')) hueShift += 3;
      
      return `hsla(${baseHue + hueShift}, ${saturation}%, ${lightness}%, ${intensity})`;
    }
    
    setupContentObserver() {
      // Watch for content changes and update glows accordingly
      const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            shouldUpdate = true;
          }
        });
        
        if (shouldUpdate) {
          // Debounce updates
          clearTimeout(this.updateTimeout);
          this.updateTimeout = setTimeout(() => {
            this.analyzeContentBrightness();
          }, 500);
        }
      });
      
      // Observe all glow elements
      this.glowElements.forEach(glowData => {
        observer.observe(glowData.element, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      });
    }
    
    // Method to manually update glow for specific element
    updateElementGlow(element) {
      const glowData = this.glowElements.find(g => g.element === element);
      if (glowData) {
        const brightness = this.calculateElementBrightness(element);
        const corners = this.analyzeCornerBrightness(element);
        this.applyDynamicGlow(glowData, brightness, corners);
      }
    }
  }
  
  // Initialize hamburger menu FIRST before other systems
  initHamburgerMenu();
  
  // Initialize the dynamic glow system
  const glowSystem = new DynamicGlowSystem();
  
  // Upload button functionality
  if (uploadButton) {
    uploadButton.addEventListener('click', function() {
      openModal('upload-modal');
    });
  }
  
  // Enhanced video card interactions
  videoCards.forEach(card => {
    card.addEventListener('click', function() {
      const title = this.querySelector('.video-card-title').textContent;
      console.log(`Video clicked: ${title}`);
      
      // Update glow when card is interacted with
      glowSystem.updateElementGlow(this);
    });
    
    // Add hover effects that work with glow system
    card.addEventListener('mouseenter', function() {
      // Temporarily increase glow intensity on hover
      const glowData = glowSystem.glowElements.find(g => g.element === this);
      if (glowData) {
        glowData.glow.style.transform = 'scale(1.05)';
        glowData.glow.style.opacity = '1.2';
      }
    });
    
    card.addEventListener('mouseleave', function() {
      const glowData = glowSystem.glowElements.find(g => g.element === this);
      if (glowData) {
        glowData.glow.style.transform = 'scale(1)';
        glowData.glow.style.opacity = '1';
      }
    });
  });
  
  // Enhanced product card interactions
  productCards.forEach(card => {
    card.addEventListener('click', function() {
      const name = this.querySelector('.product-name').textContent;
      console.log(`Product clicked: ${name}`);
      
      // Update glow when card is interacted with
      glowSystem.updateElementGlow(this);
    });
    
    // Add hover effects
    card.addEventListener('mouseenter', function() {
      const glowData = glowSystem.glowElements.find(g => g.element === this);
      if (glowData) {
        glowData.glow.style.transform = 'scale(1.03)';
        glowData.glow.style.opacity = '1.1';
      }
    });
    
    card.addEventListener('mouseleave', function() {
      const glowData = glowSystem.glowElements.find(g => g.element === this);
      if (glowData) {
        glowData.glow.style.transform = 'scale(1)';
        glowData.glow.style.opacity = '1';
      }
    });
  });
  
  // Action button functionality
  actionButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      
      const text = this.textContent.trim();
      if (text.includes('Like')) {
        console.log('Liked video');
        // Briefly enhance glow when liked
        glowSystem.updateElementGlow(featuredVideo);
      } else if (text.includes('Dislike')) {
        console.log('Disliked video');
      } else if (text.includes('Share')) {
        console.log('Sharing video');
      } else if (text.includes('Save')) {
        console.log('Saved video');
      }
    });
  });
  
  // Update glows when window resizes
  window.addEventListener('resize', () => {
    glowSystem.glowElements.forEach(glowData => {
      glowSystem.updateGlowPosition(glowData.glow, glowData.element);
    });
  });
  
  // Periodically update glows to catch any missed changes
  setInterval(() => {
    glowSystem.analyzeContentBrightness();
  }, 10000); // Every 10 seconds
  
  // Hamburger Menu Functionality - Enhanced Fix
  function initHamburgerMenu() {
    console.log('🍔 Initializing hamburger menu...');
    
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    
    console.log('Elements found:', {
      hamburger: !!hamburgerMenu,
      sidebar: !!sidebar,
      overlay: !!sidebarOverlay
    });
    
    if (hamburgerMenu && sidebar && sidebarOverlay) {
      // Remove any existing event listeners
      hamburgerMenu.replaceWith(hamburgerMenu.cloneNode(true));
      const newHamburgerMenu = document.getElementById('hamburger-menu');
      
      newHamburgerMenu.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🍔 Hamburger clicked!');
        
        // Toggle classes
        newHamburgerMenu.classList.toggle('active');
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
        
        console.log('Classes toggled:', {
          hamburgerActive: newHamburgerMenu.classList.contains('active'),
          sidebarOpen: sidebar.classList.contains('open'),
          overlayActive: sidebarOverlay.classList.contains('active')
        });
      });
      
      // Close sidebar when clicking overlay
      sidebarOverlay.addEventListener('click', function() {
        console.log('📱 Overlay clicked!');
        newHamburgerMenu.classList.remove('active');
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
      });
      
      // Close sidebar when pressing Escape key
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
          newHamburgerMenu.classList.remove('active');
          sidebar.classList.remove('open');
          sidebarOverlay.classList.remove('active');
        }
      });
      
      console.log('✅ Hamburger menu initialized successfully!');
    } else {
      console.error('❌ Hamburger menu elements not found!');
      
      // Retry after a short delay in case elements aren't ready
      setTimeout(() => {
        console.log('🔄 Retrying hamburger menu initialization...');
        initHamburgerMenu();
      }, 1000);
    }
  }
  
  // Initialize hamburger menu
  initHamburgerMenu();
  
  // UPLOAD FORM HANDLERS
  
  // Video Upload Form Handler
  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitBtn = this.querySelector('.form-submit');
      const originalText = submitBtn.textContent;
      
      try {
        // Show loading state
        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;
        
        // Get form data
        const formData = new FormData();
        formData.append('title', document.getElementById('video-title').value);
        formData.append('description', document.getElementById('video-description').value);
        formData.append('videoFile', document.getElementById('video-file').files[0]);
        formData.append('thumbnailFile', document.getElementById('thumbnail-file').files[0]);
        formData.append('publish', document.getElementById('video-publish').checked);
        
        // Validate files
        if (!document.getElementById('video-file').files[0]) {
          throw new Error('Please select a video file');
        }
        if (!document.getElementById('thumbnail-file').files[0]) {
          throw new Error('Please select a thumbnail image');
        }
        
        console.log('Uploading video...');
        
        // Upload to server
        const response = await fetch('/api/videos/upload', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Success
          alert('Video uploaded successfully!');
          console.log('Upload successful:', result);
          
          // Reset form
          uploadForm.reset();
          
          // Close modal
          closeModal('upload-modal');
          
          // Optionally refresh the page to show new video
          // window.location.reload();
          
        } else {
          throw new Error(result.message || 'Upload failed');
        }
        
      } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
      } finally {
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
  
  // File input validation and preview
  const videoFileInput = document.getElementById('video-file');
  const thumbnailFileInput = document.getElementById('thumbnail-file');
  
  if (videoFileInput) {
    videoFileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        // Validate video file size (100MB limit)
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
          alert('Video file is too large. Maximum size is 100MB.');
          this.value = '';
          return;
        }
        
        // Validate video file type
        const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
        if (!allowedTypes.includes(file.type)) {
          alert('Invalid video format. Please upload MP4, AVI, MOV, or WMV files.');
          this.value = '';
          return;
        }
        
        console.log('Video file selected:', file.name, 'Size:', (file.size / (1024 * 1024)).toFixed(2) + 'MB');
      }
    });
  }
  
  if (thumbnailFileInput) {
    thumbnailFileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        // Validate image file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          alert('Thumbnail image is too large. Maximum size is 5MB.');
          this.value = '';
          return;
        }
        
        // Validate image file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          alert('Invalid image format. Please upload JPEG, PNG, or GIF files.');
          this.value = '';
          return;
        }
        
        // Show thumbnail preview
        const reader = new FileReader();
        reader.onload = function(e) {
          console.log('Thumbnail selected:', file.name);
          // You could add a preview image here if needed
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  // Test API connection on page load
  async function testAPIConnection() {
    try {
      const response = await fetch('/api/videos/test');
      const result = await response.json();
      console.log('API Connection:', result.msg);
    } catch (error) {
      console.error('API Connection failed:', error);
    }
  }
  
  testAPIConnection();
});