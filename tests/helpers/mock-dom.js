/**
 * Mock DOM factory for tests that need DOM APIs (jsdom-based).
 *
 * Usage:
 *   const { window, document } = createMockDOM('<div id="test">Hello</div>');
 */

import { JSDOM } from 'jsdom';

/**
 * Create a jsdom instance with the given HTML.
 * Returns window and document objects that can be injected into the sandbox.
 *
 * @param {string} html - HTML content for the document
 * @param {Object} options - jsdom options
 * @returns {{ window: Object, document: Object, dom: JSDOM }}
 */
export function createMockDOM(html = '<!DOCTYPE html><html><body></body></html>', options = {}) {
  const dom = new JSDOM(html, {
    url: 'https://example.com',
    pretendToBeVisual: true,
    ...options,
  });

  return {
    window: dom.window,
    document: dom.window.document,
    dom,
  };
}

/**
 * Create DOM overrides suitable for passing to loadScript().
 * Provides window, document, getComputedStyle, HTMLElement, Element, Node, etc.
 *
 * @param {string} html - HTML content
 * @returns {Object} Override properties for the sandbox
 */
export function createDOMOverrides(html) {
  const { window, document } = createMockDOM(html);

  return {
    window,
    document,
    getComputedStyle: window.getComputedStyle.bind(window),
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    NodeList: window.NodeList,
  };
}
