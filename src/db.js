const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
});

pool.on("error", (err) => console.error("[db] pool:", err.message));

const SCHEMA_PATH = path.join(__dirname, "..", "CSDL", "CSDL.sql");
// Kịch bản riêng của Thú ảo + Thị trấn (pet_state, town_state, town_ledger), cũng idempotent.
const TOWN_SCHEMA_PATH = path.join(__dirname, "..", "CSDL", "town.sql");
// Quần đảo + thú cưng (island_state, pet_owned, pet_pantry), idempotent.
const ISLAND_SCHEMA_PATH = path.join(__dirname, "..", "CSDL", "island.sql");

// Các thay đổi cấu trúc làm *sau* CSDL.sql. Hai cột status/review_reasons đã được chuyển vào CSDL.sql (mục 3c)
// nên danh sách này đang trống; chỉ thêm lệnh migrate ở đây khi chưa kịp viết vào CSDL.sql.
const MIGRATIONS = [];

async function applySchema() {
  await pool.query(fs.readFileSync(SCHEMA_PATH, "utf8"));
  await pool.query(fs.readFileSync(TOWN_SCHEMA_PATH, "utf8"));
  await pool.query(fs.readFileSync(ISLAND_SCHEMA_PATH, "utf8"));
  for (const m of MIGRATIONS) await pool.query(m);
}

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  applySchema,
  withTransaction,
  close,
  SCHEMA_PATH,
  TOWN_SCHEMA_PATH,
};
