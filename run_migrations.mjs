import pg from 'pg';
import fs from 'fs';
import path from 'path';

const PROJECT_REF = 'zkaqgogpydbopbmvkyia';
const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

// Accept database password from environment variable or command line argument
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.argv[2];

if (!DB_PASSWORD) {
  console.error('Usage: node run_migrations.mjs <DATABASE_PASSWORD>');
  console.error('   or: SUPABASE_DB_PASSWORD=<password> node run_migrations.mjs');
  console.error('');
  console.error('Find your database password at:');
  console.error(`  https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database`);
  process.exit(1);
}

async function main() {
  const client = new pg.Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  console.log('Connecting to Supabase Postgres...');
  try {
    await client.connect();
    console.log('Connected successfully!\n');
  } catch (err) {
    console.error(`Connection failed: ${err.message}`);
    console.error('\nMake sure you are using the correct database password.');
    console.error(`Find it at: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database`);
    process.exit(1);
  }

  // Read migration files in order
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files:\n`);
  for (const file of files) {
    console.log(`  ${file}`);
  }
  console.log('');

  let successCount = 0;
  let failCount = 0;

  // Execute each migration
  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log(`Executing: ${file}...`);
    try {
      await client.query(sql);
      console.log(`  OK`);
      successCount++;
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      failCount++;
    }
  }

  await client.end();
  console.log(`\nDone! ${successCount} succeeded, ${failCount} failed.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
