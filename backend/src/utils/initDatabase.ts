import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config/settings';

/**
 * Initialize the separate message log database for storing every user message
 * and every model thinking + response. Uses WAL mode for concurrent access.
 */
export function initializeMessageLogDatabase(dbDir: string): Database.Database {
  const logDbPath = path.join(dbDir, 'message_log.db');
  const logDb = new Database(logDbPath);

  // Enable WAL mode for concurrent reads/writes and SHM support
  logDb.pragma('journal_mode = WAL');
  logDb.pragma('synchronous = NORMAL');
  logDb.pragma('wal_autocheckpoint = 1000');
  logDb.pragma('foreign_keys = ON');
  logDb.pragma('cache_size = -64000'); // 64MB cache
  logDb.pragma('busy_timeout = 5000');

  logDb.exec(`
    CREATE TABLE IF NOT EXISTS message_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL,
      thinking TEXT,
      thinking_duration_ms INTEGER,
      model_used TEXT,
      provider TEXT,
      tokens_input INTEGER DEFAULT 0,
      tokens_output INTEGER DEFAULT 0,
      tokens_thinking INTEGER DEFAULT 0,
      finish_reason TEXT,
      tool_calls TEXT,
      tool_results TEXT,
      attachments TEXT,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_msglog_session ON message_log(session_id);
    CREATE INDEX IF NOT EXISTS idx_msglog_role ON message_log(role);
    CREATE INDEX IF NOT EXISTS idx_msglog_created ON message_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_msglog_model ON message_log(model_used);

    CREATE TABLE IF NOT EXISTS message_log_schema_version (
      version TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO message_log_schema_version (version) VALUES ('1.0.0');
  `);

  console.log(`[DATABASE] Message log database initialized: ${logDbPath} (WAL mode)`);
  return logDb;
}

export async function initializeDatabase(): Promise<Database.Database> {
  try {
    // Ensure database directory exists
    // Resolve path relative to the project root, not backend folder
    const projectRoot = path.resolve(__dirname, '../../../..');
    const dbPath = path.resolve(projectRoot, config.database.path);
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`Created database directory: ${dbDir}`);
    }

    // Initialize SQLite database
    const db = new Database(dbPath);
    
    // Enable WAL mode for better concurrent access (creates .db-wal and .db-shm files)
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('wal_autocheckpoint = 1000');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('busy_timeout = 5000');
    
    console.log(`[DATABASE] SQLite database initialized: ${dbPath} (WAL mode)`);

    // Create all tables from our enhanced schema
    console.log('[DATABASE] Creating tables from enhanced schema');
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL DEFAULT 'default',
        user_message TEXT,
        ai_response TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        sentiment_score REAL DEFAULT 0.0,
        sentiment_label TEXT DEFAULT 'neutral',
        mood_impact REAL DEFAULT 0.0,
        context_tags TEXT DEFAULT '[]',
        message_type TEXT DEFAULT 'chat',
        tokens_used INTEGER DEFAULT 0,
        response_time_ms INTEGER DEFAULT 0,
        model_used TEXT,
        plugin_data TEXT DEFAULT '{}',
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        context_summary TEXT,
        message_count INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS personality_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        session_id TEXT DEFAULT 'default',
        name TEXT NOT NULL DEFAULT 'Lacky',
        static_traits TEXT NOT NULL DEFAULT '[]',
        traits TEXT DEFAULT '{}',
        current_mood TEXT DEFAULT '{}',
        energy_level INTEGER DEFAULT 75,
        empathy_level INTEGER DEFAULT 80,
        humor_level INTEGER DEFAULT 70,
        curiosity_level INTEGER DEFAULT 85,
        patience_level INTEGER DEFAULT 90,
        conversation_count INTEGER DEFAULT 0,
        total_interactions INTEGER DEFAULT 0,
        last_interaction DATETIME,
        mood_history TEXT DEFAULT '[]',
        learning_data TEXT DEFAULT '{}',
        personality_version TEXT DEFAULT '2.0.0-rc1',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (id = 1)
      );
      
      CREATE TABLE IF NOT EXISTS memory_contexts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        context_type TEXT DEFAULT 'active',
        content TEXT DEFAULT '{}',
        importance_score REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        entry_text TEXT NOT NULL,
        mood_snapshot TEXT DEFAULT '{}',
        sentiment_analysis TEXT DEFAULT '{}',
        reflective_prompts TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        tags TEXT DEFAULT '[]'
      );
      
      CREATE TABLE IF NOT EXISTS plugin_states (
        plugin_name TEXT PRIMARY KEY,
        enabled BOOLEAN DEFAULT 1,
        config TEXT DEFAULT '{}',
        usage_stats TEXT DEFAULT '{}',
        last_used DATETIME,
        version TEXT DEFAULT '2.0.0-rc1'
      );
      
      CREATE TABLE IF NOT EXISTS training_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        input_text TEXT,
        expected_output TEXT,
        actual_output TEXT,
        feedback_score INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Handle migrations for existing databases
    console.log('[DATABASE] Checking for schema updates...');
    
    try {
      // Check if sentiment_label column exists
      const columns = db.prepare("PRAGMA table_info(conversations)").all();
      const columnNames = columns.map((col: any) => col.name);
      
      if (!columnNames.includes('sentiment_label')) {
        console.log('[DATABASE] Adding sentiment_label column...');
        db.exec("ALTER TABLE conversations ADD COLUMN sentiment_label TEXT DEFAULT 'neutral'");
      }
      
      if (!columnNames.includes('tokens_used')) {
        console.log('[DATABASE] Adding tokens_used column...');
        db.exec("ALTER TABLE conversations ADD COLUMN tokens_used INTEGER DEFAULT 0");
      }
      
      if (!columnNames.includes('response_time_ms')) {
        console.log('[DATABASE] Adding response_time_ms column...');
        db.exec("ALTER TABLE conversations ADD COLUMN response_time_ms INTEGER DEFAULT 0");
      }
      
      if (!columnNames.includes('model_used')) {
        console.log('[DATABASE] Adding model_used column...');
        db.exec("ALTER TABLE conversations ADD COLUMN model_used TEXT");
      }
      
      if (!columnNames.includes('created_at')) {
        console.log('[DATABASE] Adding created_at column...');
        db.exec("ALTER TABLE conversations ADD COLUMN created_at DATETIME");
        db.exec("UPDATE conversations SET created_at = datetime('now') WHERE created_at IS NULL");
      }
      
      if (!columnNames.includes('updated_at')) {
        console.log('[DATABASE] Adding updated_at column...');
        db.exec("ALTER TABLE conversations ADD COLUMN updated_at DATETIME");
        db.exec("UPDATE conversations SET updated_at = datetime('now') WHERE updated_at IS NULL");
      }

      // Check and migrate personality_state table
      const personalityColumns = db.prepare("PRAGMA table_info(personality_state)").all();
      const personalityColumnNames = personalityColumns.map((col: any) => col.name);
      
      if (!personalityColumnNames.includes('total_interactions')) {
        console.log('[DATABASE] Adding total_interactions column...');
        db.exec("ALTER TABLE personality_state ADD COLUMN total_interactions INTEGER DEFAULT 0");
      }
      
      if (!personalityColumnNames.includes('conversation_count')) {
        console.log('[DATABASE] Adding conversation_count column...');
        db.exec("ALTER TABLE personality_state ADD COLUMN conversation_count INTEGER DEFAULT 0");
      }
      
      if (!personalityColumnNames.includes('last_interaction')) {
        console.log('[DATABASE] Adding last_interaction column...');
        db.exec("ALTER TABLE personality_state ADD COLUMN last_interaction DATETIME");
      }
      
      if (!personalityColumnNames.includes('name')) {
        console.log('[DATABASE] Adding name column...');
        db.exec("ALTER TABLE personality_state ADD COLUMN name TEXT NOT NULL DEFAULT 'Lacky'");
      }
      
      if (!personalityColumnNames.includes('static_traits')) {
        console.log('[DATABASE] Adding static_traits column...');
        db.exec("ALTER TABLE personality_state ADD COLUMN static_traits TEXT NOT NULL DEFAULT '[]'");
      }
      
      if (!personalityColumnNames.includes('curiosity_level')) {
        console.log('[DATABASE] Adding curiosity_level column...');
        db.exec("ALTER TABLE personality_state ADD COLUMN curiosity_level INTEGER DEFAULT 85");
      }
      
      if (!personalityColumnNames.includes('patience_level')) {
        console.log('[DATABASE] Adding patience_level column...');
        db.exec("ALTER TABLE personality_state ADD COLUMN patience_level INTEGER DEFAULT 90");
      }
      
      if (!personalityColumnNames.includes('mood_history')) {
        console.log('[DATABASE] Adding mood_history column...');
        db.exec("ALTER TABLE personality_state ADD COLUMN mood_history TEXT DEFAULT '[]'");
      }
      
      if (!personalityColumnNames.includes('personality_version')) {
        console.log('[DATABASE] Adding personality_version column...');
        db.exec("ALTER TABLE personality_state ADD COLUMN personality_version TEXT DEFAULT '2.0.0-rc1'");
      }
      
      if (!personalityColumnNames.includes('created_at')) {
        console.log('[DATABASE] Adding created_at column to personality_state...');
        db.exec("ALTER TABLE personality_state ADD COLUMN created_at DATETIME");
        db.exec("UPDATE personality_state SET created_at = datetime('now') WHERE created_at IS NULL");
      }
      
      // Update existing NULL values
      db.exec("UPDATE conversations SET sentiment_score = 0.0 WHERE sentiment_score IS NULL");
      db.exec("UPDATE conversations SET context_tags = '[]' WHERE context_tags IS NULL");
      
      console.log('[DATABASE] Schema migration completed successfully');
    } catch (migrationError) {
      console.log('[DATABASE] Migration note:', migrationError);
    }

    // Insert default personality state if it doesn't exist
    const personalityExists = db.prepare('SELECT COUNT(*) as count FROM personality_state WHERE id = 1').get() as { count: number };
    if (personalityExists.count === 0) {
      db.prepare(`
        INSERT INTO personality_state (id, traits, current_mood) 
        VALUES (1, '${JSON.stringify(config.personality.baseTraits)}', '{"state":"neutral","energy":75}')
      `).run();
      console.log('[DATABASE] Default personality state created');
    }

    // Create default session if it doesn't exist
    const defaultSessionExists = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE id = 'default'").get() as { count: number };
    if (defaultSessionExists.count === 0) {
      db.prepare(`
        INSERT INTO sessions (id, name, context_summary) 
        VALUES ('default', 'Default Session', 'Fresh conversation')
      `).run();
      console.log('[DATABASE] Default session created');
    }

    console.log('[DATABASE] Database initialization completed successfully');
    return db;
    
  } catch (error) {
    console.error('[DATABASE] Failed to initialize database:', error);
    throw error;
  }
}

export default initializeDatabase;
