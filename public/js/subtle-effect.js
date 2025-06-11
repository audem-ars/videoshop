// MINIMAL subtle-effect.js - NO PHANTOM PANELS OR BACKGROUND BULLSHIT

document.addEventListener('DOMContentLoaded', function() {
  const videoPlaceholder = document.querySelector('.video-placeholder');
  
  // ONLY the YouTube play button - NOTHING ELSE
  if (videoPlaceholder) {
    videoPlaceholder.innerHTML = `
      <div class="youtube-play-button" style="
        width: 80px;
        height: 56px;
        background: linear-gradient(135deg, rgba(255, 0, 0, 0.9) 0%, rgba(204, 0, 0, 0.9) 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(255, 0, 0, 0.3);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M8 5v14l11-7z" fill="white" stroke="none"/>
        </svg>
      </div>
    `;
    
    const playButton = videoPlaceholder.querySelector('.youtube-play-button');
    
    playButton.addEventListener('mouseenter', () => {
      playButton.style.transform = 'scale(1.1)';
      playButton.style.boxShadow = '0 6px 20px rgba(255, 0, 0, 0.4)';
    });
    
    playButton.addEventListener('mouseleave', () => {
      playButton.style.transform = 'scale(1)';
      playButton.style.boxShadow = '0 4px 12px rgba(255, 0, 0, 0.3)';
    });
    
    playButton.addEventListener('click', () => {
      alert('Video would play here');
    });
  }
  
  // REMOVE ANY EXISTING PHANTOM ELEMENTS
  const phantomElements = document.querySelectorAll('.ambient-background, .glow-element, .background-panel');
  phantomElements.forEach(el => el.remove());
});