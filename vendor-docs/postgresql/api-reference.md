# PostgreSQL — SQL Reference

<!-- Source: https://www.postgresql.org/docs/current/ (Context7: /websites/postgresql_current) -->

## Data Types

| Type | Description | Example |
|------|-------------|---------|
| `SERIAL` / `BIGSERIAL` | Auto-increment integer | Primary keys |
| `UUID` | UUID v4 | `gen_random_uuid()` |
| `TEXT` | Variable-length string | |
| `VARCHAR(n)` | Limited string | |
| `INTEGER` / `BIGINT` | Integer numbers | |
| `NUMERIC(p,s)` | Exact decimal | Money, precision |
| `REAL` / `DOUBLE PRECISION` | Floating point | |
| `BOOLEAN` | true/false | |
| `TIMESTAMP` | Date and time (no TZ) | |
| `TIMESTAMPTZ` | Date and time with TZ | Recommended |
| `DATE` | Date only | |
| `JSONB` | Binary JSON (indexed) | |
| `JSON` | Text JSON | |
| `ARRAY` | Array of any type | `TEXT[]` |

## Table Operations

```sql
-- Create table
CREATE TABLE posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  content     TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  views       INTEGER NOT NULL DEFAULT 0,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add column
ALTER TABLE posts ADD COLUMN featured BOOLEAN DEFAULT FALSE;

-- Drop column
ALTER TABLE posts DROP COLUMN old_column;

-- Rename column
ALTER TABLE posts RENAME COLUMN old_name TO new_name;

-- Drop table
DROP TABLE posts;
DROP TABLE IF EXISTS posts CASCADE;
```

## Indexes

```sql
-- Basic index
CREATE INDEX idx_posts_status ON posts(status);

-- Unique index
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Composite index
CREATE INDEX idx_posts_author_status ON posts(author_id, status);

-- Partial index (only for published)
CREATE INDEX idx_posts_published ON posts(created_at) WHERE status = 'published';

-- JSONB index
CREATE INDEX idx_posts_metadata ON posts USING GIN(metadata);

-- Full-text search index
CREATE INDEX idx_posts_title_fts ON posts USING GIN(to_tsvector('english', title));
```

## CRUD Operations

```sql
-- INSERT
INSERT INTO posts (title, content, author_id)
VALUES ('Hello', 'Content here', 'user-uuid');

-- INSERT multiple
INSERT INTO posts (title, author_id) VALUES
  ('Post 1', 'user-uuid-1'),
  ('Post 2', 'user-uuid-2');

-- INSERT ... RETURNING
INSERT INTO posts (title, author_id)
VALUES ('New Post', 'user-uuid')
RETURNING id, created_at;

-- UPDATE
UPDATE posts
SET status = 'published', updated_at = NOW()
WHERE id = 'post-uuid';

-- UPDATE ... RETURNING
UPDATE posts SET views = views + 1 WHERE id = 'post-uuid'
RETURNING views;

-- UPSERT (INSERT ... ON CONFLICT)
INSERT INTO user_settings (user_id, theme)
VALUES ('user-uuid', 'dark')
ON CONFLICT (user_id)
DO UPDATE SET theme = EXCLUDED.theme;

-- DELETE
DELETE FROM posts WHERE id = 'post-uuid';

-- DELETE ... RETURNING
DELETE FROM posts WHERE status = 'draft' RETURNING id;
```

## Queries

```sql
-- Basic SELECT
SELECT id, title, created_at FROM posts
WHERE status = 'published'
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;

-- JOIN
SELECT p.id, p.title, u.name AS author_name
FROM posts p
INNER JOIN users u ON p.author_id = u.id
WHERE p.status = 'published';

-- LEFT JOIN (include posts without author)
SELECT p.*, u.name AS author_name
FROM posts p
LEFT JOIN users u ON p.author_id = u.id;

-- Aggregate
SELECT status, COUNT(*) as count
FROM posts
GROUP BY status
HAVING COUNT(*) > 5
ORDER BY count DESC;

-- Subquery
SELECT * FROM posts
WHERE author_id IN (
  SELECT id FROM users WHERE role = 'admin'
);

-- CTE (Common Table Expression)
WITH published AS (
  SELECT * FROM posts WHERE status = 'published'
)
SELECT p.title, u.name
FROM published p
JOIN users u ON p.author_id = u.id;
```

## Full-Text Search

```sql
-- Search posts
SELECT id, title,
  ts_rank(to_tsvector('english', title || ' ' || content),
           plainto_tsquery('english', 'search terms')) AS rank
FROM posts
WHERE to_tsvector('english', title || ' ' || content)
  @@ plainto_tsquery('english', 'search terms')
ORDER BY rank DESC;
```

## JSONB Operations

```sql
-- Access JSONB field
SELECT metadata->>'key' FROM posts;
SELECT metadata->'nested'->>'field' FROM posts;

-- Filter by JSONB
SELECT * FROM posts WHERE metadata->>'category' = 'tech';
SELECT * FROM posts WHERE metadata @> '{"featured": true}';

-- Update JSONB
UPDATE posts SET metadata = metadata || '{"updated": true}';
```

## Window Functions

```sql
-- Row number
SELECT id, title,
  ROW_NUMBER() OVER (ORDER BY created_at DESC) AS row_num
FROM posts;

-- Rank within group
SELECT id, title, author_id,
  RANK() OVER (PARTITION BY author_id ORDER BY views DESC) AS author_rank
FROM posts;

-- Running total
SELECT id, views,
  SUM(views) OVER (ORDER BY created_at) AS cumulative_views
FROM posts;
```

## Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy: users see only their own posts
CREATE POLICY posts_select_policy ON posts
  FOR SELECT
  USING (author_id = current_user_id());

-- Policy: authenticated users can insert
CREATE POLICY posts_insert_policy ON posts
  FOR INSERT
  WITH CHECK (author_id = current_user_id());
```

## Extensions

```sql
-- Enable common extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- Crypto functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- Fuzzy text search
CREATE EXTENSION IF NOT EXISTS "hstore";     -- Key-value store

-- UUID generation
SELECT gen_random_uuid();  -- PostgreSQL 13+ (built-in)
SELECT uuid_generate_v4(); -- Requires uuid-ossp
```
