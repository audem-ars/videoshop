// main.js - MINIMAL VERSION - NO PHANTOM GLOW SYSTEM

document.addEventListener('DOMContentLoaded', function() {
  // Initialize hamburger menu ONLY
  initHamburgerMenu();

  window.openModal = function(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    document.body.classList.add('modal-open');
  };
  
  window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.classList.remove('modal-open');
  };
  
  window.switchModal = function(closeId, openId) {
    closeModal(closeId);
    openModal(openId);
  };
  
  // Upload button functionality
  const uploadButton = document.getElementById('upload-btn');
  if (uploadButton) {
    uploadButton.addEventListener('click', function() {
      openModal('upload-modal');
    });
  }
  
  // Basic video card clicks
  const videoCards = document.querySelectorAll('.video-card');
  videoCards.forEach(card => {
    card.addEventListener('click', function() {
      const title = this.querySelector('.video-card-title').textContent;
      console.log(`Video clicked: ${title}`);
    });
  });
  
  // Basic product card clicks
  const productCards = document.querySelectorAll('.product-card');
  productCards.forEach(card => {
    card.addEventListener('click', function() {
      const name = this.querySelector('.product-name').textContent;
      console.log(`Product clicked: ${name}`);
    });
  });
  
  // Action buttons
  const actionButtons = document.querySelectorAll('.video-action-btn');
  actionButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      console.log('Action clicked:', this.textContent.trim());
    });
  });
  
  // Hamburger Menu Functionality
  function initHamburgerMenu() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    
    if (hamburgerMenu && sidebar && sidebarOverlay) {
      hamburgerMenu.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        hamburgerMenu.classList.toggle('active');
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
      });
      
      // Close sidebar when clicking overlay
      sidebarOverlay.addEventListener('click', function() {
        hamburgerMenu.classList.remove('active');
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
      });
      
      // Close sidebar with Escape key
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
          hamburgerMenu.classList.remove('active');
          sidebar.classList.remove('open');
          sidebarOverlay.classList.remove('active');
        }
      });
    }
  }
  
  // Upload form handler
  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitBtn = this.querySelector('.form-submit');
      const originalText = submitBtn.textContent;
      
      try {
        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;
        
        const formData = new FormData();
        formData.append('title', document.getElementById('video-title').value);
        formData.append('description', document.getElementById('video-description').value);
        formData.append('videoFile', document.getElementById('video-file').files[0]);
        formData.append('thumbnailFile', document.getElementById('thumbnail-file').files[0]);
        formData.append('publish', document.getElementById('video-publish').checked);
        
        if (!document.getElementById('video-file').files[0]) {
          throw new Error('Please select a video file');
        }
        if (!document.getElementById('thumbnail-file').files[0]) {
          throw new Error('Please select a thumbnail image');
        }
        
        const response = await fetch('/api/videos/upload', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert('Video uploaded successfully!');
          uploadForm.reset();
          closeModal('upload-modal');
        } else {
          throw new Error(result.message || 'Upload failed');
        }
        
      } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
  
  // File validation
  const videoFileInput = document.getElementById('video-file');
  const thumbnailFileInput = document.getElementById('thumbnail-file');
  
  if (videoFileInput) {
    videoFileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
          alert('Video file is too large. Maximum size is 100MB.');
          this.value = '';
          return;
        }
        
        const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
        if (!allowedTypes.includes(file.type)) {
          alert('Invalid video format. Please upload MP4, AVI, MOV, or WMV files.');
          this.value = '';
          return;
        }
      }
    });
  }
  
  if (thumbnailFileInput) {
    thumbnailFileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          alert('Thumbnail image is too large. Maximum size is 5MB.');
          this.value = '';
          return;
        }
        
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          alert('Invalid image format. Please upload JPEG, PNG, or GIF files.');
          this.value = '';
          return;
        }
      }
    });
  }
});

// Add this to your main.js or in a script tag
document.addEventListener('scroll', function() {
  const maxScrollLeft = document.documentElement.scrollWidth - window.innerWidth;
  
  if (window.scrollX > maxScrollLeft) {
    window.scrollTo(maxScrollLeft, window.scrollY);
  }
});

// Also prevent touch/drag scrolling into phantom area
document.addEventListener('touchmove', function(e) {
  const maxScrollLeft = document.documentElement.scrollWidth - window.innerWidth;
  
  if (window.scrollX > maxScrollLeft) {
    e.preventDefault();
    window.scrollTo(maxScrollLeft, window.scrollY);
  }
});