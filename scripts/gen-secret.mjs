/**
 * Print a fresh NEXTAUTH_SECRET.
 *
 * Exists because the alternatives all fail somewhere: `openssl` is not on a
 * stock Windows install, the PowerShell one-liner in .env.example is long
 * enough to be retyped wrong, and "make up a long password" produces something
 * with far less entropy than it looks like it has.
 *
 *     npm run gen:secret
 *
 * Paste the result into the deployment's environment variables. Do not commit
 * it, and do not reuse the development value — the server refuses to start in
 * production if you do.
 */

import { randomBytes } from "node:crypto";

const secret = randomBytes(32).toString("base64");

console.log(`\n  NEXTAUTH_SECRET=${secret}\n`);
console.log("  Set this in Railway/Render → Variables. Not in a committed file.\n");
