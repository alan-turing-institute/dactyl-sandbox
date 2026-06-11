/**
 * Tests for premium.js — runs under Node (testEnvironment: node).
 * We provide minimal localStorage and document stubs so the UMD module works
 * without a browser or jsdom.
 */

// Minimal localStorage stub
let store = {};
const localStorageStub = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { store = {}; },
};

// Minimal document.createElement stub — returns a lightweight node-like object.
function makeElement(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    _className: '',
    dataset: {},
    children: [],
    _parent: null,
    _listeners: {},
    _attrs: {},
    get className() { return this._className; },
    set className(v) {
      this._className = v;
      this._classSet = new Set(v ? v.split(/\s+/).filter(Boolean) : []);
    },
    get classList() {
      const self = this;
      return {
        add(c) {
          self._classSet = self._classSet || new Set();
          self._classSet.add(c);
          self._className = [...self._classSet].join(' ');
        },
        contains(c) {
          return (self._classSet || new Set()).has(c);
        },
      };
    },
    setAttribute(name, val) { this._attrs[name] = val; },
    getAttribute(name) { return this._attrs[name] ?? null; },
    get textContent() { return this._text ?? ''; },
    set textContent(v) { this._text = v; },
    addEventListener(ev, fn) { this._listeners[ev] = fn; },
    append(...nodes) {
      for (const n of nodes) {
        if (n && typeof n === 'object') {
          n._parent = el;
          el.children.push(n);
        }
      }
    },
    remove() {
      if (this._parent) {
        this._parent.children = this._parent.children.filter((c) => c !== el);
        this._parent = null;
      }
    },
    querySelector(sel) {
      // Support .classname and .classname[data-attr="val"] selectors
      function matches(node, selector) {
        const attrMatch = selector.match(/^\.([^\[]+)\[data-([^\]=]+)="([^"]+)"\]$/);
        if (attrMatch) {
          const [, cls, attrKebab, attrVal] = attrMatch;
          const propKey = attrKebab.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
          return (node._classSet || new Set()).has(cls) && node.dataset && node.dataset[propKey] === attrVal;
        }
        if (selector.startsWith('.')) {
          return (node._classSet || new Set()).has(selector.slice(1));
        }
        return false;
      }
      function search(node) {
        for (const child of (node.children || [])) {
          if (matches(child, sel)) return child;
          const found = search(child);
          if (found) return found;
        }
        return null;
      }
      return search(el);
    },
  };
  // Initialise class set
  el._classSet = new Set();
  return el;
}

// Patch globals before requiring the module
global.localStorage = localStorageStub;
global.document = { createElement: (tag) => makeElement(tag) };

const { PREMIUM_FEATURES, createCallout, isDismissed, dismiss } = require('../premium');

describe('premium feature helpers', () => {
  beforeEach(() => {
    store = {};
  });

  test('exposes the expected premium feature keys', () => {
    expect(Object.keys(PREMIUM_FEATURES)).toEqual(
      expect.arrayContaining(['export', 'sharing', 'advancedReminders', 'analytics'])
    );
    expect(PREMIUM_FEATURES.export.id).toBe('export');
    expect(typeof PREMIUM_FEATURES.sharing.description).toBe('string');
  });

  test('isDismissed returns false before dismiss is called', () => {
    expect(isDismissed('export')).toBe(false);
    expect(isDismissed('sharing')).toBe(false);
  });

  test('dismiss sets the localStorage key so isDismissed returns true', () => {
    dismiss('export');
    expect(isDismissed('export')).toBe(true);
    expect(isDismissed('sharing')).toBe(false);
  });

  test('createCallout returns an aside element with badge, description, and dismiss button', () => {
    const el = createCallout('export');
    expect(el).not.toBeNull();
    expect(el.tagName.toLowerCase()).toBe('aside');
    expect(el.classList.contains('premium-callout')).toBe(true);
    expect(el.dataset.premiumFeature).toBe('export');

    const badge = el.querySelector('.premium-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Pro');

    const desc = el.querySelector('.premium-description');
    expect(desc).not.toBeNull();
    expect(desc.textContent).toBe(PREMIUM_FEATURES.export.description);

    const dismissBtn = el.querySelector('.premium-dismiss');
    expect(dismissBtn).not.toBeNull();
  });

  test('createCallout returns null for an already-dismissed feature', () => {
    dismiss('analytics');
    expect(createCallout('analytics')).toBeNull();
  });

  test('createCallout returns null for an unknown feature id', () => {
    expect(createCallout('nonexistent')).toBeNull();
  });

  test('clicking the dismiss button removes the element and persists dismissal', () => {
    const el = createCallout('sharing');
    // Simulate being in a parent
    const parent = makeElement('div');
    parent.children.push(el);
    el._parent = parent;

    const dismissBtn = el.querySelector('.premium-dismiss');
    expect(dismissBtn).not.toBeNull();
    // Simulate click event
    dismissBtn._listeners.click();

    expect(parent.children).not.toContain(el);
    expect(isDismissed('sharing')).toBe(true);
    expect(createCallout('sharing')).toBeNull();
  });
});
