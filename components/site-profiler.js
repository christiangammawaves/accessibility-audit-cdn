/**
 * @module site-profiler
 * Detects frameworks, third-party widgets, and auto-applies learned exceptions.
 */

(function(global) {
  'use strict';

  const PROFILER_VERSION = (global.A11Y_VERSION) || 'unknown';
  const LOG_PREFIX = '[a11y-profiler]';

  const FRAMEWORK_SIGNATURES = {
    shopify: {
      name: 'Shopify',
      category: 'ecommerce',
      detectors: [
        () => !!window.Shopify,
        () => !!document.querySelector('link[href*="cdn.shopify.com"]'),
        () => !!document.querySelector('script[src*="cdn.shopify.com"]'),
        () => !!document.querySelector('[data-shopify]'),
        () => !!document.querySelector('meta[name="shopify-checkout-api-token"]'),
        () => document.documentElement.classList.contains('shopify-features')
      ],
      confidence: {
        high: 2, // Need at least 2 matches for high confidence
        medium: 1
      },
      knownPatterns: {
        predictiveSearch: 'predictive-search',
        quickAdd: '[data-quick-add]',
        sectionRendering: '[data-section-id]',
        productMedia: 'product-media, .product-media-container',
        drawer: 'cart-drawer, .drawer'
      },
      commonWidgets: ['klaviyo', 'yotpo', 'judgeme', 'stamped', 'afterpay', 'klarna', 'gorgias']
    },

    react: {
      name: 'React',
      category: 'spa',
      detectors: [
        () => !!window.React,
        () => !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
        () => !!document.querySelector('[data-reactroot]'),
        () => !!document.querySelector('[data-react-checksum]'),
        () => Array.from(document.querySelectorAll('body > *, #root > *, #app > *, [data-reactroot] > *')).some(el =>
          Object.keys(el).some(key => key.startsWith('__react'))
        )
      ],
      confidence: { high: 2, medium: 1 },
      knownPatterns: {
        portal: '[data-react-portal]',
        suspense: '.suspense-fallback'
      },
      commonWidgets: []
    },

    vue: {
      name: 'Vue.js',
      category: 'spa',
      detectors: [
        () => !!window.Vue,
        () => !!window.__VUE__,
        () => !!document.querySelector('[data-v-]'),
        () => !!document.querySelector('[v-cloak]'),
        () => Array.from(document.querySelectorAll('body > *, #app > *, [data-v-] > *')).some(el => el.__vue__)
      ],
      confidence: { high: 2, medium: 1 },
      knownPatterns: {},
      commonWidgets: []
    },

    angular: {
      name: 'Angular',
      category: 'spa',
      detectors: [
        () => !!window.ng,
        () => !!window.angular,
        () => !!document.querySelector('[ng-app]'),
        () => !!document.querySelector('[ng-controller]'),
        () => !!document.querySelector('app-root'),
        () => !!document.querySelector('[_ngcontent-]')
      ],
      confidence: { high: 2, medium: 1 },
      knownPatterns: {},
      commonWidgets: []
    },

    nextjs: {
      name: 'Next.js',
      category: 'spa',
      detectors: [
        () => !!window.__NEXT_DATA__,
        () => !!document.querySelector('#__next'),
        () => !!document.querySelector('script[src*="_next"]')
      ],
      confidence: { high: 2, medium: 1 },
      knownPatterns: {},
      commonWidgets: []
    },

    wordpress: {
      name: 'WordPress',
      category: 'cms',
      detectors: [
        () => !!document.querySelector('meta[name="generator"][content*="WordPress"]'),
        () => !!document.querySelector('link[href*="wp-content"]'),
        () => !!document.querySelector('script[src*="wp-includes"]'),
        () => document.body.classList.toString().includes('wp-')
      ],
      confidence: { high: 2, medium: 1 },
      knownPatterns: {
        woocommerce: '.woocommerce, .wc-block',
        elementor: '.elementor',
        gutenberg: '.wp-block-'
      },
      commonWidgets: []
    },

    woocommerce: {
      name: 'WooCommerce',
      category: 'ecommerce',
      detectors: [
        () => !!document.querySelector('.woocommerce'),
        () => !!document.querySelector('[class*="wc-"]'),
        () => !!window.wc_add_to_cart_params
      ],
      confidence: { high: 2, medium: 1 },
      knownPatterns: {},
      commonWidgets: []
    },

    bigcommerce: {
      name: 'BigCommerce',
      category: 'ecommerce',
      detectors: [
        () => !!window.BCData,
        () => !!document.querySelector('[data-content-region]'),
        () => !!document.querySelector('script[src*="bigcommerce"]')
      ],
      confidence: { high: 2, medium: 1 },
      knownPatterns: {},
      commonWidgets: []
    },

    squarespace: {
      name: 'Squarespace',
      category: 'cms',
      detectors: [
        () => !!window.Static,
        () => !!document.querySelector('[data-squarespace-cacheversion]'),
        () => !!document.querySelector('.sqs-block'),
        () => !!document.querySelector('script[src*="squarespace"]')
      ],
      confidence: { high: 2, medium: 1 },
      knownPatterns: {},
      commonWidgets: []
    },

    webflow: {
      name: 'Webflow',
      category: 'cms',
      detectors: [
        () => !!window.Webflow,
        () => !!document.querySelector('[data-wf-]'),
        () => !!document.querySelector('html.w-mod-js')
      ],
      confidence: { high: 2, medium: 1 },
      knownPatterns: {},
      commonWidgets: []
    }
  };

  const WIDGET_SIGNATURES = {
    yotpo: {
      name: 'Yotpo',
      category: 'reviews',
      detectors: [
        () => !!window.yotpo,
        () => !!document.querySelector('[class*="yotpo"]'),
        () => !!document.querySelector('[data-yotpo]'),
        () => !!document.querySelector('script[src*="yotpo"]')
      ],
      selectors: ['[class*="yotpo"]', '[data-yotpo]', '.yotpo-widget'],
      a11yNotes: 'Star ratings often use images without alt text; review forms may have label issues'
    },

    judgeme: {
      name: 'Judge.me',
      category: 'reviews',
      detectors: [
        () => !!window.jdgm,
        () => !!document.querySelector('[class*="jdgm"]'),
        () => !!document.querySelector('.jdgm-widget'),
        () => !!document.querySelector('script[src*="judgeme"]')
      ],
      selectors: ['[class*="jdgm"]', '.jdgm-widget', '.jdgm-rev'],
      a11yNotes: 'Review widgets may have contrast issues in default themes'
    },

    stamped: {
      name: 'Stamped.io',
      category: 'reviews',
      detectors: [
        () => !!window.StampedFn,
        () => !!document.querySelector('[class*="stamped"]'),
        () => !!document.querySelector('[data-stamped]'),
        () => !!document.querySelector('script[src*="stamped"]')
      ],
      selectors: ['[class*="stamped"]', '[data-stamped]'],
      a11yNotes: 'Similar issues to other review widgets'
    },

    trustpilot: {
      name: 'Trustpilot',
      category: 'reviews',
      detectors: [
        () => !!document.querySelector('[class*="trustpilot"]'),
        () => !!document.querySelector('[data-businessunit-id]'),
        () => !!document.querySelector('script[src*="trustpilot"]')
      ],
      selectors: ['[class*="trustpilot"]', '.tp-widget'],
      a11yNotes: 'Widget loaded in iframe, limited control'
    },

    klaviyo: {
      name: 'Klaviyo',
      category: 'email-marketing',
      detectors: [
        () => !!window._learnq,
        () => !!window.klaviyo,
        () => !!document.querySelector('[class*="klaviyo"]'),
        () => !!document.querySelector('script[src*="klaviyo"]'),
        () => !!document.querySelector('form[action*="klaviyo"]')
      ],
      selectors: ['[class*="klaviyo"]', '.klaviyo-form', '[data-klaviyo-form]'],
      a11yNotes: 'Popup forms may have focus trap issues; form labels vary'
    },

    mailchimp: {
      name: 'Mailchimp',
      category: 'email-marketing',
      detectors: [
        () => !!document.querySelector('[id*="mc_embed"]'),
        () => !!document.querySelector('form[action*="mailchimp"]'),
        () => !!document.querySelector('script[src*="mailchimp"]')
      ],
      selectors: ['[id*="mc_embed"]', '.mc-field-group'],
      a11yNotes: 'Embedded forms typically have good labeling'
    },

    gorgias: {
      name: 'Gorgias',
      category: 'support',
      detectors: [
        () => !!window.gorgias,
        () => !!document.querySelector('[id*="gorgias"]'),
        () => !!document.querySelector('[class*="gorgias"]'),
        () => !!document.querySelector('script[src*="gorgias"]')
      ],
      selectors: ['[id*="gorgias"]', '[class*="gorgias"]', '.gorgias-chat'],
      a11yNotes: 'Chat widgets typically have limited accessibility'
    },

    intercom: {
      name: 'Intercom',
      category: 'support',
      detectors: [
        () => !!window.Intercom,
        () => !!document.querySelector('[id*="intercom"]'),
        () => !!document.querySelector('.intercom-launcher'),
        () => !!document.querySelector('script[src*="intercom"]')
      ],
      selectors: ['[id*="intercom"]', '.intercom-launcher', '.intercom-messenger'],
      a11yNotes: 'Chat launcher button may lack proper labeling'
    },

    zendesk: {
      name: 'Zendesk',
      category: 'support',
      detectors: [
        () => !!window.zE,
        () => !!document.querySelector('[id*="zendesk"]'),
        () => !!document.querySelector('script[src*="zendesk"]')
      ],
      selectors: ['[id*="zendesk"]', '#launcher'],
      a11yNotes: 'Widget embedded in iframe'
    },

    afterpay: {
      name: 'Afterpay',
      category: 'payment',
      detectors: [
        () => !!window.Afterpay,
        () => !!document.querySelector('[class*="afterpay"]'),
        () => !!document.querySelector('afterpay-placement'),
        () => !!document.querySelector('script[src*="afterpay"]')
      ],
      selectors: ['[class*="afterpay"]', 'afterpay-placement', '.afterpay-paragraph'],
      a11yNotes: 'Info modals may have focus issues'
    },

    klarna: {
      name: 'Klarna',
      category: 'payment',
      detectors: [
        () => !!window.Klarna,
        () => !!document.querySelector('[class*="klarna"]'),
        () => !!document.querySelector('klarna-placement'),
        () => !!document.querySelector('script[src*="klarna"]')
      ],
      selectors: ['[class*="klarna"]', 'klarna-placement', '.klarna-widget'],
      a11yNotes: 'Payment messaging may lack proper semantics'
    },

    paypal: {
      name: 'PayPal',
      category: 'payment',
      detectors: [
        () => !!window.paypal,
        () => !!document.querySelector('[class*="paypal"]'),
        () => !!document.querySelector('[id*="paypal"]'),
        () => !!document.querySelector('script[src*="paypal"]')
      ],
      selectors: ['[class*="paypal"]', '[id*="paypal"]', '.paypal-button'],
      a11yNotes: 'Buttons typically accessible but loaded in iframe'
    },

    stripe: {
      name: 'Stripe',
      category: 'payment',
      detectors: [
        () => !!window.Stripe,
        () => !!document.querySelector('[class*="stripe"]'),
        () => !!document.querySelector('iframe[src*="stripe"]'),
        () => !!document.querySelector('script[src*="stripe"]')
      ],
      selectors: ['[class*="stripe"]', 'iframe[src*="stripe"]'],
      a11yNotes: 'Elements in iframe, limited control'
    },

    googleAnalytics: {
      name: 'Google Analytics',
      category: 'analytics',
      detectors: [
        () => !!window.ga,
        () => !!window.gtag,
        () => !!window.dataLayer,
        () => !!document.querySelector('script[src*="googletagmanager"]'),
        () => !!document.querySelector('script[src*="google-analytics"]')
      ],
      selectors: [],
      a11yNotes: 'No UI elements'
    },

    hotjar: {
      name: 'Hotjar',
      category: 'analytics',
      detectors: [
        () => !!window.hj,
        () => !!document.querySelector('script[src*="hotjar"]'),
        () => !!document.querySelector('[id*="_hj"]')
      ],
      selectors: ['[id*="_hj"]'],
      a11yNotes: 'Feedback widgets may have accessibility issues'
    },

    facebook: {
      name: 'Facebook Widget',
      category: 'social',
      detectors: [
        () => !!window.FB,
        () => !!document.querySelector('[class*="fb-"]'),
        () => !!document.querySelector('script[src*="facebook"]'),
        () => !!document.querySelector('iframe[src*="facebook"]')
      ],
      selectors: ['[class*="fb-"]', 'iframe[src*="facebook"]'],
      a11yNotes: 'Social plugins in iframe, no control'
    },

    instagram: {
      name: 'Instagram Widget',
      category: 'social',
      detectors: [
        () => !!document.querySelector('[class*="instagram"]'),
        () => !!document.querySelector('iframe[src*="instagram"]'),
        () => !!document.querySelector('script[src*="instagram"]')
      ],
      selectors: ['[class*="instagram"]', 'iframe[src*="instagram"]'],
      a11yNotes: 'Feed widgets may lack alt text for images'
    },

    recaptcha: {
      name: 'reCAPTCHA',
      category: 'security',
      detectors: [
        () => !!window.grecaptcha,
        () => !!document.querySelector('[class*="recaptcha"]'),
        () => !!document.querySelector('[id*="recaptcha"]'),
        () => !!document.querySelector('script[src*="recaptcha"]'),
        () => !!document.querySelector('iframe[src*="recaptcha"]')
      ],
      selectors: ['[class*="recaptcha"]', '[id*="recaptcha"]', 'iframe[src*="recaptcha"]'],
      a11yNotes: 'Google-controlled, has known accessibility issues'
    },

    hcaptcha: {
      name: 'hCaptcha',
      category: 'security',
      detectors: [
        () => !!window.hcaptcha,
        () => !!document.querySelector('[class*="h-captcha"]'),
        () => !!document.querySelector('script[src*="hcaptcha"]')
      ],
      selectors: ['[class*="h-captcha"]'],
      a11yNotes: 'Has accessibility mode'
    },

    cookiebot: {
      name: 'Cookiebot',
      category: 'consent',
      detectors: [
        () => !!window.Cookiebot,
        () => !!document.querySelector('[id*="CybotCookiebot"]'),
        () => !!document.querySelector('script[src*="cookiebot"]')
      ],
      selectors: ['[id*="CybotCookiebot"]', '#CybotCookiebotDialog'],
      a11yNotes: 'Banner accessibility varies by configuration'
    },

    onetrust: {
      name: 'OneTrust',
      category: 'consent',
      detectors: [
        () => !!window.OneTrust,
        () => !!document.querySelector('[id*="onetrust"]'),
        () => !!document.querySelector('script[src*="onetrust"]')
      ],
      selectors: ['[id*="onetrust"]', '#onetrust-banner-sdk'],
      a11yNotes: 'Generally well-structured accessibility'
    }
  };

  const FRAMEWORK_EXCEPTIONS = {
    shopify: [
      {
        id: 'shopify-predictive-search',
        pattern: {
          type: 'element-context',
          description: 'Shopify predictive search uses aria-live for results',
          checks: [
            { parent: 'predictive-search', condition: 'exists' }
          ]
        },
        wcag: ['4.1.3'],
        reason: 'Predictive search component handles live region updates',
        confidence: 85
      },
      {
        id: 'shopify-section-rendering',
        pattern: {
          type: 'selector-match',
          description: 'Shopify section rendering components',
          selectors: ['[data-section-id]', '[data-section-type]']
        },
        wcag: ['4.1.2'],
        reason: 'Section-rendered content managed by Shopify',
        confidence: 80
      },
      {
        id: 'shopify-product-media',
        pattern: {
          type: 'element-context',
          description: 'Shopify product media galleries',
          checks: [
            { parent: 'product-media, .product-media-container', condition: 'exists' }
          ]
        },
        wcag: ['1.1.1'],
        reason: 'Product media components often have custom accessibility patterns',
        confidence: 75
      }
    ],

    react: [
      {
        id: 'react-portal',
        pattern: {
          type: 'selector-match',
          description: 'React portal containers',
          selectors: ['[data-react-portal]', '[id*="portal"]']
        },
        wcag: ['1.3.1'],
        reason: 'React portals render outside normal DOM hierarchy',
        confidence: 80
      }
    ],

    vue: [
      {
        id: 'vue-transition',
        pattern: {
          type: 'selector-match',
          description: 'Vue transition elements',
          selectors: ['[class*="v-enter"]', '[class*="v-leave"]']
        },
        wcag: ['2.3.1'],
        reason: 'Vue transition states are temporary',
        confidence: 85
      }
    ]
  };

  function log(message, type = 'info') {
    const styles = {
      info: 'color: #2196F3',
      success: 'color: #4CAF50; font-weight: bold',
      warning: 'color: #FF9800',
      error: 'color: #f44336; font-weight: bold',
      profile: 'color: #9C27B0; font-weight: bold'
    };
    console.log(`%c${LOG_PREFIX} ${message}`, styles[type] || styles.info);
  }

  function safeDetect(detectorFn) {
    try {
      return detectorFn();
    } catch (e) {
      return false;
    }
  }

  function detectFramework() {
    const results = [];

    for (const [key, framework] of Object.entries(FRAMEWORK_SIGNATURES)) {
      let matches = 0;
      const matchedDetectors = [];

      for (let i = 0; i < framework.detectors.length; i++) {
        if (safeDetect(framework.detectors[i])) {
          matches++;
          matchedDetectors.push(i);
        }
      }

      if (matches > 0) {
        let confidence = 'low';
        if (matches >= framework.confidence.high) {
          confidence = 'high';
        } else if (matches >= framework.confidence.medium) {
          confidence = 'medium';
        }

        results.push({
          id: key,
          name: framework.name,
          category: framework.category,
          confidence,
          matchCount: matches,
          totalDetectors: framework.detectors.length,
          matchedDetectors,
          knownPatterns: framework.knownPatterns,
          commonWidgets: framework.commonWidgets
        });
      }
    }

    results.sort((a, b) => {
      const confOrder = { high: 0, medium: 1, low: 2 };
      if (confOrder[a.confidence] !== confOrder[b.confidence]) {
        return confOrder[a.confidence] - confOrder[b.confidence];
      }
      return b.matchCount - a.matchCount;
    });

    return results;
  }

  function detectWidgets() {
    const detected = [];

    for (const [key, widget] of Object.entries(WIDGET_SIGNATURES)) {
      let isPresent = false;
      let matchedDetectors = [];

      for (let i = 0; i < widget.detectors.length; i++) {
        if (safeDetect(widget.detectors[i])) {
          isPresent = true;
          matchedDetectors.push(i);
        }
      }

      if (isPresent) {
        let elementCount = 0;
        for (const selector of widget.selectors) {
          try {
            elementCount += document.querySelectorAll(selector).length;
          } catch (e) { /* Skip invalid selector */ }
        }

        detected.push({
          id: key,
          name: widget.name,
          category: widget.category,
          selectors: widget.selectors,
          elementCount,
          matchedDetectors,
          a11yNotes: widget.a11yNotes
        });
      }
    }

    detected.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    return detected;
  }

  function generateRecommendedExceptions(frameworks, widgets) {
    const exceptions = [];

    for (const framework of frameworks) {
      if (FRAMEWORK_EXCEPTIONS[framework.id]) {
        for (const exception of FRAMEWORK_EXCEPTIONS[framework.id]) {
          exceptions.push({
            ...exception,
            source: `framework:${framework.id}`,
            autoApplied: true
          });
        }
      }
    }

    for (const widget of widgets) {
      exceptions.push({
        id: `widget-${widget.id}`,
        pattern: {
          type: 'third-party',
          description: `${widget.name} widget elements`,
          selectorPatterns: widget.selectors
        },
        wcag: ['*'],
        reason: `Third-party ${widget.category} widget (${widget.name}) - outside client control`,
        confidence: 85,
        source: `widget:${widget.id}`,
        autoApplied: true,
        a11yNotes: widget.a11yNotes
      });
    }

    return exceptions;
  }

  function generateAuditRecommendations(profile) {
    const recommendations = [];

    if (profile.primaryFramework) {
      switch (profile.primaryFramework.id) {
        case 'shopify':
          recommendations.push({
            type: 'testing',
            message: 'Test with preview_theme_id parameter for staging themes',
            priority: 'high'
          });
          recommendations.push({
            type: 'focus',
            message: 'Pay special attention to quick-add buttons, cart drawer, and predictive search',
            priority: 'medium'
          });
          break;

        case 'react':
        case 'vue':
        case 'angular':
        case 'nextjs':
          recommendations.push({
            type: 'timing',
            message: 'Use waitForSelector option for SPA content loading',
            priority: 'high'
          });
          recommendations.push({
            type: 'testing',
            message: 'Dynamic content may require multiple audit passes',
            priority: 'medium'
          });
          break;
      }
    }

    const chatWidgets = profile.widgets.filter(w => w.category === 'support');
    if (chatWidgets.length > 0) {
      recommendations.push({
        type: 'manual',
        message: `Manual testing needed for chat widgets: ${chatWidgets.map(w => w.name).join(', ')}`,
        priority: 'medium'
      });
    }

    const paymentWidgets = profile.widgets.filter(w => w.category === 'payment');
    if (paymentWidgets.length > 0) {
      recommendations.push({
        type: 'scope',
        message: `Payment widgets are third-party: ${paymentWidgets.map(w => w.name).join(', ')} - flag but don't count as client issues`,
        priority: 'high'
      });
    }

    const reviewWidgets = profile.widgets.filter(w => w.category === 'reviews');
    if (reviewWidgets.length > 0) {
      recommendations.push({
        type: 'manual',
        message: `Review widgets often have star rating accessibility issues: ${reviewWidgets.map(w => w.name).join(', ')}`,
        priority: 'medium'
      });
    }

    return recommendations;
  }

  async function profileSite() {
    const startTime = performance.now();
    log('Profiling site...', 'profile');

    const frameworks = detectFramework();
    const primaryFramework = frameworks.length > 0 ? frameworks[0] : null;

    const widgets = detectWidgets();

    const recommendedExceptions = generateRecommendedExceptions(
      primaryFramework ? [primaryFramework] : [],
      widgets
    );

    const profile = {
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title,
      profiledAt: new Date().toISOString(),
      profilerVersion: PROFILER_VERSION,

      primaryFramework,
      allFrameworks: frameworks,
      isSPA: ['react', 'vue', 'angular', 'nextjs'].includes(primaryFramework?.id),
      isEcommerce: ['shopify', 'woocommerce', 'bigcommerce'].includes(primaryFramework?.id),

      widgets,
      widgetsByCategory: widgets.reduce((acc, w) => {
        if (!acc[w.category]) acc[w.category] = [];
        acc[w.category].push(w);
        return acc;
      }, {}),
      thirdPartyCount: widgets.length,

      recommendedExceptions,
      exceptionCount: recommendedExceptions.length,

      recommendations: generateAuditRecommendations({
        primaryFramework,
        widgets
      }),

      profilingTimeMs: Math.round(performance.now() - startTime)
    };

    log(`Profile complete in ${profile.profilingTimeMs}ms`, 'success');
    log(`Framework: ${primaryFramework?.name || 'Unknown'}`, 'info');
    log(`Widgets detected: ${widgets.length}`, 'info');
    log(`Recommended exceptions: ${recommendedExceptions.length}`, 'info');

    global.__a11ySiteProfile = profile;

    return profile;
  }

  function applyProfileExceptions(profile) {
    if (!profile?.recommendedExceptions) {
      log('No profile or exceptions to apply', 'warning');
      return false;
    }

    if (!global.addLearnedException) {
      log('Issue verifier not loaded - cannot apply exceptions', 'error');
      return false;
    }

    let applied = 0;
    for (const exception of profile.recommendedExceptions) {
      try {
        global.addLearnedException(exception);
        applied++;
      } catch (e) {
        log(`Failed to add exception ${exception.id}: ${e.message}`, 'error');
      }
    }

    log(`Applied ${applied} profile exceptions`, 'success');
    return applied;
  }

  function getProfileSummary() {
    const profile = global.__a11ySiteProfile;
    if (!profile) return 'No profile available. Run profileSite() first.';

    let summary = `Site Profile: ${profile.hostname}\n`;
    summary += `\n\n`;

    summary += `Framework: ${profile.primaryFramework?.name || 'Unknown'}\n`;
    if (profile.primaryFramework) {
      summary += `  Category: ${profile.primaryFramework.category}\n`;
      summary += `  Confidence: ${profile.primaryFramework.confidence}\n`;
    }
    summary += `\n`;

    summary += `Third-Party Widgets (${profile.widgets.length}):\n`;
    for (const [category, widgets] of Object.entries(profile.widgetsByCategory)) {
      summary += `  ${category}:\n`;
      for (const widget of widgets) {
        summary += `    - ${widget.name}`;
        if (widget.elementCount > 0) {
          summary += ` (${widget.elementCount} elements)`;
        }
        summary += `\n`;
      }
    }
    summary += `\n`;

    summary += `Recommendations (${profile.recommendations.length}):\n`;
    for (const rec of profile.recommendations) {
      summary += `  [${rec.priority.toUpperCase()}] ${rec.message}\n`;
    }
    summary += `\n`;

    summary += `Auto-Applied Exceptions: ${profile.exceptionCount}\n`;

    return summary;
  }

  function isShopify() {
    return safeDetect(() => !!window.Shopify) || 
           safeDetect(() => !!document.querySelector('script[src*="cdn.shopify.com"]'));
  }

  function isSPA() {
    const spaFrameworks = ['react', 'vue', 'angular', 'nextjs'];
    const frameworks = detectFramework();
    return frameworks.some(f => spaFrameworks.includes(f.id));
  }

  global.profileSite = profileSite;
  global.applyProfileExceptions = applyProfileExceptions;
  global.getProfileSummary = getProfileSummary;
  global.detectFramework = detectFramework;
  global.detectWidgets = detectWidgets;
  global.isShopify = isShopify;
  global.isSPA = isSPA;

  global.a11yProfiler = {
    version: PROFILER_VERSION,
    profileSite,
    applyProfileExceptions,
    getProfileSummary,
    detectFramework,
    detectWidgets,
    isShopify,
    isSPA,
    FRAMEWORK_SIGNATURES,
    WIDGET_SIGNATURES,
    FRAMEWORK_EXCEPTIONS
  };

  log('Site Profiler loaded', 'success');

})(typeof window !== 'undefined' ? window : global);
