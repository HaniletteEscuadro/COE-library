/**
 * Minimal ambient types for `better-sqlite3`.
 *
 * The package ships no declarations and `@types/better-sqlite3` is not
 * installed. Rather than pull in the full DefinitelyTyped surface for the three
 * members `src/lib/backup.ts` actually touches, this declares those — which
 * also means the compiler checks the calls we make instead of widening the
 * whole module to `any`.
 *
 * `backup()` is SQLite's online backup API and returns a promise; the rest of
 * the driver is reached through Prisma's adapter, never directly.
 */
declare module "better-sqlite3" {
  interface DatabaseOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
  }

  interface BackupProgress {
    totalPages: number;
    remainingPages: number;
  }

  interface BackupOptions {
    progress?: (info: BackupProgress) => number | void;
  }

  class Database {
    constructor(filename: string, options?: DatabaseOptions);
    readonly name: string;
    readonly open: boolean;
    backup(destination: string, options?: BackupOptions): Promise<BackupProgress>;
    pragma(source: string, options?: { simple?: boolean }): unknown;
    close(): this;
  }

  export = Database;
}
