/**
 * WebSearchService - Fully functional web search integration
 * Connects to the existing WebFetcher service and integrates with AI chat
 * for automatic search triggering, result synthesis, and deep research.
 */

import { WebFetcher, SearchResult, FetchedContent, SearchOptions } from './WebFetcher';
import { aiLogger } from '../utils/logger';
import { config } from '../config/settings';

export interface WebSearchResponse {
  query: string;
  results: SearchResult[];
  synthesizedAnswer?: string;
  sourcesUsed: string[];
  fetchedContent: FetchedContent[];
  provider: string;
  searchTimeMs: number;
  totalResults: number;
}

export interface DeepResearchConfig {
  maxDepth: number;           // How many levels deep to research
  maxSources: number;         // Max number of sources to consult
  steeringPrompt?: string;    // User-provided research direction
  focusAreas?: string[];      // Specific areas to focus on
  excludeDomains?: string[];  // Domains to exclude
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  synthesize: boolean;        // Whether to produce a synthesis
}

export interface ResearchProgress {
  stage: 'searching' | 'fetching' | 'analyzing' | 'synthesizing' | 'complete';
  currentStep: number;
  totalSteps: number;
  currentQuery?: string;
  sourcesFound: number;
  sourcesFetched: number;
  message: string;
}

export class WebSearchService {
  private webFetcher: WebFetcher;

  constructor() {
    this.webFetcher = new WebFetcher();
  }

  /**
   * Perform a web search and return results with fetched content
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<WebSearchResponse> {
    const startTime = Date.now();
    aiLogger.info('WebSearchService: Starting search', { query, options });

    try {
      // Perform the search
      const searchResult = await this.webFetcher.search(query, {
        maxResults: options.maxResults || config.webSearch?.maxResults || 10,
        timeRange: options.timeRange || 'all',
        language: options.language || 'en',
        safeSearch: options.safeSearch !== false,
      });

      // Fetch content from top results (limit to top 3 for speed)
      const fetchedContent: FetchedContent[] = [];
      const topResults = searchResult.results.slice(0, 3);

      for (const result of topResults) {
        try {
          const content = await this.webFetcher.fetchPage(result.url, {
            extractMainContent: true,
            includeLinks: false,
            includeImages: false,
            maxContentLength: 5000,
            timeout: 10000,
          });
          if (content) {
            fetchedContent.push(content);
          }
        } catch (error) {
          aiLogger.warn(`Failed to fetch content from ${result.url}:`, error);
        }
      }

      const response: WebSearchResponse = {
        query,
        results: searchResult.results,
        sourcesUsed: fetchedContent.map(c => c.url),
        fetchedContent,
        provider: searchResult.provider,
        searchTimeMs: Date.now() - startTime,
        totalResults: searchResult.totalResults,
      };

      aiLogger.info('WebSearchService: Search complete', {
        query,
        resultCount: searchResult.results.length,
        fetchedCount: fetchedContent.length,
        timeMs: response.searchTimeMs,
      });

      return response;
    } catch (error) {
      aiLogger.error('WebSearchService: Search failed', { query, error });
      throw error;
    }
  }

  /**
   * Deep research with steering - multi-step research pipeline
   */
  async deepResearch(
    initialQuery: string,
    researchConfig: DeepResearchConfig,
    onProgress?: (progress: ResearchProgress) => void
  ): Promise<{
    query: string;
    steeringPrompt?: string;
    phases: Array<{
      query: string;
      results: SearchResult[];
      fetchedContent: FetchedContent[];
    }>;
    allSources: string[];
    totalSourcesFetched: number;
    researchTimeMs: number;
    synthesisContext: string;
  }> {
    const startTime = Date.now();
    const phases: Array<{
      query: string;
      results: SearchResult[];
      fetchedContent: FetchedContent[];
    }> = [];
    const allSources = new Set<string>();
    let totalFetched = 0;

    const maxDepth = Math.min(researchConfig.maxDepth || 3, 5);
    const maxSources = researchConfig.maxSources || 10;

    // Phase 1: Initial broad search
    const notify = (progress: ResearchProgress) => {
      if (onProgress) onProgress(progress);
    };

    notify({
      stage: 'searching',
      currentStep: 1,
      totalSteps: maxDepth + 1,
      currentQuery: initialQuery,
      sourcesFound: 0,
      sourcesFetched: 0,
      message: `Searching: ${initialQuery}`,
    });

    // Build queries based on steering
    const queries = [initialQuery];
    if (researchConfig.steeringPrompt) {
      queries.push(`${initialQuery} ${researchConfig.steeringPrompt}`);
    }
    if (researchConfig.focusAreas) {
      for (const area of researchConfig.focusAreas.slice(0, 3)) {
        queries.push(`${initialQuery} ${area}`);
      }
    }

    // Execute research phases
    for (let depth = 0; depth < Math.min(queries.length, maxDepth); depth++) {
      const query = queries[depth];
      if (!query) continue;

      notify({
        stage: 'searching',
        currentStep: depth + 1,
        totalSteps: maxDepth + 1,
        currentQuery: query,
        sourcesFound: allSources.size,
        sourcesFetched: totalFetched,
        message: `Research phase ${depth + 1}: ${query}`,
      });

      try {
        const searchResult = await this.webFetcher.search(query, {
          maxResults: Math.ceil(maxSources / maxDepth),
          timeRange: researchConfig.timeRange || 'all',
        });

        const fetchedContent: FetchedContent[] = [];

        notify({
          stage: 'fetching',
          currentStep: depth + 1,
          totalSteps: maxDepth + 1,
          currentQuery: query,
          sourcesFound: searchResult.results.length,
          sourcesFetched: totalFetched,
          message: `Fetching content from ${searchResult.results.length} sources...`,
        });

        // Fetch content from results (skip already-fetched URLs)
        for (const result of searchResult.results) {
          if (allSources.has(result.url)) continue;
          if (totalFetched >= maxSources) break;

          // Check excluded domains
          if (researchConfig.excludeDomains) {
            const domain = new URL(result.url).hostname;
            if (researchConfig.excludeDomains.some(d => domain.includes(d))) continue;
          }

          try {
            const content = await this.webFetcher.fetchPage(result.url, {
              extractMainContent: true,
              maxContentLength: 8000,
              timeout: 15000,
            });
            if (content) {
              fetchedContent.push(content);
              allSources.add(result.url);
              totalFetched++;
            }
          } catch (err) {
            aiLogger.warn(`Deep research: Failed to fetch ${result.url}`);
          }
        }

        phases.push({
          query,
          results: searchResult.results,
          fetchedContent,
        });

        // Analyze fetched content for follow-up queries
        if (depth < maxDepth - 1 && fetchedContent.length > 0) {
          // Extract potential follow-up terms from content
          const contentText = fetchedContent.map(c => c.content).join(' ');
          const followUpTerms = this.extractKeyTerms(contentText, initialQuery);
          if (followUpTerms.length > 0) {
            const nextQuery = `${initialQuery} ${followUpTerms.slice(0, 2).join(' ')}`;
            if (!queries.includes(nextQuery)) {
              queries.push(nextQuery);
            }
          }
        }
      } catch (error) {
        aiLogger.warn(`Deep research phase ${depth + 1} failed:`, error);
      }
    }

    // Build synthesis context from all fetched content
    notify({
      stage: 'synthesizing',
      currentStep: maxDepth + 1,
      totalSteps: maxDepth + 1,
      sourcesFound: allSources.size,
      sourcesFetched: totalFetched,
      message: 'Building research synthesis...',
    });

    let synthesisContext = '';
    if (researchConfig.synthesize) {
      synthesisContext = this.buildSynthesisContext(phases, initialQuery, researchConfig.steeringPrompt);
    }

    notify({
      stage: 'complete',
      currentStep: maxDepth + 1,
      totalSteps: maxDepth + 1,
      sourcesFound: allSources.size,
      sourcesFetched: totalFetched,
      message: `Research complete: ${allSources.size} sources analyzed`,
    });

    return {
      query: initialQuery,
      steeringPrompt: researchConfig.steeringPrompt,
      phases,
      allSources: Array.from(allSources),
      totalSourcesFetched: totalFetched,
      researchTimeMs: Date.now() - startTime,
      synthesisContext,
    };
  }

  /**
   * Extract key terms from content for follow-up research
   */
  private extractKeyTerms(content: string, originalQuery: string): string[] {
    const originalWords = new Set(originalQuery.toLowerCase().split(/\s+/));
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
      'that', 'this', 'these', 'those', 'it', 'its', 'they', 'them',
      'their', 'we', 'us', 'our', 'you', 'your', 'he', 'she', 'him',
      'her', 'his', 'not', 'no', 'nor', 'so', 'if', 'then', 'than',
      'more', 'most', 'very', 'also', 'just', 'about', 'which', 'when',
      'where', 'who', 'what', 'how', 'why', 'all', 'each', 'every',
    ]);

    // Count word frequency, filtering common words
    const wordCount = new Map<string, number>();
    const words = content.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      const cleaned = word.replace(/[^a-z0-9-]/g, '');
      if (
        cleaned.length > 4 &&
        !stopWords.has(cleaned) &&
        !originalWords.has(cleaned) &&
        !/^\d+$/.test(cleaned)
      ) {
        wordCount.set(cleaned, (wordCount.get(cleaned) || 0) + 1);
      }
    }

    // Return top terms by frequency
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Build a synthesis context from research phases for AI consumption
   */
  private buildSynthesisContext(
    phases: Array<{
      query: string;
      results: SearchResult[];
      fetchedContent: FetchedContent[];
    }>,
    originalQuery: string,
    steeringPrompt?: string
  ): string {
    let context = `Research synthesis for: "${originalQuery}"\n`;
    if (steeringPrompt) {
      context += `Research direction: ${steeringPrompt}\n`;
    }
    context += `\n--- Sources Analyzed ---\n\n`;

    for (const phase of phases) {
      for (const content of phase.fetchedContent) {
        context += `Source: ${content.title}\n`;
        context += `URL: ${content.url}\n`;
        if (content.metadata.publishDate) {
          context += `Published: ${content.metadata.publishDate}\n`;
        }
        // Truncate content to reasonable length
        const truncated = content.content.substring(0, 3000);
        context += `Content:\n${truncated}\n\n---\n\n`;
      }
    }

    return context;
  }

  /**
   * Determine if a user message should trigger a web search
   */
  shouldTriggerSearch(message: string): boolean {
    const searchTriggers = [
      /\bsearch\s+(for|the\s+web|online|internet)\b/i,
      /\blook\s+up\b/i,
      /\bfind\s+(me|out|information)\b/i,
      /\bwhat\s+is\s+the\s+(latest|current|recent)\b/i,
      /\bwhat('s| is)\s+happening\b/i,
      /\bnews\s+about\b/i,
      /\btell\s+me\s+about\b/i,
      /\bweb\s*search\b/i,
      /\bgoogle\b/i,
      /\bhow\s+to\b/i,
      /\bwhat\s+are\s+the\s+best\b/i,
    ];

    return searchTriggers.some(pattern => pattern.test(message));
  }

  /**
   * Determine if a message should trigger deep research
   */
  shouldTriggerDeepResearch(message: string): boolean {
    const researchTriggers = [
      /\bdeep\s*research\b/i,
      /\bresearch\s+(thoroughly|in.?depth|comprehensively)\b/i,
      /\banalyze\s+(thoroughly|in.?depth)\b/i,
      /\bcomprehensive\s+(analysis|review|report)\b/i,
      /\binvestigate\b/i,
    ];

    return researchTriggers.some(pattern => pattern.test(message));
  }

  /**
   * Extract search query from a user message
   */
  extractSearchQuery(message: string): string {
    // Remove common prefixes
    let query = message
      .replace(/^(please\s+)?(search\s+(for|the\s+web|online|internet)|look\s+up|find\s+(me|out|information\s+about)|google|web\s*search)\s*/i, '')
      .replace(/^(what\s+is\s+the\s+(latest|current|recent)\s+(news|information|data)\s+(on|about))\s*/i, '')
      .replace(/^(tell\s+me\s+about)\s*/i, '')
      .replace(/^(how\s+to)\s*/i, 'how to ')
      .trim();

    // If nothing remains, use the original message
    if (query.length < 3) {
      query = message;
    }

    return query;
  }
}

export const webSearchService = new WebSearchService();
export default webSearchService;
