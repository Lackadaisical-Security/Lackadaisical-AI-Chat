import { Router, Request, Response } from 'express';
import { DatabaseService, databaseService } from '../services/DatabaseService';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';
import { PersonalityState, MoodState } from '../types';
import { apiLogger } from '../utils/logger';
import { config } from '../config/settings';

const router = Router();

// Use the singleton database service instead of creating duplicate instances
const db = databaseService;

/**
 * GET /personality - Get current personality state
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const personalityState = await db.getPersonalityState();
    
    if (!personalityState) {
      // Initialize default personality state
      const defaultState: Partial<PersonalityState> = {
        name: config.personality.name,
        static_traits: config.personality.baseTraits,
        current_mood: {
          energy: 75,
          empathy: 80,
          humor: 70,
          curiosity: 85,
          patience: 90
        },
        energy_level: 75,
        empathy_level: 80,
        humor_level: 70,
        curiosity_level: 85,
        patience_level: 90,
        conversation_count: 0,
        total_interactions: 0,
        mood_history: [],
        learning_data: {},
        personality_version: '2.0.0-rc1'
      };

      await db.updatePersonalityState(defaultState);
      const newState = await db.getPersonalityState();
      
      res.json({
        personality: newState,
        message: 'Personality state initialized with defaults'
      });
    } else {
      res.json({
        personality: personalityState
      });
    }

  } catch (error) {
    apiLogger.error('Failed to get personality state:', error);
    throw error;
  }
}));

/**
 * PUT /personality - Update personality configuration
 */
router.put('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    
    // Validate updates
    if (updates.name && typeof updates.name !== 'string') {
      throw createValidationError('Name must be a string');
    }
    
    if (updates.static_traits && !Array.isArray(updates.static_traits)) {
      throw createValidationError('Static traits must be an array');
    }
    
    if (updates.current_mood && typeof updates.current_mood !== 'object') {
      throw createValidationError('Current mood must be an object');
    }

    // Validate mood values (0-100)
    if (updates.current_mood) {
      const moodFields = ['energy', 'empathy', 'humor', 'curiosity', 'patience'];
      for (const field of moodFields) {
        const value = updates.current_mood[field];
        if (value !== undefined && (typeof value !== 'number' || value < 0 || value > 100)) {
          throw createValidationError(`${field} must be a number between 0 and 100`);
        }
      }
    }

    // Update personality state
    await db.updatePersonalityState(updates);
    
    // Get updated state
    const updatedState = await db.getPersonalityState();
    
    apiLogger.info('Personality state updated', {
      updatedFields: Object.keys(updates),
      updatedBy: req.ip
    });

    res.json({
      personality: updatedState,
      message: 'Personality state updated successfully'
    });

  } catch (error) {
    apiLogger.error('Failed to update personality state:', error);
    throw error;
  }
}));

/**
 * GET /personality/mood - Get current mood state only
 */
router.get('/mood', asyncHandler(async (req: Request, res: Response) => {
  try {
    const personalityState = await db.getPersonalityState();
    
    if (!personalityState) {
      res.json({
        mood: {
          energy: 75,
          empathy: 80,
          humor: 70,
          curiosity: 85,
          patience: 90
        },
        message: 'Default mood state (personality not initialized)'
      });
    } else {
      res.json({
        mood: personalityState.current_mood,
        last_updated: personalityState.last_updated,
        total_interactions: personalityState.total_interactions
      });
    }

  } catch (error) {
    apiLogger.error('Failed to get mood state:', error);
    throw error;
  }
}));

/**
 * PUT /personality/mood - Update mood state
 */
router.put('/mood', asyncHandler(async (req: Request, res: Response) => {
  try {
    const moodUpdates = req.body;
    
    // Validate mood updates
    const validMoodFields = ['energy', 'empathy', 'humor', 'curiosity', 'patience'];
    const updates: Partial<MoodState> = {};
    
    for (const [key, value] of Object.entries(moodUpdates)) {
      if (!validMoodFields.includes(key)) {
        throw createValidationError(`Invalid mood field: ${key}`);
      }
      
      if (typeof value !== 'number' || value < 0 || value > 100) {
        throw createValidationError(`${key} must be a number between 0 and 100`);
      }
      
      (updates as any)[key] = value;
    }

    if (Object.keys(updates).length === 0) {
      throw createValidationError('No valid mood updates provided');
    }

    // Get current personality state
    const currentState = await db.getPersonalityState();
    if (!currentState) {
      throw createValidationError('Personality state not initialized');
    }

    // Merge mood updates
    const newMood = { ...currentState.current_mood, ...updates };
    
    // Update personality state
    await db.updatePersonalityState({
      current_mood: newMood,
      energy_level: newMood.energy,
      empathy_level: newMood.empathy,
      humor_level: newMood.humor,
      curiosity_level: newMood.curiosity,
      patience_level: newMood.patience
    });

    apiLogger.info('Mood state updated manually', {
      updates,
      updatedBy: req.ip
    });

    res.json({
      mood: newMood,
      message: 'Mood state updated successfully',
      updated_fields: Object.keys(updates)
    });

  } catch (error) {
    apiLogger.error('Failed to update mood state:', error);
    throw error;
  }
}));

/**
 * GET /personality/history - Get mood history
 */
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const personalityState = await db.getPersonalityState();
    
    if (!personalityState) {
      res.json({
        history: [],
        total: 0,
        message: 'No personality state found'
      });
      return;
    }

    const moodHistory = personalityState.mood_history || [];
    const limitedHistory = moodHistory.slice(-limit);

    res.json({
      history: limitedHistory,
      total: moodHistory.length,
      limit,
      current_mood: personalityState.current_mood
    });

  } catch (error) {
    apiLogger.error('Failed to get mood history:', error);
    throw error;
  }
}));

/**
 * POST /personality/reset - Reset personality to defaults
 */
router.post('/reset', asyncHandler(async (req: Request, res: Response) => {
  try {
    const resetType = req.body.type || 'mood'; // 'mood', 'traits', 'all'
    
    const currentState = await db.getPersonalityState();
    if (!currentState) {
      throw createValidationError('Personality state not initialized');
    }

    let updates: Partial<PersonalityState> = {};

    switch (resetType) {
      case 'mood':
        updates = {
          current_mood: {
            energy: 75,
            empathy: 80,
            humor: 70,
            curiosity: 85,
            patience: 90
          },
          energy_level: 75,
          empathy_level: 80,
          humor_level: 70,
          curiosity_level: 85,
          patience_level: 90
        };
        break;
        
      case 'traits':
        updates = {
          static_traits: config.personality.baseTraits,
          name: config.personality.name
        };
        break;
        
      case 'all':
        updates = {
          name: config.personality.name,
          static_traits: config.personality.baseTraits,
          current_mood: {
            energy: 75,
            empathy: 80,
            humor: 70,
            curiosity: 85,
            patience: 90
          },
          energy_level: 75,
          empathy_level: 80,
          humor_level: 70,
          curiosity_level: 85,
          patience_level: 90,
          mood_history: [],
          learning_data: {}
        };
        break;
        
      default:
        throw createValidationError('Invalid reset type. Use: mood, traits, or all');
    }

    await db.updatePersonalityState(updates);
    const updatedState = await db.getPersonalityState();

    apiLogger.info('Personality state reset', {
      resetType,
      updatedBy: req.ip
    });

    res.json({
      personality: updatedState,
      message: `Personality ${resetType} reset to defaults`,
      reset_type: resetType
    });

  } catch (error) {
    apiLogger.error('Failed to reset personality state:', error);
    throw error;
  }
}));

/**
 * GET /personality/traits - Get personality traits
 */
router.get('/traits', asyncHandler(async (req: Request, res: Response) => {
  try {
    const personalityState = await db.getPersonalityState();
    
    if (!personalityState) {
      res.json({
        traits: config.personality.baseTraits,
        message: 'Default traits (personality not initialized)'
      });
    } else {
      res.json({
        traits: personalityState.static_traits,
        name: personalityState.name,
        version: personalityState.personality_version
      });
    }

  } catch (error) {
    apiLogger.error('Failed to get personality traits:', error);
    throw error;
  }
}));

/**
 * PUT /personality/traits - Update personality traits
 */
router.put('/traits', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { traits, name } = req.body;
    
    if (traits && !Array.isArray(traits)) {
      throw createValidationError('Traits must be an array');
    }
    
    if (name && typeof name !== 'string') {
      throw createValidationError('Name must be a string');
    }

    // Validate traits
    if (traits) {
      for (const trait of traits) {
        if (typeof trait !== 'string' || trait.trim().length === 0) {
          throw createValidationError('All traits must be non-empty strings');
        }
      }
    }

    const updates: Partial<PersonalityState> = {};
    if (traits) updates.static_traits = traits.map((t: string) => t.trim());
    if (name) updates.name = name.trim();

    if (Object.keys(updates).length === 0) {
      throw createValidationError('No valid updates provided');
    }

    await db.updatePersonalityState(updates);
    const updatedState = await db.getPersonalityState();

    apiLogger.info('Personality traits updated', {
      updates: Object.keys(updates),
      updatedBy: req.ip
    });

    res.json({
      traits: updatedState?.static_traits,
      name: updatedState?.name,
      message: 'Personality traits updated successfully'
    });

  } catch (error) {
    apiLogger.error('Failed to update personality traits:', error);
    throw error;
  }
}));

/**
 * GET /personality/stats - Get personality statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const personalityState = await db.getPersonalityState();
    
    if (!personalityState) {
      res.json({
        stats: {
          total_interactions: 0,
          conversation_count: 0,
          mood_changes: 0,
          time_since_last_interaction: null
        },
        message: 'No personality state found'
      });
      return;
    }

    const moodHistory = personalityState.mood_history || [];
    const timeSinceLastInteraction = personalityState.last_interaction ? 
      Date.now() - new Date(personalityState.last_interaction).getTime() : null;

    res.json({
      stats: {
        total_interactions: personalityState.total_interactions,
        conversation_count: personalityState.conversation_count,
        mood_changes: moodHistory.length,
        time_since_last_interaction: timeSinceLastInteraction,
        last_updated: personalityState.last_updated,
        personality_version: personalityState.personality_version
      },
      current_state: {
        name: personalityState.name,
        mood_summary: {
          energy: personalityState.current_mood.energy,
          empathy: personalityState.current_mood.empathy,
          humor: personalityState.current_mood.humor,
          curiosity: personalityState.current_mood.curiosity,
          patience: personalityState.current_mood.patience
        }
      }
    });

  } catch (error) {
    apiLogger.error('Failed to get personality stats:', error);
    throw error;
  }
}));

export default router; 