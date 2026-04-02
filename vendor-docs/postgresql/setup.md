# PostgreSQL — Setup & Installation

<!-- Source: https://www.postgresql.org/docs/current/ (Context7: /websites/postgresql_current) -->

## Install PostgreSQL

### macOS (Homebrew)

```bash
brew install postgresql@16
brew services start postgresql@16

# Add to PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start the service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Docker (Recommended for Development)

```bash
docker run --name postgres \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_USER=myuser \
  -e POSTGRES_DB=mydb \
  -p 5432:5432 \
  -d postgres:16
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: mydb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql  # optional seed

volumes:
  postgres_data:
```

```bash
docker compose up -d
```

## Initialize from Source (Advanced)

```bash
./configure
make
sudo make install

# Create data directory
sudo adduser postgres
sudo mkdir -p /usr/local/pgsql/data
sudo chown postgres /usr/local/pgsql/data

# Initialize cluster
su - postgres
/usr/local/pgsql/bin/initdb -D /usr/local/pgsql/data

# Start server
/usr/local/pgsql/bin/pg_ctl -D /usr/local/pgsql/data -l logfile start
```

## Connect with psql

```bash
# Connect to default database
psql

# Connect to specific database
psql -d mydb -U myuser

# Connect to remote
psql -h localhost -p 5432 -d mydb -U myuser -W

# Run a command
psql -d mydb -c "SELECT version();"
```

## Create a Database

```bash
# Using createdb CLI
createdb mydb

# Or via psql
psql -c "CREATE DATABASE mydb;"

# With user
psql -c "CREATE USER myuser WITH PASSWORD 'mypassword';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE mydb TO myuser;"
```

## Connection String Format

```
postgresql://user:password@host:port/database
postgresql://myuser:mypassword@localhost:5432/mydb

# With SSL
postgresql://user:password@host:5432/db?sslmode=require
```

## pg_ctl Commands

```bash
# Start
pg_ctl -D /path/to/data start -l logfile

# Stop
pg_ctl -D /path/to/data stop

# Restart
pg_ctl -D /path/to/data restart

# Status
pg_ctl -D /path/to/data status
```

## Useful psql Commands

```sql
\l              -- List databases
\c mydb         -- Connect to database
\dt             -- List tables
\d tablename    -- Describe table
\du             -- List users/roles
\q              -- Quit
\?              -- Help
\timing         -- Toggle query timing
\x              -- Toggle expanded output
```
