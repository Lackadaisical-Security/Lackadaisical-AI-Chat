import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export interface PersonalityTraits {
  name: string;
  empathy: number; // 0-100
  humor: number; // 0-100
  creativity: number; // 0-100
  formality: number; // 0-100
  curiosity: number; // 0-100
  supportiveness: number; // 0-100
  playfulness: number; // 0-100
  wisdom: number; // 0-100
}

export interface MoodState {
  energy: number; // 0-100
  happiness: number; // 0-100
  engagement: number; // 0-100
  stress: number; // 0-100
  empathyLevel: number; // 0-100
  humorLevel: number; // 0-100
  lastUpdated: Date;
}

export interface PersonalityContext {
  sessionId: string;
  traits: PersonalityTraits;
  currentMood: MoodState;
  recentInteractions: Array<{
    sentiment: number;
    topic: string;
    timestamp: Date;
  }>;
  moodHistory: Array<{
    mood: MoodState;
    trigger: string;
    timestamp: Date;
  }>;
}

export class PersonalityService {
  private db: DatabaseService;
  private personalityCache: Map<string, PersonalityContext> = new Map();
  private basePersonalityPath: string;
  private defaultTraits: PersonalityTraits;

  constructor(db: DatabaseService, personalityPath: string = './config') {
    this.db = db;
    this.basePersonalityPath = personalityPath;
    this.defaultTraits = {
      name: 'Lackadaisical Companion',
      empathy: 85,
      humor: 70,
      creativity: 75,
      formality: 30,
      curiosity: 90,
      supportiveness: 95,
      playfulness: 60,
      wisdom: 80
    };
    this.initializePersonality();
  }

  private async initializePersonality(): Promise<void> {
    try {
      await fs.mkdir(this.basePersonalityPath, { recursive: true });
      
      // Ensure base personality.json exists
      const personalityFile = path.join(this.basePersonalityPath, 'personality.json');
      try {
        await fs.access(personalityFile);
      } catch {
        // Create default personality file
        await fs.writeFile(personalityFile, JSON.stringify({
          traits: this.defaultTraits,
          description: "A friendly, empathetic AI companion designed to be helpful and supportive while maintaining a casual, approachable personality.",
          version: "2.0.0-rc1"
        }, null, 2));
      }
      
      logger.info('Personality service initialized');
    } catch (error) {
      logger.error('Failed to initialize personality service:', error);
    }
  }

  /**
   * Load personality context for a session
   */
  async loadPersonality(sessionId: string): Promise<PersonalityContext> {
    try {
      if (this.personalityCache.has(sessionId)) {
        return this.personalityCache.get(sessionId)!;
      }

      // Load base traits from file
      const personalityFile = path.join(this.basePersonalityPath, 'personality.json');
      let traits = this.defaultTraits;
      
      try {
        const data = await fs.readFile(personalityFile, 'utf-8');
        const personalityData = JSON.parse(data);
        traits = { ...this.defaultTraits, ...personalityData.traits };
      } catch (error) {
        logger.warn('Using default personality traits:', error);
      }

      // Load session-specific mood state from database
      const moodResult = await this.db.executeQuery(`
        SELECT * FROM personality_state 
        WHERE session_id = ? OR session_id IS NULL 
        ORDER BY session_id IS NULL, last_updated DESC 
        LIMIT 1
      `, [sessionId]);

      let currentMood: MoodState;
      if (moodResult.data.length > 0) {
        const row = moodResult.data[0];
        currentMood = {
          energy: row.energy_level || 75,
          happiness: 70,
          engagement: 80,
          stress: 20,
          empathyLevel: row.empathy_level || traits.empathy,
          humorLevel: row.humor_level || traits.humor,
          lastUpdated: new Date(row.last_updated || Date.now())
        };
      } else {
        // Default mood based on traits
        currentMood = {
          energy: 75,
          happiness: 70,
          engagement: 80,
          stress: 20,
          empathyLevel: traits.empathy,
          humorLevel: traits.humor,
          lastUpdated: new Date()
        };
      }

      const context: PersonalityContext = {
        sessionId,
        traits,
        currentMood,
        recentInteractions: [],
        moodHistory: []
      };

      this.personalityCache.set(sessionId, context);
      return context;
    } catch (error) {
      logger.error(`Failed to load personality for session ${sessionId}:`, error);
      
      // Return default context as fallback
      const fallbackContext: PersonalityContext = {
        sessionId,
        traits: this.defaultTraits,
        currentMood: {
          energy: 75,
          happiness: 70,
          engagement: 80,
          stress: 20,
          empathyLevel: this.defaultTraits.empathy,
          humorLevel: this.defaultTraits.humor,
          lastUpdated: new Date()
        },
        recentInteractions: [],
        moodHistory: []
      };
      
      this.personalityCache.set(sessionId, fallbackContext);
      return fallbackContext;
    }
  }

  /**
   * Update mood based on sentiment and interaction
   */
  async updateMood(
    sessionId: string, 
    sentiment: number, 
    topic?: string,
    trigger?: string
  ): Promise<MoodState> {
    try {
      const context = await this.loadPersonality(sessionId);
      const oldMood = { ...context.currentMood };

      // Mood adjustment factors
      const sentimentImpact = sentiment * 10; // Scale sentiment to mood impact
      const timeFactor = this.calculateTimeDecay(context.currentMood.lastUpdated);
      
      // Update mood components based on sentiment and personality traits
      context.currentMood.happiness += sentimentImpact * (context.traits.empathy / 100) * 0.3;
      context.currentMood.engagement += Math.abs(sentimentImpact) * 0.2;
      context.currentMood.energy += sentimentImpact * 0.1;
      
      // Stress increases with negative sentiment, decreases with positive
      context.currentMood.stress -= sentimentImpact * 0.2;
      
      // Empathy and humor levels adjust based on recent interactions
      if (sentiment < -0.5) {
        // Increase empathy in response to negative sentiment
        context.currentMood.empathyLevel += 5;
      } else if (sentiment > 0.5) {
        // Increase humor in response to positive sentiment
        context.currentMood.humorLevel += 3;
      }

      // Apply constraints (0-100 range)
      context.currentMood.happiness = Math.max(0, Math.min(100, context.currentMood.happiness));
      context.currentMood.engagement = Math.max(0, Math.min(100, context.currentMood.engagement));
      context.currentMood.energy = Math.max(0, Math.min(100, context.currentMood.energy));
      context.currentMood.stress = Math.max(0, Math.min(100, context.currentMood.stress));
      context.currentMood.empathyLevel = Math.max(0, Math.min(100, context.currentMood.empathyLevel));
      context.currentMood.humorLevel = Math.max(0, Math.min(100, context.currentMood.humorLevel));

      // Apply time decay (mood naturally returns to baseline over time)
      const baselineReturnRate = 0.1 * timeFactor;
      context.currentMood.happiness += (70 - context.currentMood.happiness) * baselineReturnRate;
      context.currentMood.energy += (75 - context.currentMood.energy) * baselineReturnRate;
      context.currentMood.stress += (20 - context.currentMood.stress) * baselineReturnRate;

      context.currentMood.lastUpdated = new Date();

      // Track mood history
      context.moodHistory.push({
        mood: { ...context.currentMood },
        trigger: trigger || `sentiment: ${sentiment}`,
        timestamp: new Date()
      });

      // Keep only recent mood history (last 20 entries)
      if (context.moodHistory.length > 20) {
        context.moodHistory = context.moodHistory.slice(-20);
      }

      // Track recent interactions
      if (topic) {
        context.recentInteractions.push({
          sentiment,
          topic,
          timestamp: new Date()
        });

        // Keep only recent interactions (last 10)
        if (context.recentInteractions.length > 10) {
          context.recentInteractions = context.recentInteractions.slice(-10);
        }
      }

      // Save to database
      await this.saveMoodState(sessionId, context.currentMood);

      logger.debug(`Updated mood for session ${sessionId}:`, {
        oldMood: {
          happiness: oldMood.happiness.toFixed(1),
          energy: oldMood.energy.toFixed(1),
          stress: oldMood.stress.toFixed(1)
        },
        newMood: {
          happiness: context.currentMood.happiness.toFixed(1),
          energy: context.currentMood.energy.toFixed(1),
          stress: context.currentMood.stress.toFixed(1)
        }
      });

      return context.currentMood;
    } catch (error) {
      logger.error(`Failed to update mood for session ${sessionId}:`, error);
      throw error;
    }
  }

  private calculateTimeDecay(lastUpdate: Date): number {
    const now = new Date();
    const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    // Decay factor: more decay = faster return to baseline
    // Peaks at about 30 minutes, then levels off
    return Math.min(1, minutesSinceUpdate / 30);
  }

  /**
   * Generate personality-aware prompt decoration
   */
  async generatePromptContext(sessionId: string): Promise<string> {
    try {
      const context = await this.loadPersonality(sessionId);
      const { traits, currentMood } = context;

      // Build personality description
      const personalityElements: string[] = [];

      // Core traits
      personalityElements.push(`You are ${traits.name}, a helpful AI companion.`);

      // Personality traits affecting tone
      if (traits.empathy > 80) {
        personalityElements.push('You are deeply empathetic and emotionally attuned.');
      }
      
      if (traits.humor > 70) {
        personalityElements.push('You have a good sense of humor and enjoy light conversation.');
      }
      
      if (traits.creativity > 75) {
        personalityElements.push('You think creatively and offer unique perspectives.');
      }
      
      if (traits.formality < 40) {
        personalityElements.push('You maintain a casual, friendly tone.');
      }
      
      if (traits.curiosity > 80) {
        personalityElements.push('You are genuinely curious and ask thoughtful questions.');
      }
      
      if (traits.supportiveness > 90) {
        personalityElements.push('You are highly supportive and encouraging.');
      }

      // Current mood adjustments
      const moodElements: string[] = [];
      
      if (currentMood.happiness > 80) {
        moodElements.push('You are feeling particularly cheerful and optimistic.');
      } else if (currentMood.happiness < 40) {
        moodElements.push('You are feeling a bit subdued but still caring.');
      }
      
      if (currentMood.energy > 80) {
        moodElements.push('You have high energy and enthusiasm.');
      } else if (currentMood.energy < 40) {
        moodElements.push('You are feeling calm and contemplative.');
      }
      
      if (currentMood.stress > 60) {
        moodElements.push('You are being extra careful and thorough.');
      }
      
      if (currentMood.empathyLevel > traits.empathy + 10) {
        moodElements.push('You are feeling especially empathetic and understanding.');
      }
      
      if (currentMood.humorLevel > traits.humor + 10) {
        moodElements.push('You are in a particularly playful and humorous mood.');
      }

      // Recent context
      const contextElements: string[] = [];
      if (context.recentInteractions.length > 0) {
        const avgSentiment = context.recentInteractions.reduce((sum, int) => sum + int.sentiment, 0) / context.recentInteractions.length;
        
        if (avgSentiment > 0.3) {
          contextElements.push('The recent conversation has been positive and engaging.');
        } else if (avgSentiment < -0.3) {
          contextElements.push('The recent conversation has touched on some challenging topics.');
        }
      }

      // Combine all elements
      let promptContext = personalityElements.join(' ');
      
      if (moodElements.length > 0) {
        promptContext += ' Currently: ' + moodElements.join(' ');
      }
      
      if (contextElements.length > 0) {
        promptContext += ' Context: ' + contextElements.join(' ');
      }

      return promptContext;
    } catch (error) {
      logger.error(`Failed to generate prompt context for session ${sessionId}:`, error);
      return 'You are a helpful AI companion with a friendly, supportive personality.';
    }
  }

  /**
   * Save mood state to database
   */
  private async saveMoodState(sessionId: string, mood: MoodState): Promise<void> {
    try {
      await this.db.executeStatement(`
        INSERT OR REPLACE INTO personality_state 
        (id, session_id, traits, current_mood, energy_level, empathy_level, humor_level, last_updated)
        VALUES (
          COALESCE((SELECT id FROM personality_state WHERE session_id = ?), 1),
          ?, ?, ?, ?, ?, ?, ?
        )
      `, [
        sessionId,
        sessionId,
        JSON.stringify({}), // traits stored in file
        JSON.stringify(mood),
        mood.energy,
        mood.empathyLevel,
        mood.humorLevel,
        mood.lastUpdated.toISOString()
      ]);
    } catch (error) {
      logger.error(`Failed to save mood state for session ${sessionId}:`, error);
    }
  }

  /**
   * Get personality statistics
   */
  async getPersonalityStats(sessionId: string): Promise<{
    traits: PersonalityTraits;
    currentMood: MoodState;
    moodTrends: Array<{ date: string; happiness: number; energy: number; stress: number }>;
    avgSentiment: number;
  }> {
    try {
      const context = await this.loadPersonality(sessionId);
      
      // Calculate mood trends from history
      const moodTrends = context.moodHistory.slice(-7).map(entry => ({
        date: entry.timestamp.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        happiness: entry.mood.happiness,
        energy: entry.mood.energy,
        stress: entry.mood.stress
      }));

      // Calculate average sentiment from recent interactions
      const avgSentiment = context.recentInteractions.length > 0
        ? context.recentInteractions.reduce((sum, int) => sum + int.sentiment, 0) / context.recentInteractions.length
        : 0;

      return {
        traits: context.traits,
        currentMood: context.currentMood,
        moodTrends,
        avgSentiment
      };
    } catch (error) {
      logger.error(`Failed to get personality stats for session ${sessionId}:`, error);
      return {
        traits: this.defaultTraits,
        currentMood: {
          energy: 75,
          happiness: 70,
          engagement: 80,
          stress: 20,
          empathyLevel: 85,
          humorLevel: 70,
          lastUpdated: new Date()
        },
        moodTrends: [],
        avgSentiment: 0
      };
    }
  }

  /**
   * Update personality traits (admin function)
   */
  async updateTraits(sessionId: string, newTraits: Partial<PersonalityTraits>): Promise<void> {
    try {
      const context = await this.loadPersonality(sessionId);
      context.traits = { ...context.traits, ...newTraits };
      
      // Save to file (base personality)
      const personalityFile = path.join(this.basePersonalityPath, 'personality.json');
      const currentData = JSON.parse(await fs.readFile(personalityFile, 'utf-8'));
      currentData.traits = context.traits;
      await fs.writeFile(personalityFile, JSON.stringify(currentData, null, 2));
      
      logger.info(`Updated personality traits for session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to update traits for session ${sessionId}:`, error);
      throw error;
    }
  }
}
