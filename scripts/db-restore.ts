import { resolveSqlitePath } from "../src/lib/db-path";
import { restoreSqliteFile } from "../src/lib/db-backup";

const backupPath = process.argv[2]?.trim();
if (!backupPath) {
  console.error("restore failed");
  process.exit(1);
}

try {
  restoreSqliteFile(backupPath, resolveSqlitePath());
  console.log("restore ok");
} catch {
  console.error("restore failed");
  process.exit(1);
}
