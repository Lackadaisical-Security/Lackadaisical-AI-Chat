import { Plugin, PluginContext } from '../../../backend/src/types';

interface PoemData {
  title: string;
  author: string;
  content: string;
  date: string;
  theme: string;
  mood: string;
  analysis: string;
}

interface PoemConfig {
  includeAnalysis?: boolean;
  preferredThemes?: string[];
  maxLength?: number;
}

class PoemOfTheDayPlugin implements Plugin {
  name = 'poem-of-the-day';
  version = '2.0.0-rc1';
  description = 'Get daily poetry with analysis and themes';
  author = 'Lackadaisical Security';
  permissions = ['network'];
  enabled = true;
  config: PoemConfig = {};

  private poems = [
    {
      title: "The Road Not Taken",
      author: "Robert Frost",
      content: `Two roads diverged in a yellow wood,
And sorry I could not travel both
And be one traveler, long I stood
And looked down one as far as I could
To where it bent in the undergrowth;

Then took the other, as just as fair,
And having perhaps the better claim,
Because it was grassy and wanted wear;
Though as for that the passing there
Had worn them really about the same,

And both that morning equally lay
In leaves no step had trodden black.
Oh, I kept the first for another day!
Yet knowing how way leads on to way,
I doubted if I should ever come back.

I shall be telling this with a sigh
Somewhere ages and ages hence:
Two roads diverged in a wood, and I—
I took the one less traveled by,
And that has made all the difference.`,
      theme: "choices",
      mood: "contemplative"
    },
    {
      title: "Hope is the thing with feathers",
      author: "Emily Dickinson",
      content: `Hope is the thing with feathers
That perches in the soul,
And sings the tune without the words,
And never stops at all,

And sweetest in the gale is heard;
And sore must be the storm
That could abash the little bird
That kept so many warm.

I've heard it in the chillest land,
And on the strangest sea;
Yet, never, in extremity,
It asked a crumb of me.`,
      theme: "hope",
      mood: "uplifting"
    },
    {
      title: "Still I Rise",
      author: "Maya Angelou",
      content: `You may write me down in history
With your bitter, twisted lies,
You may trod me in the very dirt
But still, like dust, I'll rise.

Does my sassiness upset you?
Why are you beset with gloom?
'Cause I walk like I've got oil wells
Pumping in my living room.

Just like moons and like suns,
With the certainty of tides,
Just like hopes springing high,
Still I'll rise.

Did you want to see me broken?
Bowed head and lowered eyes?
Shoulders falling down like teardrops,
Weakened by my soulful cries?

Does my haughtiness offend you?
Don't you take it awful hard
'Cause I laugh like I've got gold mines
Diggin' in my own backyard.

You may shoot me with your words,
You may cut me with your eyes,
You may kill me with your hatefulness,
But still, like air, I'll rise.

Does my sexiness upset you?
Does it come as a surprise
That I dance like I've got diamonds
At the meeting of my thighs?

Out of the huts of history's shame
I rise
Up from a past that's rooted in pain
I rise
I'm a black ocean, leaping and wide,
Welling and swelling I bear in the tide.

Leaving behind nights of terror and fear
I rise
Into a daybreak that's wondrously clear
I rise
Bringing the gifts that my ancestors gave,
I am the dream and the hope of the slave.
I rise
I rise
I rise.`,
      theme: "resilience",
      mood: "empowering"
    },
    {
      title: "The Guest House",
      author: "Rumi",
      content: `This being human is a guest house.
Every morning a new arrival.

A joy, a depression, a meanness,
some momentary awareness comes
as an unexpected visitor.

Welcome and entertain them all!
Even if they're a crowd of sorrows,
who violently sweep your house
empty of its furniture,
still, treat each guest honorably.
He may be clearing you out
for some new delight.

The dark thought, the shame, the malice,
meet them at the door laughing,
and invite them in.

Be grateful for whoever comes,
because each has been sent
as a guide from beyond.`,
      theme: "acceptance",
      mood: "peaceful"
    },
    {
      title: "Wild Geese",
      author: "Mary Oliver",
      content: `You do not have to be good.
You do not have to walk on your knees
for a hundred miles through the desert, repenting.
You only have to let the soft animal of your body
love what it loves.
Tell me about despair, yours, and I will tell you mine.
Meanwhile the world goes on.
Meanwhile the sun and the clear pebbles of the rain
are moving across the landscapes,
over the prairies and the deep trees,
the mountains and the rivers.
Meanwhile the wild geese, high in the clean blue air,
are heading home again.
Whoever you are, no matter how lonely,
the world offers itself to your imagination,
calls to you like the wild geese, harsh and exciting –
over and over announcing your place
in the family of things.`,
      theme: "belonging",
      mood: "comforting"
    }
  ];

  private themes = [
    "love", "nature", "hope", "resilience", "acceptance", "belonging",
    "choices", "freedom", "wisdom", "beauty", "courage", "peace"
  ];

  private moods = [
    "contemplative", "uplifting", "empowering", "peaceful", "comforting",
    "melancholic", "joyful", "mysterious", "passionate", "serene"
  ];

  async init(config: PoemConfig): Promise<void> {
    this.config = config;
  }

  async execute(input: any, context: PluginContext): Promise<any> {
    const { theme, mood, type = 'daily' } = input;

    try {
      if (type === 'daily') {
        return await this.getDailyPoem(theme, mood);
      } else if (type === 'random') {
        return await this.getRandomPoem();
      } else if (type === 'themed') {
        return await this.getThemedPoem(theme);
      } else {
        return {
          error: 'Invalid poem type',
          availableTypes: ['daily', 'random', 'themed']
        };
      }
    } catch (error) {
      return {
        error: 'Failed to generate poem',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getDailyPoem(theme?: string, mood?: string): Promise<PoemData> {
    const date = new Date().toISOString().split('T')[0];
    const seed = this.generateSeed(date);
    
    let selectedPoem;
    
    if (theme) {
      selectedPoem = this.poems.find(poem => poem.theme === theme.toLowerCase());
    } else if (mood) {
      selectedPoem = this.poems.find(poem => poem.mood === mood.toLowerCase());
    }
    
    if (!selectedPoem) {
      selectedPoem = this.poems[seed % this.poems.length];
    }

    return {
      ...selectedPoem,
      date,
      analysis: this.generateAnalysis(selectedPoem, seed)
    };
  }

  private async getRandomPoem(): Promise<PoemData> {
    const date = new Date().toISOString().split('T')[0];
    const seed = this.generateSeed(date + Math.random().toString());
    const selectedPoem = this.poems[seed % this.poems.length];

    return {
      ...selectedPoem,
      date,
      analysis: this.generateAnalysis(selectedPoem, seed)
    };
  }

  private async getThemedPoem(theme: string): Promise<PoemData> {
    const date = new Date().toISOString().split('T')[0];
    const seed = this.generateSeed(theme + date);
    
    const themedPoems = this.poems.filter(poem => poem.theme === theme.toLowerCase());
    
    if (themedPoems.length === 0) {
      return {
        title: "No themed poem found",
        author: "System",
        content: `No poems found for theme: ${theme}. Available themes: ${this.themes.join(', ')}`,
        date,
        theme,
        mood: "neutral",
        analysis: "This is a system message indicating no themed poem was found."
      };
    }

    const selectedPoem = themedPoems[seed % themedPoems.length];

    return {
      ...selectedPoem,
      date,
      analysis: this.generateAnalysis(selectedPoem, seed)
    };
  }

  private generateSeed(str: string): number {
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }

  private generateAnalysis(poem: any, seed: number): string {
    const analysisTemplates = [
      `This ${poem.mood} poem explores themes of ${poem.theme} through ${poem.author}'s distinctive voice.`,
      `${poem.author} masterfully weaves together imagery and emotion to create a ${poem.mood} meditation on ${poem.theme}.`,
      `Through ${poem.author}'s lens, we see ${poem.theme} portrayed with ${poem.mood} sensitivity and depth.`,
      `This piece by ${poem.author} offers a ${poem.mood} perspective on ${poem.theme}, inviting reflection and connection.`,
      `${poem.author}'s words resonate with ${poem.mood} energy as they explore the complexities of ${poem.theme}.`
    ];

    const index = seed % analysisTemplates.length;
    return analysisTemplates[index];
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for this plugin
  }
}

export default new PoemOfTheDayPlugin(); 