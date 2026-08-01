/**
 * Run the seed at start-up, and never let it stop the server.
 *
 * WHY THIS EXISTS
 * ---------------
 * A fresh deployment has an empty database, so there is no account to sign in
 * with and no way to make one with administrator rights. The documented fix was
 * "open the Railway shell and run `npm run prisma:seed`" — which assumes a shell
 * the plan may not include, and assumes anybody deploying this knows to go and
 * look for that instruction.
 *
 * `render.yaml` already does this as a pre-deploy step. This is the same idea
 * for Railway, in the start command.
 *
 * WHY IT SWALLOWS FAILURES
 * ------------------------
 * `prisma/seed.ts` refuses to run without SEED_ADMIN_EMAIL and
 * SEED_ADMIN_PASSWORD, rather than inventing a guessable default — which is
 * right. But chaining it into the start command with `&&` would mean a missing
 * variable takes the whole site down, and a site that will not start is a worse
 * outcome than a site with no admin yet.
 *
 * So a seed failure is reported and stepped over. The server starts either way;
 * anyone can still register, and the seed runs again on the next boot once the
 * variables are set.
 *
 * It is safe to run on every boot: the seed leaves the accounts alone as soon as
 * one active administrator exists, so it cannot resurrect a deleted admin or
 * reset a password that has since been changed.
 */

import { spawnSync } from "node:child_process";

const hasCredentials =
  Boolean(process.env.SEED_ADMIN_EMAIL?.trim()) &&
  Boolean(process.env.SEED_ADMIN_PASSWORD?.trim());

if (!hasCredentials) {
  console.log(
    "\n  seed: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set, so no\n" +
      "  administrator was created. The site starts normally and anyone can\n" +
      "  register, but nobody will have admin rights until those two variables\n" +
      "  are set and the service is redeployed.\n",
  );
  process.exit(0);
}

const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  console.warn(
    "\n  seed: did not complete (exit " +
      `${result.status}). Starting the server anyway — see the output above.\n` +
      "  Nothing is broken by this; it can be re-run by redeploying.\n",
  );
}

// Always zero. The server must start regardless of what happened here.
process.exit(0);
