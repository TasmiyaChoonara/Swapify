const fs = require("fs");
const path = require("path");
const pool = require("./src/config/db"); // adjust if your DB file is elsewhere

const runMigrations = async () => {
  try {
    const folder = path.join(__dirname, "migrations");

    const files = fs.readdirSync(folder).filter(f => f.endsWith(".sql"));

    // optional: sort so they run in order (important!)
    files.sort();

    for (const file of files) {
      const filePath = path.join(folder, file);
      const sql = fs.readFileSync(filePath, "utf8");

      console.log(`Running: ${file}`);
      await pool.query(sql);
    }

    console.log("✅ All migrations completed successfully");
    process.exit(0);

  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
};

runMigrations();