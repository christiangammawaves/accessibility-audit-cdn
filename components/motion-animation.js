/**
 * Motion & Animation Accessibility Audit
 * WCAG: 1.4.2, 2.2.2, 2.3.1 (Level AA); 2.3.3 (Level AAA — informational only)
 */

function runMotionAnimationAudit() {
  'use strict';

  const startTime = performance.now();

  // ============================================================
  // Configuration
  // ============================================================

  // P1 FIX: Single DOM scan shared across all sub-audits
  const _allPageElements = Array.from(document.querySelectorAll('[style*="animation"], [class*="animate"], [class*="animation"], [class*="motion"], [class*="fade"], [class*="slide"], [class*="spin"], [class*="pulse"], [class*="bounce"], marquee'));

  const CONFIG = {
    flashThresholdHz: 3,          // Maximum 3 flashes per second
    checkAnimations: true,
    checkVideos: true,
    maxElementsToCheck: 300
  };

  // Animation libraries to detect
  const ANIMATION_LIBRARIES = [
    { name: 'GSAP', detect: () => typeof window.gsap !== 'undefined' || typeof window.TweenMax !== 'undefined' },
    { name: 'Anime.js', detect: () => typeof window.anime !== 'undefined' },
    { name: 'Velocity.js', detect: () => typeof window.Velocity !== 'undefined' },
    { name: 'Framer Motion', detect: () => document.querySelector('[data-framer-component-type]') },
    { name: 'React Spring', detect: () => document.querySelector('[class*="react-spring"]') },
    { name: 'Lottie', detect: () => typeof window.lottie !== 'undefined' || document.querySelector('[class*="lottie"]') },
    { name: 'AOS', detect: () => typeof window.AOS !== 'undefined' || document.querySelector('[data-aos]') },
    { name: 'Wow.js', detect: () => typeof window.WOW !== 'undefined' || document.querySelector('.wow') },
    { name: 'Animate.css', detect: () => document.querySelector('[class*="animate__"]') }
  ];

  // ============================================================
  // Helper Functions
  // ============================================================

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('motion-animation', 'Animations, transitions, auto-playing media, and motion preferences');
  const { isVisible, getSelector } = h;

  function detectAnimationLibraries() {
    const detected = [];
    for (const lib of ANIMATION_LIBRARIES) {
      try {
        if (lib.detect()) {
          detected.push(lib.name);
        }
      } catch (e) {
        // Detection failed, skip
      }
    }
    return detected;
  }

  // ============================================================
  // Audit Functions
  // ============================================================

  function auditAutoplayMedia() {
    const issues = [];

    // Check video elements
    const videos = Array.from(document.querySelectorAll('video'));
    results.stats.elementsScanned += videos.length;
    for (const video of videos) {
      if (!isVisible(video)) continue;

      const autoplay = video.hasAttribute('autoplay');
      const muted = video.muted || video.hasAttribute('muted');
      const controls = video.hasAttribute('controls');

      if (autoplay) {
        const selector = getSelector(video);
        
        // Auto-play video without being muted
        if (!muted) {
          issues.push({
            severity: 'critical',
            wcag: '2.2.2',
            criterion: '2.2.2 Pause, Stop, Hide',
            message: 'Video auto-plays with sound',
            selector: selector,
            element: video.outerHTML.slice(0, 200),
            fix: 'Remove autoplay, add muted attribute, or provide pause control',
            impact: 'critical'
          });
        }

        // Auto-play video without controls
        if (!controls) {
          issues.push({
            severity: 'moderate',
            wcag: '2.2.2',
            criterion: '2.2.2 Pause, Stop, Hide',
            message: 'Auto-playing video lacks pause control',
            selector: selector,
            element: video.outerHTML.slice(0, 200),
            fix: 'Add controls attribute or pause button',
            impact: 'moderate'
          });
        }
      }
    }

    // Check audio elements
    const audios = Array.from(document.querySelectorAll('audio'));
    results.stats.elementsScanned += audios.length;
    for (const audio of audios) {
      if (!isVisible(audio)) continue;
      
      const autoplay = audio.hasAttribute('autoplay');
      const controls = audio.hasAttribute('controls');

      if (autoplay) {
        const selector = getSelector(audio);

        issues.push({
          severity: 'critical',
          wcag: '2.2.2',
          criterion: '2.2.2 Pause, Stop, Hide',
          message: 'Audio auto-plays',
          selector: selector,
          element: audio.outerHTML.slice(0, 200),
          fix: 'Remove autoplay or provide pause/stop control',
          impact: 'critical'
        });

        if (!controls) {
          issues.push({
            severity: 'critical',
            wcag: '2.2.2',
            criterion: '2.2.2 Pause, Stop, Hide',
            message: 'Auto-playing audio lacks controls',
            selector: selector,
            element: audio.outerHTML.slice(0, 200),
            fix: 'Add controls attribute',
            impact: 'critical'
          });
        }
      }
    }

    // Media without controls check — duration > 3s (migrated from comprehensive-audit.js auditMotion)
    var allMedia = document.querySelectorAll('video, audio');
    allMedia.forEach(function(media) {
      if (!isVisible(media)) return;
      var hasControls = media.hasAttribute('controls');
      // Duration may not be available until metadata loads; check if > 3
      var duration = media.duration;
      if (!hasControls && (isNaN(duration) || duration > 3)) {
        results.stats.elementsScanned++;
        var tag = media.tagName.toLowerCase();
        issues.push({
          severity: 'moderate',
          wcag: '2.2.2',
          criterion: '2.2.2 Pause, Stop, Hide',
          message: tag.charAt(0).toUpperCase() + tag.slice(1) + ' element without controls attribute',
          selector: getSelector(media),
          element: media.outerHTML.slice(0, 200),
          fix: 'Add controls attribute so users can pause, stop, or adjust volume',
          impact: 'moderate'
        });
      }
    });

    // Inline script .play() / Audio() detection (migrated from comprehensive-audit.js auditMotion)
    var inlineScripts = document.querySelectorAll('script:not([src])');
    var hasInlinePlay = false;
    var hasAudioConstructor = false;
    inlineScripts.forEach(function(script) {
      var content = script.textContent || '';
      if (/\.play\s*\(\s*\)/.test(content)) hasInlinePlay = true;
      if (/new\s+Audio\s*\(/.test(content)) hasAudioConstructor = true;
    });

    if (hasInlinePlay) {
      addManualCheck(
        '1.4.2',
        'Script uses .play() to start media',
        'Inline script calls .play() which may auto-play media. Verify users can pause/stop playback and that audio does not start unexpectedly.',
        'body'
      );
    }

    if (hasAudioConstructor) {
      addManualCheck(
        '1.4.2',
        'Script creates Audio objects programmatically',
        'Inline script uses new Audio() which may play sound. Verify sound does not auto-play for more than 3 seconds without user control.',
        'body'
      );
    }

    // GIF pause mechanism check (migrated from comprehensive-audit.js auditMotion)
    var gifs = document.querySelectorAll('img[src$=".gif"], img[src*=".gif?"]');
    gifs.forEach(function(gif) {
      if (!isVisible(gif)) return;
      results.stats.elementsScanned++;
      addManualCheck(
        '2.2.2',
        'Verify animated GIF has pause mechanism',
        'If this GIF is animated, verify users can pause or stop it. Consider using <picture> with a static fallback or a play/pause toggle.',
        getSelector(gif)
      );
    });

    return issues;
  }

  function auditThreeFlashes() {
    const issues = [];
    
    // Check for rapidly animating elements
    const flashAnimStart = performance.now();
    const animatedElements = [];
    for (let i = 0; i < _allPageElements.length && animatedElements.length < CONFIG.maxElementsToCheck; i++) {
      if (i % 500 === 0 && performance.now() - flashAnimStart > 2000) break; // 2s timeout guard
      const el = _allPageElements[i];
      if (!isVisible(el)) continue;
      const style = h.getStyle(el);
      if (style.animation !== 'none' && style.animation !== '') {
        // P6: Cache properties from first pass to avoid second getComputedStyle call below
        animatedElements.push({
          el,
          animationDuration: style.animationDuration,
          animationIterationCount: style.animationIterationCount
        });
      }
    }
    results.stats.elementsScanned += animatedElements.length;

    animatedElements.forEach(({ el: element, animationDuration, animationIterationCount }) => {
      if (animationDuration && animationDuration !== '0s') {
        const durationSeconds = parseFloat(animationDuration);
        const iterationCount = animationIterationCount;
        
        // Check if animation is fast enough to cause flashing
        if (durationSeconds < 0.33) { // <0.33s = >3Hz
          issues.push({
            severity: 'critical',
            wcag: '2.3.1',
            criterion: '2.3.1 Three Flashes or Below Threshold',
            message: `Animation duration ${durationSeconds}s may cause >3 flashes per second`,
            selector: getSelector(element),
            element: element.outerHTML.slice(0, 200),
            fix: 'Increase animation duration to at least 0.33 seconds to stay below 3Hz',
            impact: 'critical'
          });
        }
        
        // Check for infinite rapid animations
        if (durationSeconds < 1 && (iterationCount === 'infinite' || parseFloat(iterationCount) > 10)) {
          issues.push({
            severity: 'serious',
            wcag: '2.3.1',
            criterion: '2.3.1 Three Flashes or Below Threshold',
            message: 'Rapidly repeating animation may cause flashing',
            selector: getSelector(element),
            element: element.outerHTML.slice(0, 200),
            fix: 'Reduce animation speed or iteration count',
            impact: 'serious'
          });
        }
      }
    });
    
    // Check for video elements — flash rate cannot be detected statically; use manual check
    if (CONFIG.checkVideos) {
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        if (!isVisible(video)) return;
        addManualCheck(
          '2.3.1',
          'Verify video for flashing content',
          'Check that this video does not contain sequences with more than 3 flashes per second. ' +
          'Use PEAT (Photosensitive Epilepsy Analysis Tool) or similar tooling to analyse video frames.',
          getSelector(video)
        );
      });
    }
    
    // Check for canvas elements (could contain animations)
    const canvasElements = document.querySelectorAll('canvas');
    if (canvasElements.length > 0) {
      issues.push({
        severity: 'moderate',
        wcag: '2.3.1',
        criterion: '2.3.1 Three Flashes or Below Threshold',
        message: `${canvasElements.length} canvas element(s) detected - may contain flashing animations`,
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Verify canvas animations do not flash more than 3 times per second',
        impact: 'moderate'
      });
    }
    
    // Check for requestAnimationFrame usage (could be rapid)
    const scripts = document.querySelectorAll('script:not([src])');
    let hasRAF = false;
    
    scripts.forEach(script => {
      const content = script.textContent || '';
      if (/requestAnimationFrame|setInterval/.test(content)) {
        hasRAF = true;
      }
    });
    
    if (hasRAF) {
      issues.push({
        severity: 'minor',
        wcag: '2.3.1',
        criterion: '2.3.1 Three Flashes or Below Threshold',
        message: 'Animation APIs detected - verify no rapid flashing effects',
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Ensure animations stay below 3 flashes per second',
        impact: 'minor'
      });
    }
    
    return issues;
  }

  function auditAnimationFromInteractions() {
    const issues = [];
    
    if (!CONFIG.checkAnimations) return issues;
    
    // Detect animation libraries
    const detectedLibraries = detectAnimationLibraries();
    
    // Check for prefers-reduced-motion support
    let hasReducedMotionSupport = false;
    
    // Check CSS for @media (prefers-reduced-motion)
    const stylesheets = Array.from(document.styleSheets);
    for (const sheet of stylesheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          for (const rule of rules) {
            if (rule.media && rule.media.mediaText.includes('prefers-reduced-motion')) {
              hasReducedMotionSupport = true;
              break;
            }
          }
        }
      } catch (e) {
        // CORS or access error, skip
      }
      if (hasReducedMotionSupport) break;
    }
    
    // If animations detected but no reduced motion support
    if (detectedLibraries.length > 0 && !hasReducedMotionSupport) {
      issues.push({
        severity: 'minor',
        wcag: '2.3.3',
        criterion: '2.3.3 Animation from Interactions (Level AAA)',
        message: `Animation libraries detected (${detectedLibraries.join(', ')}) without prefers-reduced-motion support`,
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Add @media (prefers-reduced-motion: reduce) styles to disable or reduce animations',
        impact: 'moderate'
      });
    }
    
    // Check for CSS animations without reduced motion query
    const cssAnimStart = performance.now();
    const animatedElements2 = [];
    for (let i = 0; i < _allPageElements.length && animatedElements2.length < 50; i++) {
      if (i % 500 === 0 && performance.now() - cssAnimStart > 2000) break; // 2s timeout guard
      const el = _allPageElements[i];
      if (!isVisible(el)) continue;
      const style = window.getComputedStyle(el);
      if ((style.animation !== 'none' && style.animation !== '') ||
          (style.transition !== 'all 0s ease 0s' && style.transition !== 'none')) {
        animatedElements2.push(el);
      }
    }
    results.stats.elementsScanned += animatedElements2.length;

    if (animatedElements2.length > 0 && !hasReducedMotionSupport) {
      issues.push({
        severity: 'minor',
        wcag: '2.3.3',
        criterion: '2.3.3 Animation from Interactions (Level AAA)',
        message: `${animatedElements2.length}+ elements have CSS animations/transitions without reduced motion support`,
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Add @media (prefers-reduced-motion: reduce) to disable animations for users who need it',
        impact: 'moderate'
      });
    }
    
    // Check for requestAnimationFrame without reduced motion check
    const scriptsRAF = document.querySelectorAll('script:not([src])');
    let hasRAFWithoutCheck = false;
    
    scriptsRAF.forEach(script => {
      const content = script.textContent || '';
      if (content.includes('requestAnimationFrame') && !content.includes('prefers-reduced-motion')) {
        hasRAFWithoutCheck = true;
      }
    });
    
    if (hasRAFWithoutCheck) {
      issues.push({
        severity: 'minor',
        wcag: '2.3.3',
        criterion: '2.3.3 Animation from Interactions (Level AAA)',
        message: 'Scripts use requestAnimationFrame without checking prefers-reduced-motion',
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Check matchMedia("(prefers-reduced-motion: reduce)") before starting animations',
        impact: 'moderate'
      });
    }
    
    // Check for parallax scrolling (motion from interaction)
    const parallaxElements = document.querySelectorAll(
      '[class*="parallax"], [data-parallax], [class*="scroll-animation"]'
    );
    results.stats.elementsScanned += parallaxElements.length;

    if (parallaxElements.length > 0) {
      issues.push({
        severity: 'minor',
        wcag: '2.3.3',
        criterion: '2.3.3 Animation from Interactions (Level AAA)',
        message: `${parallaxElements.length} parallax/scroll animation element(s) detected`,
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Disable parallax effects when prefers-reduced-motion is active',
        impact: 'moderate'
      });
    }
    
    // Check for hover animations
    const hoverAnimStart = performance.now();
    const hoverElements = [];
    for (let i = 0; i < _allPageElements.length && hoverElements.length < 20; i++) {
      if (i % 500 === 0 && performance.now() - hoverAnimStart > 2000) break; // 2s timeout guard
      const style = window.getComputedStyle(_allPageElements[i]);
      if (style.transition && style.transition !== 'none' &&
          style.transition.includes('transform')) {
        hoverElements.push(_allPageElements[i]);
      }
    }
    results.stats.elementsScanned += hoverElements.length;

    if (hoverElements.length > 5 && !hasReducedMotionSupport) {
      issues.push({
        severity: 'minor',
        wcag: '2.3.3',
        criterion: '2.3.3 Animation from Interactions (Level AAA)',
        message: `Multiple elements with hover animations detected without reduced motion support`,
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Disable hover transform animations when prefers-reduced-motion is active',
        impact: 'minor'
      });
    }
    
    return issues;
  }

  // ============================================================
  // Deprecated Element and Flash Detection (WCAG 2.3.1, 2.2.2)
  // Migrated from comprehensive-audit.js auditFlashing()
  // ============================================================

  function auditFlashingContent() {
    var issues = [];

    // GIF image flashing manual check
    var gifs = document.querySelectorAll('img[src$=".gif"], img[src*=".gif?"]');
    gifs.forEach(function(gif) {
      if (!isVisible(gif)) return;
      results.stats.elementsScanned++;
      issues.push({
        severity: 'moderate',
        wcag: '2.3.1',
        criterion: '2.3.1 Three Flashes or Below Threshold',
        message: 'Animated GIF should be checked for flashing content',
        selector: getSelector(gif),
        element: gif.outerHTML.slice(0, 200),
        fix: 'Verify GIF does not flash more than 3 times per second. Use PEAT (Photosensitive Epilepsy Analysis Tool) to test.',
        impact: 'moderate'
      });
    });

    // <blink> element detection (deprecated, critical)
    var blinkElements = document.querySelectorAll('blink');
    blinkElements.forEach(function(el) {
      results.stats.elementsScanned++;
      issues.push({
        severity: 'critical',
        wcag: '2.3.1',
        criterion: '2.3.1 Three Flashes or Below Threshold',
        message: 'Deprecated <blink> element detected',
        selector: getSelector(el),
        element: el.outerHTML.slice(0, 200),
        fix: 'Remove the <blink> element entirely — blinking content can trigger seizures and is universally deprecated',
        impact: 'critical'
      });
    });

    // <marquee> element detection (deprecated, serious)
    var marqueeElements = document.querySelectorAll('marquee');
    marqueeElements.forEach(function(el) {
      results.stats.elementsScanned++;
      issues.push({
        severity: 'serious',
        wcag: '2.2.2',
        criterion: '2.2.2 Pause, Stop, Hide',
        message: 'Deprecated <marquee> element detected',
        selector: getSelector(el),
        element: el.outerHTML.slice(0, 200),
        fix: 'Remove the <marquee> element — use CSS animations with prefers-reduced-motion support instead',
        impact: 'serious'
      });
    });

    // CSS text-decoration: blink stylesheet scan
    try {
      for (var s = 0; s < document.styleSheets.length; s++) {
        try {
          var rules = document.styleSheets[s].cssRules || [];
          for (var r = 0; r < rules.length; r++) {
            var rule = rules[r];
            if (rule.style && rule.style.textDecoration) {
              if (/blink/i.test(rule.style.textDecoration)) {
                issues.push({
                  severity: 'critical',
                  wcag: '2.3.1',
                  criterion: '2.3.1 Three Flashes or Below Threshold',
                  message: 'CSS text-decoration: blink detected in stylesheet',
                  selector: (rule.selectorText || '').substring(0, 100),
                  element: rule.cssText.slice(0, 200),
                  fix: 'Remove text-decoration: blink — blinking text can trigger seizures',
                  impact: 'critical'
                });
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheet, skip
        }
      }
    } catch (e) {}

    return issues;
  }

  // ============================================================
  // Main Audit Function
  // ============================================================

  function runAudit() {
    const issues = [];

    // 2.2.2 Pause, Stop, Hide (auto-playing media)
    const autoplayIssues = auditAutoplayMedia();
    issues.push(...autoplayIssues);

    // 2.3.1 Three Flashes or Below Threshold
    const flashIssues = auditThreeFlashes();
    issues.push(...flashIssues);

    // 2.3.1, 2.2.2 Flashing content and deprecated elements
    const flashingContentIssues = auditFlashingContent();
    issues.push(...flashingContentIssues);

    // 2.3.3 Animation from Interactions
    const animationIssues = auditAnimationFromInteractions();
    issues.push(...animationIssues);

    return issues;
  }

  // ============================================================
  // Return Results
  // ============================================================

  const issues = runAudit();
  results.issues.push(...issues);

  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

if (typeof window !== 'undefined') {
  window.runMotionAnimationAudit = runMotionAnimationAudit;
}
