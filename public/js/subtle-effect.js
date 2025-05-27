// subtle-effect.js - Enhanced YouTube play button and smooth effects
// Adds silky smooth interactions and the iconic YouTube play button

document.addEventListener('DOMContentLoaded', function() {
  // Get elements
  const videoPlaceholder = document.querySelector('.video-placeholder');
  const body = document.querySelector('body');
  const ambientBackground = document.querySelector('.ambient-background');
  
  // Enhanced YouTube Play Button System
  class YouTubePlayButton {
    constructor(container) {
      this.container = container;
      this.isPlaying = false;
      this.init();
    }
    
    init() {
      this.createPlayButton();
      this.addEventListeners();
    }
    
    createPlayButton() {
      this.container.innerHTML = `
        <div class="youtube-play-button-container">
          <div class="youtube-play-button" id="main-play-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M8 5v14l11-7z" fill="white" stroke="none"/>
            </svg>
          </div>
          <div class="play-button-glow"></div>
        </div>
      `;
      
      // Add styles for the enhanced play button
      this.addPlayButtonStyles();
    }
    
    addPlayButtonStyles() {
      const style = document.createElement('style');
      style.textContent = `
        .youtube-play-button-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }
        
        .youtube-play-button {
          width: 80px;
          height: 56px;
          background: linear-gradient(135deg, 
            rgba(255, 0, 0, 0.9) 0%, 
            rgba(204, 0, 0, 0.9) 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          box-shadow: 
            0 4px 12px rgba(255, 0, 0, 0.3),
            0 2px 4px rgba(0, 0, 0, 0.2);
          position: relative;
          z-index: 2;
          transform: scale(1);
        }
        
        .youtube-play-button:hover {
          background: linear-gradient(135deg, 
            rgba(255, 0, 0, 1) 0%, 
            rgba(204, 0, 0, 1) 100%);
          transform: scale(1.1);
          box-shadow: 
            0 6px 20px rgba(255, 0, 0, 0.4),
            0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .youtube-play-button:active {
          transform: scale(1.05);
        }
        
        .play-button-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 120px;
          height: 120px;
          background: radial-gradient(circle, 
            rgba(255, 0, 0, 0.1) 0%, 
            transparent 70%);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          z-index: 1;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .youtube-play-button:hover + .play-button-glow,
        .youtube-play-button-container:hover .play-button-glow {
          opacity: 1;
        }
        
        /* Smooth video player overlay */
        .video-player-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, 
            rgba(0, 0, 0, 0.8) 0%, 
            rgba(20, 20, 20, 0.9) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 18px;
          opacity: 0;
          transition: opacity 0.5s ease;
          z-index: 3;
        }
        
        .video-player-overlay.active {
          opacity: 1;
        }
        
        .video-controls {
          display: flex;
          align-items: center;
          gap: 20px;
          background: rgba(0, 0, 0, 0.7);
          padding: 15px 25px;
          border-radius: 25px;
          backdrop-filter: blur(10px);
        }
        
        .control-btn {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .control-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(1.1);
        }
        
        .progress-bar {
          flex: 1;
          height: 4px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
          position: relative;
          cursor: pointer;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ff0000, #cc0000);
          border-radius: 2px;
          width: 0%;
          transition: width 0.1s ease;
        }
        
        /* Ripple effect for cards */
        .ripple-effect {
          position: absolute;
          border-radius: 50%;
          background-color: rgba(139, 69, 19, 0.3);
          pointer-events: none;
          transform: scale(0);
          animation: ripple 0.6s linear;
        }
        
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    addEventListeners() {
      const playButton = this.container.querySelector('#main-play-btn');
      
      playButton.addEventListener('click', () => {
        this.togglePlayState();
      });
      
      // Add smooth hover effects to the container
      this.container.addEventListener('mouseenter', () => {
        this.showHoverEffects();
      });
      
      this.container.addEventListener('mouseleave', () => {
        this.hideHoverEffects();
      });
    }
    
    togglePlayState() {
      if (!this.isPlaying) {
        this.startVideo();
      } else {
        this.pauseVideo();
      }
    }
    
    startVideo() {
      this.isPlaying = true;
      
      // Add subtle chocolate tint to background
      body.classList.add('video-playing');
      
      // Create video player overlay
      const overlay = document.createElement('div');
      overlay.className = 'video-player-overlay';
      overlay.innerHTML = `
        <div class="video-controls">
          <button class="control-btn" id="pause-btn">⏸️</button>
          <div class="progress-bar" id="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <button class="control-btn" id="volume-btn">🔊</button>
          <button class="control-btn" id="fullscreen-btn">⛶</button>
        </div>
      `;
      
      this.container.appendChild(overlay);
      
      // Smooth transition to player
      setTimeout(() => {
        overlay.classList.add('active');
      }, 100);
      
      // Add control listeners
      this.addVideoControls(overlay);
      
      // Start progress animation
      this.animateProgress();
    }
    
    addVideoControls(overlay) {
      const pauseBtn = overlay.querySelector('#pause-btn');
      const progressBar = overlay.querySelector('#progress-bar');
      const volumeBtn = overlay.querySelector('#volume-btn');
      const fullscreenBtn = overlay.querySelector('#fullscreen-btn');
      
      pauseBtn.addEventListener('click', () => {
        this.pauseVideo();
      });
      
      progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width * 100;
        this.setProgress(percent);
      });
      
      volumeBtn.addEventListener('click', () => {
        this.toggleVolume();
      });
      
      fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }
    
    animateProgress() {
      if (!this.isPlaying) return;
      
      const progressFill = this.container.querySelector('#progress-fill');
      if (progressFill) {
        let currentProgress = 0;
        
        const updateProgress = () => {
          if (!this.isPlaying) return;
          
          currentProgress += 0.1;
          if (currentProgress >= 100) {
            currentProgress = 0;
          }
          
          progressFill.style.width = `${currentProgress}%`;
          
          setTimeout(updateProgress, 100);
        };
        
        updateProgress();
      }
    }
    
    pauseVideo() {
      this.isPlaying = false;
      
      // Remove video overlay
      const overlay = this.container.querySelector('.video-player-overlay');
      if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
          overlay.remove();
        }, 500);
      }
      
      // Restore play button
      setTimeout(() => {
        this.createPlayButton();
        this.addEventListeners();
      }, 500);
      
      // Remove chocolate tint
      body.classList.remove('video-playing');
    }
    
    setProgress(percent) {
      const progressFill = this.container.querySelector('#progress-fill');
      if (progressFill) {
        progressFill.style.width = `${percent}%`;
      }
    }
    
    toggleVolume() {
      const volumeBtn = this.container.querySelector('#volume-btn');
      if (volumeBtn) {
        volumeBtn.textContent = volumeBtn.textContent === '🔊' ? '🔇' : '🔊';
      }
    }
    
    toggleFullscreen() {
      console.log('Fullscreen toggled');
    }
    
    showHoverEffects() {
      // Add subtle glow effect when hovering over video area
      if (ambientBackground && !this.isPlaying) {
        ambientBackground.style.background = `
          radial-gradient(circle at center, 
            rgba(139, 69, 19, 0.03) 0%, 
            transparent 60%),
          var(--bg-color)
        `;
      }
    }
    
    hideHoverEffects() {
      if (ambientBackground && !this.isPlaying) {
        ambientBackground.style.background = 'var(--bg-color)';
      }
    }
  }
  
  // Enhanced Card Hover System
  class CardHoverSystem {
    constructor() {
      this.cards = document.querySelectorAll('.video-card, .product-card');
      this.init();
    }
    
    init() {
      this.cards.forEach(card => {
        this.addCardEffects(card);
      });
    }
    
    addCardEffects(card) {
      // Add smooth hover transitions
      card.style.transition = 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
      
      card.addEventListener('mouseenter', () => {
        this.showCardHover(card);
      });
      
      card.addEventListener('mouseleave', () => {
        this.hideCardHover(card);
      });
      
      // Add click ripple effect
      card.addEventListener('click', (e) => {
        this.createRippleEffect(e, card);
      });
    }
    
    showCardHover(card) {
      // Smooth lift effect
      card.style.transform = 'translateY(-4px) scale(1.02)';
      card.style.boxShadow = `
        0 8px 25px rgba(0, 0, 0, 0.15),
        0 0 20px rgba(139, 69, 19, 0.1)
      `;
      
      // Add subtle glow to background
      if (ambientBackground) {
        const rect = card.getBoundingClientRect();
        const centerX = (rect.left + rect.width / 2) / window.innerWidth;
        const centerY = (rect.top + rect.height / 2) / window.innerHeight;
        
        ambientBackground.style.background = `
          radial-gradient(circle at ${centerX * 100}% ${centerY * 100}%, 
            rgba(139, 69, 19, 0.02) 0%, 
            transparent 40%),
          var(--bg-color)
        `;
      }
    }
    
    hideCardHover(card) {
      card.style.transform = 'translateY(0) scale(1)';
      card.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
      
      // Reset background
      if (ambientBackground && !body.classList.contains('video-playing')) {
        ambientBackground.style.background = 'var(--bg-color)';
      }
    }
    
    createRippleEffect(event, card) {
      const ripple = document.createElement('span');
      const rect = card.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;
      
      ripple.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
      `;
      ripple.classList.add('ripple-effect');
      
      card.style.position = 'relative';
      card.appendChild(ripple);
      
      // Remove ripple after animation
      setTimeout(() => {
        ripple.remove();
      }, 600);
    }
  }
  
  // Smooth Scrolling System
  class SmoothScrollSystem {
    constructor() {
      this.init();
    }
    
    init() {
      // Add smooth scrolling to all internal links
      document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const target = document.querySelector(link.getAttribute('href'));
          if (target) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        });
      });
      
      // Add smooth scroll behavior to window
      document.documentElement.style.scrollBehavior = 'smooth';
    }
  }
  
  // Background Brightness Detector
  class BackgroundBrightnessDetector {
    constructor() {
      this.currentBrightness = 0.1;
      this.init();
    }
    
    init() {
      // Monitor overall page brightness and adjust ambient background
      this.analyzePageBrightness();
      
      // Update brightness periodically
      setInterval(() => {
        this.analyzePageBrightness();
      }, 5000);
    }
    
    analyzePageBrightness() {
      const allElements = document.querySelectorAll('*');
      let totalBrightness = 0;
      let elementCount = 0;
      
      allElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const color = styles.color;
        const backgroundColor = styles.backgroundColor;
        
        if (color && color !== 'rgba(0, 0, 0, 0)') {
          totalBrightness += this.getColorBrightness(color);
          elementCount++;
        }
        
        if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
          totalBrightness += this.getColorBrightness(backgroundColor);
          elementCount++;
        }
      });
      
      const averageBrightness = elementCount > 0 ? totalBrightness / elementCount : 0.1;
      
      if (Math.abs(averageBrightness - this.currentBrightness) > 0.05) {
        this.currentBrightness = averageBrightness;
        this.updateAmbientBackground();
      }
    }
    
    getColorBrightness(color) {
      const rgb = this.parseColor(color);
      if (!rgb) return 0.1;
      
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
    
    updateAmbientBackground() {
      if (!ambientBackground) return;
      
      const chocolateIntensity = Math.min(0.02, this.currentBrightness * 0.1);
      
      if (!body.classList.contains('video-playing')) {
        ambientBackground.style.background = `
          radial-gradient(circle at center, 
            rgba(139, 69, 19, ${chocolateIntensity}) 0%, 
            transparent 70%),
          var(--bg-color)
        `;
      }
    }
  }
  
  // Initialize all systems
  if (videoPlaceholder) {
    new YouTubePlayButton(videoPlaceholder);
  }
  
  new CardHoverSystem();
  new SmoothScrollSystem();
  new BackgroundBrightnessDetector();
  
  // Add silky smooth CSS for maximum smoothness
  const smoothnessStyle = document.createElement('style');
  smoothnessStyle.textContent = `
    /* Ultimate smoothness optimizations */
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    
    body, html {
      overflow-x: hidden;
      scroll-behavior: smooth;
    }
    
    .ambient-background {
      transform: translate3d(0, 0, 0);
      will-change: background;
      backface-visibility: hidden;
      perspective: 1000px;
    }
    
    .video-card, .product-card, .featured-video, .shop-section {
      transform: translate3d(0, 0, 0);
      will-change: transform, box-shadow;
      backface-visibility: hidden;
    }
    
    /* Hardware acceleration for all interactive elements */
    .youtube-play-button,
    .video-card,
    .product-card,
    .sidebar-item,
    .video-action-btn {
      transform: translate3d(0, 0, 0);
      will-change: transform;
    }
  `;
  document.head.appendChild(smoothnessStyle);
});