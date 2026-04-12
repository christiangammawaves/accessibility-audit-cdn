/**
 * Video Player Accessibility Audit
 * WCAG: 1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.5, 1.4.2, 2.1.1, 2.2.2, 4.1.2 (Level AA); 1.2.6, 1.2.7, 1.2.8, 1.2.9 (Level AAA — informational only)
 */

function runVideoPlayerAudit() {
  'use strict';

  const startTime = performance.now();

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  const CONFIG = {
    scope: [
      // Native video
      'video',
      // Video containers
      '[class*="video-player"]',
      '[class*="video-container"]',
      '[class*="video-wrapper"]',
      '[data-video]',
      '[data-video-player]',
      // Product video specific
      '[class*="product-video"]',
      '[class*="pdp-video"]',
      // Hero/background video
      '[class*="hero-video"]',
      '[class*="background-video"]',
      '[class*="bg-video"]',
      '[class*="video-hero"]',
      '[class*="video-background"]',
      // Embedded video iframes
      'iframe[src*="youtube"]',
      'iframe[src*="youtu.be"]',
      'iframe[src*="vimeo"]',
      'iframe[src*="wistia"]',
      'iframe[src*="vidyard"]',
      'iframe[src*="brightcove"]',
      // Video galleries
      '[class*="video-gallery"]',
      '[class*="media-gallery"] video',
      // Shopify specific
      '.product__media video',
      '[data-media-type="video"]',
      '[data-media-type="external_video"]'
    ],
    controlSelectors: [
      '[class*="play"]',
      '[class*="pause"]',
      '[class*="mute"]',
      '[class*="volume"]',
      '[class*="fullscreen"]',
      '[class*="caption"]',
      '[class*="cc"]',
      '[aria-label*="play" i]',
      '[aria-label*="pause" i]',
      '[aria-label*="mute" i]'
    ],
    backgroundVideoSelectors: [
      '[class*="background"]',
      '[class*="bg-video"]',
      '[class*="hero-video"]',
      '[autoplay]',
      '[data-autoplay="true"]',
      '[muted]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('video-player', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  // ==========================================================================
  // FIND VIDEO ELEMENTS
  // ==========================================================================

  function findVideos() {
    const videos = {
      native: [],
      embedded: [],
      background: [],
      containers: []
    };
    
    // Find native video elements
    document.querySelectorAll('video').forEach(video => {
      if (isVisible(video)) {
        // Check if it's a background video
        let isBackground = false;
        CONFIG.backgroundVideoSelectors.forEach(selector => {
          if (video.matches(selector) || video.closest(selector)) {
            isBackground = true;
          }
        });
        
        if (isBackground || video.hasAttribute('autoplay') || video.hasAttribute('muted')) {
          videos.background.push(video);
        } else {
          videos.native.push(video);
        }
      }
    });
    
    // Find embedded videos (YouTube, Vimeo, etc.)
    const embeddedSelectors = [
      'iframe[src*="youtube"]',
      'iframe[src*="youtu.be"]',
      'iframe[src*="vimeo"]',
      'iframe[src*="wistia"]',
      'iframe[src*="vidyard"]',
      'iframe[src*="brightcove"]'
    ];
    
    embeddedSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(iframe => {
        if (isVisible(iframe)) {
          videos.embedded.push(iframe);
        }
      });
    });
    
    // Find video containers (might have play buttons, thumbnails, etc.)
    const containerSelectors = [
      '[class*="video-player"]',
      '[class*="video-container"]',
      '[data-video]',
      '[class*="product-video"]'
    ];
    
    containerSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(container => {
        if (isVisible(container)) {
          // Avoid duplicates
          const hasVideo = container.querySelector('video') || container.querySelector('iframe[src*="youtube"], iframe[src*="vimeo"]');
          if (!hasVideo) {
            videos.containers.push(container);
          }
        }
      });
    });
    
    return videos;
  }

  const videos = findVideos();
  const totalVideos = videos.native.length + videos.embedded.length + videos.background.length + videos.containers.length;
  
  if (totalVideos === 0) {
    results.manualChecks.push({
      wcag: '1.2.2',
      message: 'No video elements found on page',
      howToTest: 'If video content exists, verify it is accessible and has captions'
    });
    
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  // Add manual checks for AA/AAA criteria
  if (totalVideos > 0) {
    // 1.2.4 Captions (Live) - Level AA
    results.manualChecks.push({
      wcag: '1.2.4',
      message: 'Manual check needed: Live video captions',
      howToTest: 'If live video content exists, verify real-time captions are provided'
    });

    // 1.2.6 Sign Language (Prerecorded) - Level AAA
    results.manualChecks.push({
      wcag: '1.2.6',
      message: 'Manual check needed: Sign language interpretation',
      howToTest: 'For AAA compliance, verify sign language interpretation is provided for prerecorded audio'
    });

    // 1.2.7 Extended Audio Description - Level AAA
    results.manualChecks.push({
      wcag: '1.2.7',
      message: 'Manual check needed: Extended audio description',
      howToTest: 'For AAA compliance, verify extended audio description is provided when pauses in audio are insufficient'
    });

    // 1.2.8 Media Alternative - Level AAA
    results.manualChecks.push({
      wcag: '1.2.8',
      message: 'Manual check needed: Full text alternative',
      howToTest: 'For AAA compliance, verify an alternative for time-based media (text transcript) is provided for prerecorded synchronized media'
    });

    // 1.2.9 Audio-only (Live) - Level AAA
    results.manualChecks.push({
      wcag: '1.2.9',
      message: 'Manual check needed: Live audio alternatives',
      howToTest: 'If live audio-only content exists, verify an alternative is provided (e.g., real-time text transcript)'
    });
  }

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================
  
  /**
   * Test 1: Captions for Native Video
   * WCAG: 1.2.2
   */
  function testNativeVideoCaptions() {
    videos.native.forEach(video => {
      results.stats.elementsScanned++;
      
      // Check for track elements
      const tracks = video.querySelectorAll('track');
      const captionTrack = Array.from(tracks).find(track => 
        track.getAttribute('kind') === 'captions' || track.getAttribute('kind') === 'subtitles'
      );
      
      if (captionTrack) {
        const src = captionTrack.getAttribute('src');
        if (src) {
          addPassed('1.2.2', 'Captions (Prerecorded)', 'Video has caption track: ' + src.split('/').pop(), getSelector(video));
        } else {
          addIssue(
            'serious',
            '1.2.2',
            'Captions (Prerecorded)',
            'Caption track element exists but has no src attribute',
            video,
            'Add src attribute pointing to caption file (.vtt)',
            'Deaf and hard of hearing users cannot access audio content'
          );
        }
      } else {
        addIssue(
          'critical',
          '1.2.2',
          'Captions (Prerecorded)',
          'Video has no caption track',
          video,
          'Add <track kind="captions" src="captions.vtt" srclang="en" label="English">',
          'Deaf and hard of hearing users cannot access audio content'
        );
      }
      
      // Check for multiple languages if applicable
      const allCaptions = Array.from(tracks).filter(track => 
        track.getAttribute('kind') === 'captions' || track.getAttribute('kind') === 'subtitles'
      );
      
      if (allCaptions.length > 1) {
        addPassed('1.2.2', 'Captions (Prerecorded)', 'Video has ' + allCaptions.length + ' caption tracks', getSelector(video));
      }
    });
  }

  /**
   * Test 2: Embedded Video Accessibility
   * WCAG: 1.2.2, 4.1.2
   */
  function testEmbeddedVideos() {
    videos.embedded.forEach(iframe => {
      results.stats.elementsScanned++;
      
      const src = iframe.getAttribute('src') || '';
      const title = iframe.getAttribute('title');
      
      // Check for accessible name (title attribute)
      if (!title) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Embedded video iframe lacks title attribute',
          iframe,
          'Add title attribute describing the video content (e.g., title="Product demo video")',
          'Screen reader users cannot identify the video content'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Video iframe has title: "' + title.slice(0, 40) + '"', getSelector(iframe));
      }
      
      // Check YouTube parameters for captions
      if (src.includes('youtube') || src.includes('youtu.be')) {
        // YouTube URLs can have cc_load_policy=1 to show captions
        const hasCaptionParam = src.includes('cc_load_policy=1');
        
        if (hasCaptionParam) {
          addPassed('1.2.2', 'Captions (Prerecorded)', 'YouTube video has captions enabled via URL parameter', getSelector(iframe));
        } else {
          addManualCheck(
            '1.2.2',
            'Verify YouTube video has captions available',
            'Play the video and check if CC button is available. Consider adding cc_load_policy=1 to URL to auto-enable captions.',
            getSelector(iframe)
          );
        }
      }
      
      // Check Vimeo
      if (src.includes('vimeo')) {
        addManualCheck(
          '1.2.2',
          'Verify Vimeo video has captions uploaded',
          'Check Vimeo video settings to confirm captions are available. Vimeo requires manual caption upload.',
          getSelector(iframe)
        );
      }
      
      // Check for keyboard accessibility
      const tabindex = iframe.getAttribute('tabindex');
      if (tabindex === '-1') {
        addIssue(
          'serious',
          '2.1.1',
          'Keyboard',
          'Video iframe has tabindex="-1" preventing keyboard access',
          iframe,
          'Remove tabindex="-1" or set to "0"',
          'Keyboard users cannot access video controls'
        );
      }
    });
  }

  /**
   * Test 3: Background/Autoplay Video Controls
   * WCAG: 1.4.2, 2.2.2
   */
  function testBackgroundVideos() {
    videos.background.forEach(video => {
      results.stats.elementsScanned++;
      
      const hasAudio = !video.muted && !video.hasAttribute('muted');
      const autoplays = video.autoplay || video.hasAttribute('autoplay');
      const loops = video.loop || video.hasAttribute('loop');
      
      // WCAG 1.4.2: Audio Control
      if (hasAudio && autoplays) {
        addIssue(
          'critical',
          '1.4.2',
          'Audio Control',
          'Video autoplays with audio - this can be disorienting and harmful',
          video,
          'Add muted attribute to video or provide visible audio controls',
          'Users with cognitive disabilities, screen readers, or in public spaces cannot control unexpected audio'
        );
      } else if (video.hasAttribute('muted')) {
        addPassed('1.4.2', 'Audio Control', 'Background video is muted', getSelector(video));
      }
      
      // WCAG 2.2.2: Pause, Stop, Hide
      if (autoplays) {
        // Look for pause/stop control
        const container = video.closest('[class*="video"], [class*="hero"], [class*="background"]') || video.parentElement;
        let hasPauseControl = false;
        
        if (container) {
          const controls = container.querySelectorAll('button, [role="button"]');
          controls.forEach(control => {
            const name = getAccessibleName(control).toLowerCase();
            const classes = (control.className || '').toLowerCase();
            if (name.includes('pause') || name.includes('stop') || name.includes('play') ||
                classes.includes('pause') || classes.includes('play')) {
              hasPauseControl = true;
            }
          });
        }
        
        // Check for native controls attribute
        if (video.hasAttribute('controls')) {
          hasPauseControl = true;
        }
        
        if (!hasPauseControl) {
          addIssue(
            'serious',
            '2.2.2',
            'Pause, Stop, Hide',
            'Autoplay video has no visible pause/stop control',
            video,
            'Add a pause button or use controls attribute to allow users to stop the video',
            'Users with vestibular disorders or cognitive disabilities may be unable to focus with moving content'
          );
        } else {
          addPassed('2.2.2', 'Pause, Stop, Hide', 'Autoplay video has pause control', getSelector(video));
        }
      }
      
      // Check if video is purely decorative
      const ariaHidden = video.getAttribute('aria-hidden');
      const role = video.getAttribute('role');
      
      if (ariaHidden === 'true' || role === 'presentation') {
        addPassed('1.2.1', 'Video-only (Prerecorded)', 'Decorative video properly marked with aria-hidden or role="presentation"', getSelector(video));
      } else if (video.hasAttribute('muted') && loops) {
        // Likely decorative but not marked
        addManualCheck(
          '1.2.1',
          'Determine if muted looping video is decorative',
          'If video is purely decorative (no meaningful content), add aria-hidden="true". If it conveys information, provide text alternative.',
          getSelector(video)
        );
      }
    });
  }

  /**
   * Test 4: Video Player Controls
   * WCAG: 2.1.1, 4.1.2
   */
  function testPlayerControls() {
    // Test native video controls
    videos.native.forEach(video => {
      results.stats.elementsScanned++;
      
      const hasNativeControls = video.hasAttribute('controls');
      
      if (hasNativeControls) {
        addPassed('2.1.1', 'Keyboard', 'Video uses native controls (keyboard accessible)', getSelector(video));
      } else {
        // Look for custom controls
        const container = video.closest('[class*="video"], [class*="player"]') || video.parentElement;
        const customControls = container ? getFocusableElements(container) : [];
        
        if (customControls.length === 0) {
          addIssue(
            'serious',
            '2.1.1',
            'Keyboard',
            'Video has no native controls and no custom controls found',
            video,
            'Add controls attribute or provide accessible custom controls',
            'Keyboard users cannot control video playback'
          );
        } else {
          // Check custom control accessibility
          let hasPlay = false;
          let hasMute = false;
          
          customControls.forEach(control => {
            const name = getAccessibleName(control).toLowerCase();
            const ariaLabel = (control.getAttribute('aria-label') || '').toLowerCase();
            const classes = (control.className || '').toLowerCase();
            
            if (name.includes('play') || ariaLabel.includes('play') || classes.includes('play')) hasPlay = true;
            if (name.includes('mute') || name.includes('volume') || ariaLabel.includes('mute') || classes.includes('mute')) hasMute = true;
            
            // Check if icon-only buttons have labels
            if (!control.textContent.trim() || control.textContent.trim().length < 2) {
              if (!control.getAttribute('aria-label') && !control.getAttribute('title')) {
                addIssue(
                  'serious',
                  '4.1.2',
                  'Name, Role, Value',
                  'Video control button has no accessible name',
                  control,
                  'Add aria-label describing the control (e.g., aria-label="Play video")',
                  'Screen reader users cannot identify control purpose'
                );
              }
            }
          });
          
          if (hasPlay) {
            addPassed('2.1.1', 'Keyboard', 'Video has accessible play control', getSelector(container));
          }
        }
      }
    });
    
    // Test video containers (might have play overlay)
    videos.containers.forEach(container => {
      results.stats.elementsScanned++;
      
      const playButton = container.querySelector('[class*="play"], [aria-label*="play" i], button');
      
      if (playButton) {
        const name = getAccessibleName(playButton);
        
        if (!name) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Video play button lacks accessible name',
            playButton,
            'Add aria-label="Play video" or visible text',
            'Screen reader users cannot identify the play button'
          );
        } else {
          addPassed('4.1.2', 'Name, Role, Value', 'Play button has accessible name: "' + name.slice(0, 30) + '"', getSelector(playButton));
        }
      }
    });
  }

  /**
   * Test 5: Audio Description
   * WCAG: 1.2.3, 1.2.5
   */
  function testAudioDescription() {
    // Check native videos for audio description track
    videos.native.forEach(video => {
      const tracks = video.querySelectorAll('track');
      const descriptionTrack = Array.from(tracks).find(track => 
        track.getAttribute('kind') === 'descriptions'
      );
      
      if (descriptionTrack) {
        addPassed('1.2.5', 'Audio Description', 'Video has audio description track', getSelector(video));
      } else {
        addManualCheck(
          '1.2.5',
          'Determine if video needs audio description',
          'If video contains important visual information not conveyed in audio (e.g., on-screen text, actions), provide audio description track or text transcript',
          getSelector(video)
        );
      }
    });
    
    // For embedded videos, always add manual check
    if (videos.embedded.length > 0) {
      addManualCheck(
        '1.2.5',
        'Verify embedded videos have audio description if needed',
        'Check if important visual information is conveyed in the main audio. If not, provide audio described version or text transcript.'
      );
    }
  }

  /**
   * Test 6: Transcript Availability
   * WCAG: 1.2.3
   */
  function testTranscript() {
    const allVideos = [...videos.native, ...videos.embedded, ...videos.containers];
    
    allVideos.forEach(video => {
      const container = video.closest('[class*="video"], section, article') || video.parentElement;
      
      // Look for transcript link or content
      const transcriptSelectors = [
        '[class*="transcript"]',
        'a[href*="transcript"]',
        '[id*="transcript"]',
        'details:contains("transcript")',
        '[aria-label*="transcript" i]'
      ];
      
      let hasTranscript = false;
      
      if (container) {
        for (const selector of transcriptSelectors) {
          try {
            if (container.querySelector(selector)) {
              hasTranscript = true;
              break;
            }
          } catch (e) {
            // Invalid selector
          }
        }
        
        // Also check for text content mentioning transcript
        const links = container.querySelectorAll('a');
        links.forEach(link => {
          if (link.textContent.toLowerCase().includes('transcript')) {
            hasTranscript = true;
          }
        });
      }
      
      if (hasTranscript) {
        addPassed('1.2.3', 'Audio Description or Media Alternative', 'Video appears to have transcript available', getSelector(video));
      }
    });
    
    // General manual check for transcripts
    if (allVideos.length > 0) {
      addManualCheck(
        '1.2.3',
        'Verify transcripts are available for all videos with spoken content',
        'Provide text transcript that includes all spoken dialogue and describes important visual content'
      );
    }
  }

  /**
   * Test 7: Focus Management
   * WCAG: 2.4.3, 2.4.7
   */
  function testFocusManagement() {
    const allVideoElements = [...videos.native, ...videos.embedded, ...videos.containers];
    
    allVideoElements.forEach(element => {
      const container = element.closest('[class*="video"], [class*="player"]') || element.parentElement;
      
      if (container) {
        const focusable = getFocusableElements(container);
        
        // Check for focus indicators
        focusable.forEach(el => {
          const style = window.getComputedStyle(el);
          const outline = style.outline;
          const outlineStyle = style.outlineStyle;
          
          if (outline === 'none' || outline === '0' || outlineStyle === 'none') {
            addManualCheck(
              '2.4.7',
              'Verify focus indicator on video control: ' + getSelector(el),
              'Tab to this control and confirm a visible focus indicator appears',
              getSelector(el)
            );
          }
        });
        
        // Check for positive tabindex
        focusable.forEach(el => {
          const tabindex = el.getAttribute('tabindex');
          if (tabindex && parseInt(tabindex) > 0) {
            addIssue(
              'moderate',
              '2.4.3',
              'Focus Order',
              'Video control has positive tabindex disrupting focus order',
              el,
              'Remove positive tabindex or set to 0',
              'Keyboard users may experience unexpected focus order'
            );
          }
        });
      }
    });
    
    // Manual keyboard testing
    addManualCheck(
      '2.1.1',
      'Verify all video controls work with keyboard',
      'Tab to video player, use Enter/Space to play/pause, arrow keys for seek/volume if applicable'
    );
  }

  /**
   * Test 8: Video Modal/Lightbox Accessibility
   * WCAG: 2.1.2, 4.1.2
   */
  function testVideoModals() {
    // Look for video modals/lightboxes
    const modalSelectors = [
      '[class*="video-modal"]',
      '[class*="video-lightbox"]',
      '[class*="video-popup"]',
      '[data-video-modal]',
      '.fancybox-video',
      '.mfp-video'
    ];
    
    modalSelectors.forEach(selector => {
      const modals = document.querySelectorAll(selector);
      
      modals.forEach(modal => {
        if (!isVisible(modal)) return;
        results.stats.elementsScanned++;
        
        const role = modal.getAttribute('role');
        const ariaModal = modal.getAttribute('aria-modal');
        
        // Check for dialog role
        if (role !== 'dialog') {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Video modal lacks role="dialog"',
            modal,
            'Add role="dialog" and aria-modal="true"',
            'Screen readers may not announce modal context'
          );
        }
        
        // Check for close button
        const closeButton = modal.querySelector('[class*="close"], [aria-label*="close" i]');
        if (!closeButton) {
          addIssue(
            'serious',
            '2.1.2',
            'No Keyboard Trap',
            'Video modal has no visible close button',
            modal,
            'Add close button with accessible label',
            'Users may not be able to exit the modal'
          );
        } else {
          const closeName = getAccessibleName(closeButton);
          if (!closeName) {
            addIssue(
              'moderate',
              '4.1.2',
              'Name, Role, Value',
              'Video modal close button lacks accessible name',
              closeButton,
              'Add aria-label="Close video"'
            );
          }
        }
        
        // Manual check for focus trap
        addManualCheck(
          '2.1.2',
          'Verify video modal traps focus appropriately',
          'Open video modal, tab through - focus should stay within modal. Escape should close modal.',
          getSelector(modal)
        );
      });
    });
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================
  
  testNativeVideoCaptions();
  testEmbeddedVideos();
  testBackgroundVideos();
  testPlayerControls();
  testAudioDescription();
  testTranscript();
  testFocusManagement();
  testVideoModals();

  // ==========================================================================
  // FINALIZE RESULTS
  // ==========================================================================
  
  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runVideoPlayerAudit = runVideoPlayerAudit;
}
