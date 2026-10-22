import { getDb } from "../src/lib/db";
import { bootstrapSuperAdmin } from "../src/lib/admin-bootstrap-cli";

async function main() {
const username = process.argv[2];
if (!username) {
  console.error("usage: npm run admin:bootstrap -- <username>");
  process.exit(2);
}
const result = await bootstrapSuperAdmin(getDb(), username);
if (!result.ok) {
  console.error(`bootstrap refused: ${result.error}`);
  process.exit(1);
}
console.log("bootstrap ok: account is now super_admin; sign in again and enable 2FA at /admin/guvenlik");
}

void main();
