# PostgreSQL — Gotchas & Common Mistakes

<!-- Source: https://www.postgresql.org/docs/current/ (Context7: /websites/postgresql_current) -->

## 1. Always Use `TIMESTAMPTZ` Not `TIMESTAMP`

```sql
-- ❌ Stores without timezone — ambiguous across environments
created_at TIMESTAMP

-- ✅ Stores with timezone — unambiguous
created_at TIMESTAMPTZ DEFAULT NOW()
```

`TIMESTAMP` doesn't store timezone info, leading to bugs when servers are in different timezones.

## 2. Use `JSONB` Not `JSON` for Indexed JSON

```sql
-- ❌ JSON: stored as text, cannot be indexed
data JSON

-- ✅ JSONB: stored as binary, can be indexed, supports operators
data JSONB
CREATE INDEX idx_data ON table USING GIN(data);
```

The only reason to use `JSON` is if you need to preserve key order or exact whitespace.

## 3. NULL Comparisons Use `IS NULL` Not `= NULL`

```sql
-- ❌ Always returns NULL (not true/false)
WHERE deleted_at = NULL

-- ✅ Correct null check
WHERE deleted_at IS NULL
WHERE deleted_at IS NOT NULL
```

## 4. UUID Primary Keys: Use `gen_random_uuid()` (PostgreSQL 13+)

```sql
-- ❌ Requires uuid-ossp extension
id UUID DEFAULT uuid_generate_v4()

-- ✅ Built-in since PostgreSQL 13 (no extension needed)
id UUID DEFAULT gen_random_uuid()
```

## 5. `SERIAL` vs Identity Columns

```sql
-- ❌ SERIAL is a legacy shorthand with quirks
id SERIAL PRIMARY KEY

-- ✅ Use GENERATED ALWAYS AS IDENTITY (SQL standard, PostgreSQL 10+)
id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
-- or
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

## 6. Text Search Requires Indexes

```sql
-- ❌ LIKE '%text%' does a full table scan, very slow on large tables
WHERE title LIKE '%search%'

-- ✅ Use pg_trgm for LIKE queries with index
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_title_trgm ON posts USING GIN(title gin_trgm_ops);
WHERE title ILIKE '%search%'  -- Now uses index

-- ✅ Or use full-text search
CREATE INDEX idx_fts ON posts USING GIN(to_tsvector('english', title || ' ' || content));
WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', 'search')
```

## 7. N+1 Query Problem — Use JOINs or Batch Loading

```sql
-- ❌ N+1: one query for each post's author
SELECT * FROM posts;
-- Then for each post: SELECT * FROM users WHERE id = ?

-- ✅ Single JOIN
SELECT p.*, u.name AS author_name
FROM posts p
JOIN users u ON p.author_id = u.id;
```

## 8. Connection Pooling Is Critical

PostgreSQL has a limited number of connections (default `max_connections=100`). Always use a connection pooler:

- **PgBouncer**: production pooler
- **Supabase**: built-in pooler (use port 6543)
- **@payloadcms/db-postgres**: uses `pg` pool internally

```typescript
// node-postgres with pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,           // max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

## 9. Transactions Must Be Explicitly Committed

```sql
-- ❌ Without explicit commit, changes are lost
BEGIN;
INSERT INTO orders VALUES (...);
-- Forgot COMMIT! Changes rolled back when connection closes

-- ✅ Always commit or rollback
BEGIN;
INSERT INTO orders VALUES (...);
COMMIT;  -- or ROLLBACK on error
```

## 10. EXPLAIN ANALYZE for Query Optimization

```sql
-- Check query execution plan + actual timing
EXPLAIN ANALYZE SELECT * FROM posts WHERE user_id = 'abc' ORDER BY created_at DESC;

-- Look for:
-- "Seq Scan" on large tables = missing index
-- High "actual rows" vs "estimated rows" = stale statistics
-- Run ANALYZE to update statistics:
ANALYZE posts;
```

## 11. Avoid `SELECT *` in Production

```sql
-- ❌ Fetches all columns, prevents index-only scans
SELECT * FROM posts WHERE id = 'abc';

-- ✅ Select only needed columns
SELECT id, title, created_at FROM posts WHERE id = 'abc';
```

## 12. Row Level Security Must Be Explicitly Enabled Per Table

```sql
-- RLS is OFF by default — data is accessible to all users
-- Must enable per table:
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Without policies, RLS blocks ALL access by default
-- Must add policies to allow access
CREATE POLICY "allow_read" ON posts FOR SELECT USING (true);
```
