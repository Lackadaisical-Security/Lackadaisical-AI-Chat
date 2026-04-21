-- Lackadaisical AI Chat Database Schema
-- SQLite3 database schema for persistent conversation, personality, and journal storage

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- =============================================================================
-- CONVERSATIONS TABLE
-- Stores all user-AI interactions with sentiment and context
-- =============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL DEFAULT 'default',
    user_message TEXT,
    ai_response TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    sentiment_score REAL DEFAULT 0.0,
    sentiment_label TEXT DEFAULT 'neutral',
    context_tags TEXT DEFAULT '[]', -- JSON array of context tags
    message_type TEXT DEFAULT 'chat', -- chat, command, journal, system
    tokens_used INTEGER DEFAULT 0,
    response_time_ms INTEGER DEFAULT 0,
    model_used TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_sentiment ON conversations(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_conversations_message_type ON conversations(message_type);

-- =============================================================================
-- PERSONALITY STATE TABLE
-- Stores dynamic personality and mood state
-- =============================================================================
CREATE TABLE IF NOT EXISTS personality_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT NOT NULL DEFAULT 'Lacky',
    static_traits TEXT NOT NULL DEFAULT '[]', -- JSON array
    current_mood TEXT NOT NULL DEFAULT '{}', -- JSON object
    energy_level INTEGER DEFAULT 75,
    empathy_level INTEGER DEFAULT 80,
    humor_level INTEGER DEFAULT 70,
    curiosity_level INTEGER DEFAULT 85,
    patience_level INTEGER DEFAULT 90,
    conversation_count INTEGER DEFAULT 0,
    total_interactions INTEGER DEFAULT 0,
    last_interaction DATETIME,
    mood_history TEXT DEFAULT '[]', -- JSON array of mood snapshots
    learning_data TEXT DEFAULT '{}', -- JSON object for adaptive learning
    personality_version TEXT DEFAULT '1.0.0',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure only one personality state record
    CHECK (id = 1)
);

-- Insert default personality state
INSERT OR IGNORE INTO personality_state (id) VALUES (1);

-- =============================================================================
-- JOURNAL ENTRIES TABLE
-- Stores user journal entries with content analysis and insights
-- =============================================================================
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]', -- JSON array of user-defined tags
    mood TEXT DEFAULT 'neutral',
    session_id TEXT DEFAULT 'default',
    privacy_level TEXT DEFAULT 'private', -- private, shared, public, deleted
    word_count INTEGER DEFAULT 0,
    reading_time_minutes INTEGER DEFAULT 0,
    themes TEXT DEFAULT '[]', -- JSON array of detected themes
    emotions TEXT DEFAULT '[]', -- JSON array of detected emotions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_journal_entries_session_id ON journal_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_journal_entries_mood ON journal_entries(mood);
CREATE INDEX IF NOT EXISTS idx_journal_entries_privacy ON journal_entries(privacy_level);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tags ON journal_entries(tags);

-- =============================================================================
-- PLUGIN STATES TABLE
-- Stores plugin configuration and state
-- =============================================================================
CREATE TABLE IF NOT EXISTS plugin_states (
    plugin_name TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT 1,
    config TEXT DEFAULT '{}', -- JSON configuration object
    state_data TEXT DEFAULT '{}', -- JSON state data
    last_used DATETIME,
    usage_count INTEGER DEFAULT 0,
    version TEXT DEFAULT '1.0.0',
    author TEXT,
    description TEXT,
    permissions TEXT DEFAULT '[]', -- JSON array of required permissions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MEMORY TAGS TABLE
-- Stores contextual tags for better memory organization
-- =============================================================================
CREATE TABLE IF NOT EXISTS memory_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT 'general', -- general, emotion, topic, activity, etc.
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
    usage_count INTEGER DEFAULT 0,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME
);

-- Index for efficient tag lookups
CREATE INDEX IF NOT EXISTS idx_memory_tags_category ON memory_tags(category);
CREATE INDEX IF NOT EXISTS idx_memory_tags_priority ON memory_tags(priority);

-- =============================================================================
-- CONVERSATION TAGS JUNCTION TABLE
-- Links conversations with memory tags (many-to-many relationship)
-- =============================================================================
CREATE TABLE IF NOT EXISTS conversation_tags (
    conversation_id INTEGER,
    tag_id INTEGER,
    relevance_score REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (conversation_id, tag_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES memory_tags(id) ON DELETE CASCADE
);

-- =============================================================================
-- SESSIONS TABLE
-- Tracks conversation sessions and metadata
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active', -- active, archived, deleted
    metadata TEXT DEFAULT '{}', -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient session querying
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

-- =============================================================================
-- LEARNING DATA TABLE
-- Stores user preferences and learning patterns
-- =============================================================================
CREATE TABLE IF NOT EXISTS learning_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default_user',
    data_type TEXT NOT NULL, -- preference, pattern, feedback, correction
    key_name TEXT NOT NULL,
    value_data TEXT NOT NULL, -- JSON data
    confidence_score REAL DEFAULT 1.0,
    source TEXT DEFAULT 'user_interaction', -- user_interaction, system_inference, explicit_feedback
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME, -- NULL means no expiration
    
    UNIQUE(user_id, data_type, key_name)
);

-- Index for learning data queries
CREATE INDEX IF NOT EXISTS idx_learning_data_user_type ON learning_data(user_id, data_type);
CREATE INDEX IF NOT EXISTS idx_learning_data_confidence ON learning_data(confidence_score);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Update conversations timestamp on modification
CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp 
    AFTER UPDATE ON conversations
BEGIN
    UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update personality state timestamp on modification
CREATE TRIGGER IF NOT EXISTS update_personality_state_timestamp 
    AFTER UPDATE ON personality_state
BEGIN
    UPDATE personality_state SET last_updated = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update journal entries timestamp on modification
CREATE TRIGGER IF NOT EXISTS update_journal_entries_timestamp 
    AFTER UPDATE ON journal_entries
BEGIN
    UPDATE journal_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update plugin states timestamp on modification
CREATE TRIGGER IF NOT EXISTS update_plugin_states_timestamp 
    AFTER UPDATE ON plugin_states
BEGIN
    UPDATE plugin_states SET updated_at = CURRENT_TIMESTAMP WHERE plugin_name = NEW.plugin_name;
END;

-- Update sessions timestamp on modification
CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp 
    AFTER UPDATE ON sessions
BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Increment tag usage count when conversation_tags is inserted
CREATE TRIGGER IF NOT EXISTS increment_tag_usage 
    AFTER INSERT ON conversation_tags
BEGIN
    UPDATE memory_tags 
    SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP 
    WHERE id = NEW.tag_id;
END;

-- Update session message count when conversation is inserted
CREATE TRIGGER IF NOT EXISTS update_session_message_count 
    AFTER INSERT ON conversations
BEGIN
    UPDATE sessions 
    SET message_count = message_count + 1, 
        last_activity = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.session_id;
    
    -- Create session if it doesn't exist
    INSERT OR IGNORE INTO sessions (id, name) VALUES (NEW.session_id, 'Session ' || NEW.session_id);
END;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Recent conversations with context
CREATE VIEW IF NOT EXISTS recent_conversations AS
SELECT 
    c.*,
    s.name as session_name,
    s.status as session_status
FROM conversations c
LEFT JOIN sessions s ON c.session_id = s.id
ORDER BY c.timestamp DESC;

-- Conversation summary by session
CREATE VIEW IF NOT EXISTS session_summary AS
SELECT 
    s.id,
    s.name,
    s.message_count,
    s.start_time,
    s.last_activity,
    s.status,
    COUNT(c.id) as actual_message_count,
    AVG(c.sentiment_score) as avg_sentiment,
    SUM(c.tokens_used) as total_tokens
FROM sessions s
LEFT JOIN conversations c ON s.id = c.session_id
GROUP BY s.id;

-- Tag popularity and usage
CREATE VIEW IF NOT EXISTS tag_analytics AS
SELECT 
    mt.tag_name,
    mt.category,
    mt.priority,
    mt.usage_count,
    COUNT(ct.conversation_id) as conversation_count,
    AVG(ct.relevance_score) as avg_relevance,
    mt.last_used
FROM memory_tags mt
LEFT JOIN conversation_tags ct ON mt.id = ct.tag_id
GROUP BY mt.id
ORDER BY mt.usage_count DESC;

-- =============================================================================
-- INITIAL DATA SEEDING
-- =============================================================================

-- Insert default memory tags
INSERT OR IGNORE INTO memory_tags (tag_name, category, priority, description) VALUES
('greeting', 'interaction', 2, 'Initial greetings and introductions'),
('question', 'interaction', 2, 'User asking questions'),
('help_request', 'interaction', 3, 'User requesting assistance'),
('emotional_support', 'emotion', 3, 'Conversations involving emotional support'),
('technical_discussion', 'topic', 2, 'Technical or programming related topics'),
('creative_work', 'topic', 2, 'Creative projects and artistic discussions'),
('personal_sharing', 'interaction', 3, 'User sharing personal information'),
('humor', 'emotion', 1, 'Funny or light-hearted conversations'),
('problem_solving', 'activity', 3, 'Working through problems together'),
('learning', 'activity', 2, 'Educational or learning-focused conversations');

-- Insert default plugin states for core plugins
INSERT OR IGNORE INTO plugin_states (plugin_name, enabled, description, permissions) VALUES
('weather', 1, 'Provides weather information and forecasts', '["api_access"]'),
('horoscope', 1, 'Daily horoscope readings', '[]'),
('poem-of-the-day', 1, 'Daily poetry and creative writing', '[]');

-- Create default session
INSERT OR IGNORE INTO sessions (id, name, description) VALUES 
('default', 'Default Session', 'The main conversation session');

-- =============================================================================
-- USERS TABLE
-- Stores registered user accounts for authentication
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user', -- user, admin
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================================
-- REFRESH TOKENS TABLE
-- Stores active refresh tokens for JWT auth
-- =============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- =============================================================================
-- CLEANUP AND MAINTENANCE PROCEDURES
-- =============================================================================

-- Note: These would typically be run as maintenance scripts, not as part of schema creation

-- Example cleanup query for old conversations (commented out):
-- DELETE FROM conversations WHERE timestamp < datetime('now', '-1 year');

-- Example cleanup query for expired learning data:
-- DELETE FROM learning_data WHERE expires_at IS NOT NULL AND expires_at < datetime('now');

-- =============================================================================
-- SCHEMA VERSION
-- =============================================================================

-- Track schema version for future migrations
CREATE TABLE IF NOT EXISTS schema_version (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT OR IGNORE INTO schema_version (version, description) VALUES 
('1.0.0', 'Initial schema with conversations, personality, journal, and plugin support'); 