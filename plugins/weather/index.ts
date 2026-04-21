import axios from 'axios';
import { Plugin, PluginContext } from '../../../backend/src/types';

interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  forecast: Array<{
    date: string;
    high: number;
    low: number;
    condition: string;
  }>;
  dataSource: 'live' | 'simulated';
}

interface WeatherConfig {
  apiKey?: string;
  defaultLocation?: string;
  units?: 'metric' | 'imperial';
  allowSimulatedData?: boolean;
}

class WeatherPlugin implements Plugin {
  name = 'weather';
  version = '2.0.0-rc1';
  description = 'Get current weather and forecasts for any location';
  author = 'Lackadaisical Security';
  permissions = ['network', 'location'];
  enabled = true;
  config: WeatherConfig = {};

  private apiKey: string | null = null;
  private defaultLocation = 'New York';
  private units: 'metric' | 'imperial' = 'metric';
  private allowSimulatedData = true;

  // Simulated weather data for various locations when API is unavailable
  private simulatedWeatherData: Record<string, {
    baseTemp: number;
    conditions: string[];
    humidity: [number, number];
    windSpeed: [number, number];
  }> = {
    'new york': { baseTemp: 15, conditions: ['Clear', 'Clouds', 'Rain'], humidity: [50, 70], windSpeed: [5, 15] },
    'los angeles': { baseTemp: 22, conditions: ['Clear', 'Clouds'], humidity: [40, 60], windSpeed: [3, 10] },
    'london': { baseTemp: 12, conditions: ['Clouds', 'Rain', 'Drizzle'], humidity: [60, 85], windSpeed: [8, 20] },
    'tokyo': { baseTemp: 18, conditions: ['Clear', 'Clouds', 'Rain'], humidity: [55, 75], windSpeed: [4, 12] },
    'paris': { baseTemp: 14, conditions: ['Clouds', 'Clear', 'Rain'], humidity: [55, 75], windSpeed: [5, 15] },
    'sydney': { baseTemp: 20, conditions: ['Clear', 'Clouds'], humidity: [45, 65], windSpeed: [6, 18] },
    'dubai': { baseTemp: 32, conditions: ['Clear', 'Haze'], humidity: [30, 50], windSpeed: [5, 15] },
    'singapore': { baseTemp: 28, conditions: ['Clouds', 'Rain', 'Thunderstorm'], humidity: [70, 90], windSpeed: [3, 10] },
    'default': { baseTemp: 18, conditions: ['Clear', 'Clouds', 'Rain'], humidity: [50, 70], windSpeed: [5, 15] }
  };

  async init(config: WeatherConfig): Promise<void> {
    this.config = config;
    this.apiKey = config.apiKey || process.env.OPENWEATHER_API_KEY || null;
    this.defaultLocation = config.defaultLocation || 'New York';
    this.units = config.units || 'metric';
    this.allowSimulatedData = config.allowSimulatedData !== false;
  }

  async execute(input: any, context: PluginContext): Promise<any> {
    const { location, type = 'current' } = input;
    const targetLocation = location || this.defaultLocation;

    // Try live API first if key is available
    if (this.apiKey) {
      try {
        if (type === 'current') {
          return await this.getCurrentWeather(targetLocation);
        } else if (type === 'forecast') {
          return await this.getForecast(targetLocation);
        } else {
          return {
            error: 'Invalid weather type. Use "current" or "forecast"',
            availableTypes: ['current', 'forecast']
          };
        }
      } catch (error) {
        // Fall through to simulated data if API fails
        if (!this.allowSimulatedData) {
          return {
            error: 'Failed to fetch weather data',
            details: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    }

    // Use simulated data if no API key or API call failed
    if (this.allowSimulatedData) {
      if (type === 'current') {
        return this.getSimulatedWeather(targetLocation);
      } else if (type === 'forecast') {
        return this.getSimulatedForecast(targetLocation);
      } else {
        return {
          error: 'Invalid weather type. Use "current" or "forecast"',
          availableTypes: ['current', 'forecast']
        };
      }
    }

    return {
      error: 'Weather API key not configured and simulated data is disabled.',
      suggestion: 'Get a free API key from https://openweathermap.org/api or enable simulated data'
    };
  }

  private async getCurrentWeather(location: string): Promise<WeatherData> {
    const url = `https://api.openweathermap.org/data/2.5/weather`;
    const params = {
      q: location,
      appid: this.apiKey,
      units: this.units
    };

    const response = await axios.get(url, { params, timeout: 10000 });
    const data = response.data;

    return {
      location: data.name,
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].main,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed),
      feelsLike: Math.round(data.main.feels_like),
      forecast: [],
      dataSource: 'live'
    };
  }

  private async getForecast(location: string): Promise<WeatherData> {
    const url = `https://api.openweathermap.org/data/2.5/forecast`;
    const params = {
      q: location,
      appid: this.apiKey,
      units: this.units,
      cnt: 40 // Get more data points for better daily aggregation
    };

    const response = await axios.get(url, { params, timeout: 10000 });
    const data = response.data;

    // Process forecast data (group by day)
    const dailyForecasts = new Map();
    
    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toDateString();
      if (!dailyForecasts.has(date)) {
        dailyForecasts.set(date, {
          date,
          high: item.main.temp_max,
          low: item.main.temp_min,
          condition: item.weather[0].main
        });
      } else {
        const existing = dailyForecasts.get(date);
        existing.high = Math.max(existing.high, item.main.temp_max);
        existing.low = Math.min(existing.low, item.main.temp_min);
      }
    });

    const forecast = Array.from(dailyForecasts.values()).slice(0, 5).map((day: any) => ({
      date: day.date,
      high: Math.round(day.high),
      low: Math.round(day.low),
      condition: day.condition
    }));

    return {
      location: data.city.name,
      temperature: Math.round(data.list[0].main.temp),
      condition: data.list[0].weather[0].main,
      humidity: data.list[0].main.humidity,
      windSpeed: Math.round(data.list[0].wind.speed),
      feelsLike: Math.round(data.list[0].main.feels_like),
      forecast,
      dataSource: 'live'
    };
  }

  // Constants for "feels like" temperature calculation
  // Based on simplified heat index and wind chill effects
  private readonly WIND_CHILL_THRESHOLD = 10;  // m/s - wind above this reduces feels-like temp
  private readonly WIND_CHILL_EFFECT = 2;      // °C reduction when windy
  private readonly HIGH_HUMIDITY_THRESHOLD = 70; // % - humidity above this increases feels-like temp
  private readonly HUMIDITY_HEAT_EFFECT = 2;   // °C increase when humid

  /**
   * Helper to calculate a random value within a range using a seed
   */
  private randomInRange(seed: number, min: number, max: number): number {
    return min + (seed % (max - min));
  }

  /**
   * Calculate "feels like" temperature based on wind and humidity
   * Simplified model based on:
   * - Wind chill: reduces perceived temp when wind > threshold
   * - Heat index: increases perceived temp when humidity > threshold
   */
  private calculateFeelsLike(actualTemp: number, windSpeed: number, humidity: number): number {
    let feelsLike = actualTemp;
    
    // Wind chill effect (more noticeable in cooler temps)
    if (windSpeed > this.WIND_CHILL_THRESHOLD) {
      feelsLike -= this.WIND_CHILL_EFFECT;
    }
    
    // Humidity heat effect (more noticeable in warmer temps)
    if (humidity > this.HIGH_HUMIDITY_THRESHOLD && actualTemp > 20) {
      feelsLike += this.HUMIDITY_HEAT_EFFECT;
    }
    
    return Math.round(feelsLike);
  }

  /**
   * Generate simulated weather data for demo/testing purposes
   */
  private getSimulatedWeather(location: string): WeatherData {
    const locationKey = location.toLowerCase();
    const weatherConfig = this.simulatedWeatherData[locationKey] || this.simulatedWeatherData['default'];
    
    // Use date-based seed for consistent daily data
    const dateSeed = this.generateDailySeed(location);
    
    // Calculate temperature with seasonal variation
    const seasonalOffset = this.getSeasonalOffset();
    const tempVariation = (dateSeed % 10) - 5;
    const temperature = weatherConfig.baseTemp + seasonalOffset + tempVariation;
    
    // Select condition based on seed
    const conditionIndex = dateSeed % weatherConfig.conditions.length;
    const condition = weatherConfig.conditions[conditionIndex];
    
    // Calculate other values using helper
    const humidity = this.randomInRange(dateSeed, weatherConfig.humidity[0], weatherConfig.humidity[1]);
    const windSpeed = this.randomInRange(dateSeed * 7, weatherConfig.windSpeed[0], weatherConfig.windSpeed[1]);
    const feelsLike = this.calculateFeelsLike(temperature, windSpeed, humidity);

    return {
      location: this.formatLocationName(location),
      temperature: Math.round(this.convertTemperature(temperature)),
      condition,
      humidity,
      windSpeed: Math.round(this.convertWindSpeed(windSpeed)),
      feelsLike: Math.round(this.convertTemperature(feelsLike)),
      forecast: [],
      dataSource: 'simulated'
    };
  }

  /**
   * Generate simulated forecast data
   */
  private getSimulatedForecast(location: string): WeatherData {
    const current = this.getSimulatedWeather(location);
    const locationKey = location.toLowerCase();
    const weatherConfig = this.simulatedWeatherData[locationKey] || this.simulatedWeatherData['default'];
    
    const forecast: WeatherData['forecast'] = [];
    const today = new Date();
    
    for (let i = 0; i < 5; i++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(today.getDate() + i);
      
      const daySeed = this.generateDailySeed(location + i.toString());
      const tempVariation = (daySeed % 8) - 4;
      const baseTemp = weatherConfig.baseTemp + this.getSeasonalOffset() + tempVariation;
      
      forecast.push({
        date: forecastDate.toDateString(),
        high: Math.round(this.convertTemperature(baseTemp + 3 + (daySeed % 5))),
        low: Math.round(this.convertTemperature(baseTemp - 3 - (daySeed % 4))),
        condition: weatherConfig.conditions[daySeed % weatherConfig.conditions.length]
      });
    }

    return {
      ...current,
      forecast
    };
  }

  /**
   * Generate a deterministic seed based on location and date
   */
  private generateDailySeed(location: string): number {
    const dateStr = new Date().toISOString().split('T')[0];
    const str = location.toLowerCase() + dateStr;
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash);
  }

  /**
   * Get seasonal temperature offset based on current month (Northern Hemisphere)
   */
  private getSeasonalOffset(): number {
    const month = new Date().getMonth();
    // Summer months are warmer, winter months are cooler
    const offsets = [-8, -6, -2, 3, 8, 12, 14, 13, 9, 4, -2, -6];
    return offsets[month];
  }

  /**
   * Convert temperature based on units setting
   */
  private convertTemperature(celsius: number): number {
    return this.units === 'imperial' ? (celsius * 9/5) + 32 : celsius;
  }

  /**
   * Convert wind speed based on units setting (m/s to mph if imperial)
   */
  private convertWindSpeed(metersPerSecond: number): number {
    return this.units === 'imperial' ? metersPerSecond * 2.237 : metersPerSecond;
  }

  /**
   * Format location name for display
   */
  private formatLocationName(location: string): string {
    return location.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for this plugin
  }
}

export default new WeatherPlugin();