/**
 * TrafficEmulatorService — Headless browser automation with anti-detection
 *
 * Provides multi-instance headless Chrome automation with:
 *   - Per-instance fingerprint randomization (UA, viewport, WebGL, canvas, etc.)
 *   - Proxy support (HTTP/HTTPS/SOCKS5, residential or datacenter)
 *   - Human-like behavior (mouse movement, typing delays, scrolling)
 *   - Stealth mode via puppeteer-extra-plugin-stealth
 *   - Sandboxed browser contexts per thread
 *   - Search engine navigation (Google, Bing, Yahoo, DuckDuckGo)
 *   - Content extraction from visited pages
 */

import { EventEmitter } from 'events';
import type { Browser, Page, BrowserContext } from 'puppeteer-core';
import { aiLogger } from '../utils/logger';
import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProxyConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks5';
  username?: string;
  password?: string;
}

export interface Fingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  platform: string;
  language: string;
  languages: string[];
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
  timezone: string;
  webglVendor: string;
  webglRenderer: string;
  screenResolution: { width: number; height: number };
}

export interface EmulatorSession {
  id: string;
  status: 'starting' | 'running' | 'navigating' | 'extracting' | 'idle' | 'stopped' | 'error';
  fingerprint: Fingerprint;
  proxy: ProxyConfig | null;
  startedAt: string;
  lastActivity: string;
  pagesVisited: number;
  currentUrl: string | null;
  errors: string[];
}

export interface SearchRequest {
  query: string;
  engine: 'google' | 'bing' | 'yahoo' | 'duckduckgo';
  maxResults?: number;
  extractContent?: boolean;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export interface EmulatorConfig {
  headless: boolean;
  maxInstances: number;
  defaultTimeout: number;
  navigationTimeout: number;
  proxyList: ProxyConfig[];
  chromePath?: string;
}

// ─── Fingerprint Database ────────────────────────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:134.0) Gecko/20100101 Firefox/134.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
  { width: 1280, height: 720 },
  { width: 3840, height: 2160 },
  { width: 1600, height: 900 },
  { width: 2560, height: 1080 },
];

const PLATFORMS = ['Win32', 'MacIntel', 'Linux x86_64'];
const LANGUAGES = ['en-US', 'en-GB', 'en-CA', 'en-AU', 'en'];
const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Singapore',
  'Australia/Sydney',
];
const WEBGL_VENDORS = ['Google Inc. (NVIDIA)', 'Google Inc. (AMD)', 'Google Inc. (Intel)', 'Apple'];
const WEBGL_RENDERERS = [
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (Apple, Apple M3 Pro, OpenGL 4.1)',
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
  'ANGLE (AMD, AMD Radeon Pro 5500M OpenGL Engine)',
];

// ─── Utility Functions ──────────────────────────────────────────────────────

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateFingerprint(): Fingerprint {
  const screen = randomChoice(SCREEN_RESOLUTIONS);
  const viewportWidth = Math.max(1024, screen.width - randomInt(0, 200));
  const viewportHeight = Math.max(600, screen.height - randomInt(80, 200));

  return {
    userAgent: randomChoice(USER_AGENTS),
    viewport: { width: viewportWidth, height: viewportHeight },
    platform: randomChoice(PLATFORMS),
    language: randomChoice(LANGUAGES),
    languages: [randomChoice(LANGUAGES), 'en'],
    hardwareConcurrency: randomChoice([4, 8, 12, 16]),
    deviceMemory: randomChoice([4, 8, 16, 32]),
    maxTouchPoints: 0,
    timezone: randomChoice(TIMEZONES),
    webglVendor: randomChoice(WEBGL_VENDORS),
    webglRenderer: randomChoice(WEBGL_RENDERERS),
    screenResolution: screen,
  };
}

// ─── Search Engine Selectors ────────────────────────────────────────────────

const SEARCH_ENGINES = {
  google: {
    url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    resultSelector: 'div.g',
    titleSelector: 'h3',
    linkSelector: 'a[href]',
    snippetSelector: 'div[data-sncf], div.VwiC3b',
    consentSelector: 'button#L2AGLb, form[action*="consent"] button',
  },
  bing: {
    url: (q: string) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    resultSelector: 'li.b_algo',
    titleSelector: 'h2 a',
    linkSelector: 'h2 a',
    snippetSelector: 'p, .b_caption p',
    consentSelector: '#bnp_btn_accept',
  },
  yahoo: {
    url: (q: string) => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
    resultSelector: 'div.algo-sr',
    titleSelector: 'h3 a',
    linkSelector: 'h3 a',
    snippetSelector: 'p.s-desc, div.compText',
    consentSelector: 'button[name="agree"]',
  },
  duckduckgo: {
    url: (q: string) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    resultSelector: 'article[data-testid="result"]',
    titleSelector: 'h2 a[data-testid="result-title-a"]',
    linkSelector: 'a[data-testid="result-title-a"]',
    snippetSelector: 'div[data-result="snippet"]',
    consentSelector: '',
  },
};

// ─── TrafficEmulatorService ─────────────────────────────────────────────────

export class TrafficEmulatorService extends EventEmitter {
  private sessions: Map<string, EmulatorSession> = new Map();
  private browsers: Map<string, Browser> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();
  private pages: Map<string, Page> = new Map();
  private config: EmulatorConfig;

  constructor(cfg?: Partial<EmulatorConfig>) {
    super();
    this.config = {
      headless: true,
      maxInstances: 5,
      defaultTimeout: 30000,
      navigationTimeout: 60000,
      proxyList: [],
      ...cfg,
    };
    aiLogger.info('TrafficEmulatorService initialized', {
      headless: this.config.headless,
      maxInstances: this.config.maxInstances,
    });
  }

  /**
   * Start a new emulator session with a unique fingerprint
   */
  async startSession(options?: {
    proxy?: ProxyConfig;
    fingerprint?: Partial<Fingerprint>;
  }): Promise<EmulatorSession> {
    if (this.sessions.size >= this.config.maxInstances) {
      throw new Error(`Maximum concurrent sessions reached (${this.config.maxInstances})`);
    }

    const sessionId = crypto.randomUUID();
    const fingerprint = { ...generateFingerprint(), ...options?.fingerprint };
    const proxy = options?.proxy || (this.config.proxyList.length > 0 ? randomChoice(this.config.proxyList) : null);

    const session: EmulatorSession = {
      id: sessionId,
      status: 'starting',
      fingerprint,
      proxy,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      pagesVisited: 0,
      currentUrl: null,
      errors: [],
    };
    this.sessions.set(sessionId, session);

    try {
      // Dynamic import to support optional dependency
      const puppeteerExtra = await import('puppeteer-extra');
      const StealthPlugin = await import('puppeteer-extra-plugin-stealth');
      const puppeteer = puppeteerExtra.default;
      puppeteer.use(StealthPlugin.default());

      // Build launch args
      const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        `--window-size=${fingerprint.screenResolution.width},${fingerprint.screenResolution.height}`,
      ];

      if (proxy) {
        const proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
        args.push(`--proxy-server=${proxyUrl}`);
      }

      const launchOptions: Record<string, unknown> = {
        headless: this.config.headless ? 'new' : false,
        args,
        defaultViewport: null,
        ignoreDefaultArgs: ['--enable-automation'],
      };

      if (this.config.chromePath) {
        launchOptions.executablePath = this.config.chromePath;
      }

      const browser = await puppeteer.launch(launchOptions);
      this.browsers.set(sessionId, browser);

      // Create incognito context for isolation
      const context = await browser.createBrowserContext();
      this.contexts.set(sessionId, context);

      const page = await context.newPage();
      this.pages.set(sessionId, page);

      // Apply fingerprint
      await this.applyFingerprint(page, fingerprint);

      // Handle proxy auth
      if (proxy?.username && proxy?.password) {
        await page.authenticate({ username: proxy.username, password: proxy.password });
      }

      // Set timeouts
      page.setDefaultTimeout(this.config.defaultTimeout);
      page.setDefaultNavigationTimeout(this.config.navigationTimeout);

      session.status = 'idle';
      session.lastActivity = new Date().toISOString();
      this.emit('session:started', { sessionId, fingerprint });

      aiLogger.info('Emulator session started', { sessionId, proxy: !!proxy });
      return session;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      session.status = 'error';
      session.errors.push(msg);
      aiLogger.error('Failed to start emulator session:', { sessionId, error: msg });
      // Clean up on failure
      await this.stopSession(sessionId);
      throw error;
    }
  }

  /**
   * Apply fingerprint to a page
   */
  private async applyFingerprint(page: Page, fp: Fingerprint): Promise<void> {
    await page.setUserAgent(fp.userAgent);
    await page.setViewport({
      width: fp.viewport.width,
      height: fp.viewport.height,
      deviceScaleFactor: 1,
    });

    // Override navigator properties via evaluateOnNewDocument
    // This code executes in the browser context where navigator, screen, etc. are available
    await page.evaluateOnNewDocument(`
      (function(fpData) {
        Object.defineProperty(navigator, 'platform', { get: function() { return fpData.platform; } });
        Object.defineProperty(navigator, 'languages', { get: function() { return fpData.languages; } });
        Object.defineProperty(navigator, 'language', { get: function() { return fpData.language; } });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: function() { return fpData.hardwareConcurrency; } });
        Object.defineProperty(navigator, 'deviceMemory', { get: function() { return fpData.deviceMemory; } });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: function() { return fpData.maxTouchPoints; } });
        Object.defineProperty(navigator, 'webdriver', { get: function() { return false; } });
        Object.defineProperty(screen, 'width', { get: function() { return fpData.screenResolution.width; } });
        Object.defineProperty(screen, 'height', { get: function() { return fpData.screenResolution.height; } });
        var getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return fpData.webglVendor;
          if (parameter === 37446) return fpData.webglRenderer;
          return getParameter.call(this, parameter);
        };
      })(${JSON.stringify(fp)})
    `);

    // Set timezone
    await page.emulateTimezone(fp.timezone);
  }

  /**
   * Simulate human-like behavior on a page
   */
  private async humanBehavior(page: Page): Promise<void> {
    // Random mouse movements
    const viewport = page.viewport();
    if (viewport) {
      for (let i = 0; i < randomInt(2, 5); i++) {
        const x = randomInt(100, viewport.width - 100);
        const y = randomInt(100, viewport.height - 100);
        await page.mouse.move(x, y, { steps: randomInt(5, 15) });
        await sleep(randomInt(50, 300));
      }
    }

    // Random scrolling
    const scrollAmount = randomInt(100, 500);
    await page.evaluate(`window.scrollBy({ top: ${scrollAmount}, behavior: 'smooth' })`);
    await sleep(randomInt(500, 1500));

    // Small random wait
    await sleep(randomInt(200, 800));
  }

  /**
   * Type text with human-like delays
   */
  private async humanType(page: Page, selector: string, text: string): Promise<void> {
    await page.click(selector);
    await sleep(randomInt(100, 400));

    for (const char of text) {
      await page.keyboard.type(char, { delay: randomInt(30, 150) });
    }

    await sleep(randomInt(200, 600));
  }

  /**
   * Navigate to a URL with human-like behavior
   */
  async navigate(sessionId: string, url: string): Promise<string> {
    const page = this.pages.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (!page || !session) throw new Error(`Session ${sessionId} not found`);

    session.status = 'navigating';
    session.currentUrl = url;
    session.lastActivity = new Date().toISOString();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.navigationTimeout });
      await sleep(randomInt(1000, 3000));
      await this.humanBehavior(page);

      session.pagesVisited++;
      session.status = 'idle';
      session.lastActivity = new Date().toISOString();

      // Extract page content
      const content = await page.evaluate(
        `(function() { var el = document.querySelector('body'); return el ? el.innerText.substring(0, 50000) : ''; })()`
      ) as string;

      return content;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      session.errors.push(msg);
      session.status = 'idle';
      throw error;
    }
  }

  /**
   * Perform a search on the specified engine and return results
   */
  async search(sessionId: string, request: SearchRequest): Promise<SearchResultItem[]> {
    const page = this.pages.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (!page || !session) throw new Error(`Session ${sessionId} not found`);

    const engine = SEARCH_ENGINES[request.engine];
    if (!engine) throw new Error(`Unsupported search engine: ${request.engine}`);

    session.status = 'navigating';
    session.lastActivity = new Date().toISOString();

    try {
      // Navigate to search engine
      const searchUrl = engine.url(request.query);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: this.config.navigationTimeout });
      await sleep(randomInt(1500, 4000));

      // Handle consent dialogs
      if (engine.consentSelector) {
        try {
          const consentBtn = await page.$(engine.consentSelector);
          if (consentBtn) {
            await consentBtn.click();
            await sleep(randomInt(1000, 2000));
          }
        } catch {
          // Consent dialog may not appear — this is expected
        }
      }

      await this.humanBehavior(page);

      // Extract search results
      session.status = 'extracting';
      const maxResults = request.maxResults || 10;

      const selectors = JSON.stringify({
        resultSelector: engine.resultSelector, titleSelector: engine.titleSelector,
        linkSelector: engine.linkSelector, snippetSelector: engine.snippetSelector,
      });

      const results: SearchResultItem[] = await page.evaluate(`
        (function() {
          var sel = ${selectors};
          var max = ${maxResults};
          var items = [];
          var elements = document.querySelectorAll(sel.resultSelector);
          for (var i = 0; i < Math.min(elements.length, max); i++) {
            var el = elements[i];
            var titleEl = el.querySelector(sel.titleSelector);
            var linkEl = el.querySelector(sel.linkSelector);
            var snippetEl = el.querySelector(sel.snippetSelector);
            if (titleEl && linkEl) {
              items.push({
                title: (titleEl.textContent || '').trim(),
                url: linkEl.href || '',
                snippet: (snippetEl ? snippetEl.textContent || '' : '').trim()
              });
            }
          }
          return items;
        })()
      `) as SearchResultItem[];

      session.pagesVisited++;
      session.status = 'idle';
      session.lastActivity = new Date().toISOString();

      // Optionally extract content from top results
      if (request.extractContent) {
        for (let i = 0; i < Math.min(results.length, 3); i++) {
          try {
            const content = await this.navigate(sessionId, results[i].url);
            results[i].content = content.substring(0, 10000);
            await sleep(randomInt(2000, 5000));
          } catch {
            results[i].content = '[Failed to extract content]';
          }
        }
      }

      this.emit('search:complete', { sessionId, query: request.query, resultCount: results.length });
      aiLogger.info('Search completed', { sessionId, engine: request.engine, results: results.length });
      return results;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      session.errors.push(msg);
      session.status = 'idle';
      aiLogger.error('Search failed:', { sessionId, error: msg });
      throw error;
    }
  }

  /**
   * Stop an emulator session and clean up resources
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) session.status = 'stopped';

    const page = this.pages.get(sessionId);
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
      this.pages.delete(sessionId);
    }

    const context = this.contexts.get(sessionId);
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
      this.contexts.delete(sessionId);
    }

    const browser = this.browsers.get(sessionId);
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
      this.browsers.delete(sessionId);
    }

    this.sessions.delete(sessionId);
    this.emit('session:stopped', { sessionId });
    aiLogger.info('Emulator session stopped', { sessionId });
  }

  /**
   * Get status of a session
   */
  getSession(sessionId: string): EmulatorSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): EmulatorSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Stop all sessions
   */
  async shutdown(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.allSettled(sessionIds.map(id => this.stopSession(id)));
    aiLogger.info('TrafficEmulatorService shut down, all sessions stopped');
  }
}

export const trafficEmulatorService = new TrafficEmulatorService();
export default trafficEmulatorService;
