CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    preferred_lang  VARCHAR(5) DEFAULT 'en',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_users_email ON users (email);

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) DEFAULT 'New Conversation',
    language        VARCHAR(5) DEFAULT 'en',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_updated_at ON sessions (updated_at DESC);

CREATE TABLE translations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gloss_sequence  TEXT[] NOT NULL,
    source_text     VARCHAR(1000) NOT NULL,
    translated_text VARCHAR(1000),
    source_lang     VARCHAR(5) DEFAULT 'en',
    target_lang     VARCHAR(5) DEFAULT 'en',
    confidence_avg  FLOAT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_translations_session_id ON translations (session_id);
CREATE INDEX idx_translations_user_id ON translations (user_id);
CREATE INDEX idx_translations_created_at ON translations (created_at DESC);
