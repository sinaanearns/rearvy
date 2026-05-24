const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const memoryEvents = [];
let database = null;
let sqliteUnavailable = false;

function getCachePath() {
  return path.join(os.homedir(), ".rearvy", "business-ops.sqlite");
}

function openDatabase() {
  if (database || sqliteUnavailable) {
    return database;
  }

  try {
    const { DatabaseSync } = require("node:sqlite");
    const dbPath = getCachePath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    database = new DatabaseSync(dbPath);
    database.exec(`
      CREATE TABLE IF NOT EXISTS operation_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        payload_json TEXT
      );
    `);
    return database;
  } catch {
    sqliteUnavailable = true;
    return null;
  }
}

function recordOperationEvent(event) {
  const db = openDatabase();

  if (!db) {
    memoryEvents.push(event);
    while (memoryEvents.length > 200) {
      memoryEvents.shift();
    }
    return;
  }

  db.prepare(
    `INSERT OR REPLACE INTO operation_events
      (id, timestamp, level, source, message, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    event.id,
    event.timestamp,
    event.level,
    event.source,
    event.message,
    JSON.stringify(event.payload || null)
  );
}

function listRecentOperationEvents(limit = 100) {
  const db = openDatabase();

  if (!db) {
    return memoryEvents.slice(-limit);
  }

  return db
    .prepare(
      `SELECT id, timestamp, level, source, message, payload_json
       FROM operation_events
       ORDER BY timestamp DESC
       LIMIT ?`
    )
    .all(limit)
    .reverse()
    .map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      level: row.level,
      source: row.source,
      message: row.message,
      payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    }));
}

module.exports = {
  listRecentOperationEvents,
  recordOperationEvent,
};
