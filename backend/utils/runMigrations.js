const fs   = require('fs');
const path = require('path');
const db   = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

async function runMigrations() {
  const client = await db.getClient();
  try {
    // Create tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Get already-applied migrations
    const { rows: applied } = await client.query(
      `SELECT filename FROM schema_migrations`
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    // Read all .sql files sorted by name
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]
        );
        await client.query('COMMIT');
        console.log(`[Migration] Applied: ${file}`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migration] FAILED: ${file} — ${err.message}`);
        // Continue with remaining migrations; a failed migration is logged but doesn't crash the server
      }
    }

    if (count === 0) {
      console.log('[Migration] All migrations already applied.');
    } else {
      console.log(`[Migration] Applied ${count} migration(s).`);
    }
  } finally {
    client.release();
  }
}

module.exports = runMigrations;
