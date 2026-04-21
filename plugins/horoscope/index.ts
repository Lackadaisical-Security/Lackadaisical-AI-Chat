import { Plugin, PluginContext } from '../../../backend/src/types';

interface HoroscopeData {
  sign: string;
  date: string;
  horoscope: string;
  compatibility: string;
  mood: string;
  luckyNumber: number;
  luckyColor: string;
}

interface HoroscopeConfig {
  defaultSign?: string;
  includeCompatibility?: boolean;
  includeLuckyDetails?: boolean;
}

class HoroscopePlugin implements Plugin {
  name = 'horoscope';
  version = '2.0.0-rc1';
  description = 'Get daily horoscopes and astrological insights';
  author = 'Lackadaisical Security';
  permissions = ['network'];
  enabled = true;
  config: HoroscopeConfig = {};

  private zodiacSigns = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
  ];

  private compatibilitySigns = {
    aries: ['leo', 'sagittarius', 'gemini'],
    taurus: ['virgo', 'capricorn', 'cancer'],
    gemini: ['libra', 'aquarius', 'aries'],
    cancer: ['scorpio', 'pisces', 'taurus'],
    leo: ['aries', 'sagittarius', 'libra'],
    virgo: ['taurus', 'capricorn', 'scorpio'],
    libra: ['gemini', 'aquarius', 'leo'],
    scorpio: ['cancer', 'pisces', 'virgo'],
    sagittarius: ['aries', 'leo', 'aquarius'],
    capricorn: ['taurus', 'virgo', 'pisces'],
    aquarius: ['gemini', 'libra', 'sagittarius'],
    pisces: ['cancer', 'scorpio', 'capricorn']
  };

  private luckyColors = [
    'red', 'orange', 'yellow', 'green', 'blue', 'purple',
    'pink', 'white', 'black', 'gold', 'silver', 'turquoise'
  ];

  async init(config: HoroscopeConfig): Promise<void> {
    this.config = config;
  }

  async execute(input: any, context: PluginContext): Promise<any> {
    const { sign, type = 'daily' } = input;

    if (!sign || !this.zodiacSigns.includes(sign.toLowerCase())) {
      return {
        error: 'Invalid zodiac sign',
        availableSigns: this.zodiacSigns,
        suggestion: 'Use one of the available zodiac signs'
      };
    }

    try {
      const targetSign = sign.toLowerCase();

      if (type === 'daily') {
        return await this.getDailyHoroscope(targetSign);
      } else if (type === 'compatibility') {
        return await this.getCompatibility(targetSign);
      } else if (type === 'lucky') {
        return await this.getLuckyDetails(targetSign);
      } else {
        return {
          error: 'Invalid horoscope type',
          availableTypes: ['daily', 'compatibility', 'lucky']
        };
      }
    } catch (error) {
      return {
        error: 'Failed to generate horoscope',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getDailyHoroscope(sign: string): Promise<HoroscopeData> {
    const date = new Date().toISOString().split('T')[0];
    
    // Generate a deterministic horoscope based on sign and date
    const seed = this.generateSeed(sign, date);
    const horoscope = this.generateHoroscopeText(sign, seed);
    const mood = this.generateMood(seed);
    const luckyNumber = this.generateLuckyNumber(seed);
    const luckyColor = this.generateLuckyColor(seed);

    return {
      sign: sign.charAt(0).toUpperCase() + sign.slice(1),
      date,
      horoscope,
      compatibility: this.compatibilitySigns[sign as keyof typeof this.compatibilitySigns]?.join(', ') || '',
      mood,
      luckyNumber,
      luckyColor
    };
  }

  private async getCompatibility(sign: string): Promise<any> {
    const compatibleSigns = this.compatibilitySigns[sign as keyof typeof this.compatibilitySigns] || [];
    
    return {
      sign: sign.charAt(0).toUpperCase() + sign.slice(1),
      compatibleSigns,
      compatibilityScore: Math.floor(Math.random() * 30) + 70, // 70-100%
      advice: this.generateCompatibilityAdvice(sign, compatibleSigns)
    };
  }

  private async getLuckyDetails(sign: string): Promise<any> {
    const seed = this.generateSeed(sign, new Date().toISOString().split('T')[0]);
    
    return {
      sign: sign.charAt(0).toUpperCase() + sign.slice(1),
      luckyNumber: this.generateLuckyNumber(seed),
      luckyColor: this.generateLuckyColor(seed),
      luckyDay: this.generateLuckyDay(seed),
      luckyTime: this.generateLuckyTime(seed)
    };
  }

  private generateSeed(sign: string, date: string): number {
    let hash = 0;
    const str = sign + date;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }

  private generateHoroscopeText(sign: string, seed: number): string {
    const horoscopeTemplates = [
      `Today brings exciting opportunities for ${sign}. Trust your intuition and embrace new challenges with confidence.`,
      `The stars align in your favor today, ${sign}. Focus on your goals and don't be afraid to take calculated risks.`,
      `A day of reflection and growth awaits you, ${sign}. Take time to connect with your inner wisdom and spiritual side.`,
      `Your natural charisma shines brightly today, ${sign}. Use your charm to build meaningful connections and relationships.`,
      `The universe supports your creative endeavors today, ${sign}. Express yourself freely and let your imagination soar.`,
      `A balanced approach will serve you well today, ${sign}. Find harmony between work and personal life.`,
      `Your determination and persistence pay off today, ${sign}. Keep pushing forward toward your dreams.`,
      `Embrace change and transformation today, ${sign}. Let go of what no longer serves your highest good.`,
      `Your adventurous spirit leads you to exciting discoveries today, ${sign}. Explore new territories and expand your horizons.`,
      `Patience and discipline bring rewards today, ${sign}. Trust the process and stay committed to your path.`
    ];

    const index = seed % horoscopeTemplates.length;
    return horoscopeTemplates[index];
  }

  private generateMood(seed: number): string {
    const moods = ['optimistic', 'contemplative', 'energetic', 'peaceful', 'adventurous', 'focused', 'creative', 'balanced'];
    return moods[seed % moods.length];
  }

  private generateLuckyNumber(seed: number): number {
    return (seed % 99) + 1; // 1-99
  }

  private generateLuckyColor(seed: number): string {
    return this.luckyColors[seed % this.luckyColors.length];
  }

  private generateLuckyDay(seed: number): string {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[seed % days.length];
  }

  private generateLuckyTime(seed: number): string {
    const hours = seed % 24;
    const minutes = (seed * 7) % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private generateCompatibilityAdvice(sign: string, compatibleSigns: string[]): string {
    const adviceTemplates = [
      `Focus on building relationships with ${compatibleSigns.join(', ')} for the best harmony.`,
      `Your natural chemistry with ${compatibleSigns[0]} and ${compatibleSigns[1]} creates powerful connections.`,
      `Seek out ${compatibleSigns.join(' and ')} for meaningful partnerships and friendships.`,
      `The stars favor your interactions with ${compatibleSigns.join(', ')} this season.`
    ];

    const seed = this.generateSeed(sign, new Date().toISOString().split('T')[0]);
    return adviceTemplates[seed % adviceTemplates.length];
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for this plugin
  }
}

export default new HoroscopePlugin(); 