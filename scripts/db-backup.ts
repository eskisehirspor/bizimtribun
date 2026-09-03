import { resolveSqlitePath } from "../src/lib/db-path";
import { runDailyBackup } from "../src/lib/db-backup";

try {
  const source = resolveSqlitePath();
  const name = runDailyBackup(source);
  console.log(`backup ok ${name}`);
} catch {
  console.error("backup failed");
  process.exit(1);
}
