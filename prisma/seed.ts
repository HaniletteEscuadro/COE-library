/**
 * Database seed.
 *
 * Idempotent — every write is an `upsert`, so running it twice is safe and
 * never produces duplicate rows.
 *
 * Changes from the previous version:
 *   * Creates the first ADMIN account. Without one, nobody could reach the
 *     admin dashboard on a fresh database.
 *   * `authors` / `subjects` are JSON strings, not arrays (SQLite has no
 *     scalar lists).
 *   * `metadata` is a JSON string, not an object.
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword, normalizeEmail, normalizeUsername } from "../src/lib/security";

/** Fail loudly rather than silently seeding a guessable admin password. */
function requireEnv(key: string) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(
      `Missing ${key}. Set it in .env before seeding — refusing to create an ` +
        `admin account with a default password.`,
    );
  }

  return value;
}

async function seedAdmin() {
  /*
   * Only ever seeds the FIRST administrator.
   *
   * The seed's job is to make sure nobody can be locked out of a brand-new
   * database. Once a real administrator exists, that job is done, and running
   * the seed again must leave the accounts alone.
   *
   * It used to upsert unconditionally. Deleting the default admin — a
   * reasonable thing to do after making your own — freed its email address, so
   * the next `npm run setup` created it again: a fresh administrator with the
   * password from .env, back on the system, without anybody asking for it.
   */
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
    select: { email: true, username: true },
  });

  if (existingAdmin) {
    console.log(
      `  admin: ${existingAdmin.username} already exists — leaving accounts untouched`,
    );
    return;
  }

  const email = normalizeEmail(requireEnv("SEED_ADMIN_EMAIL"));
  const username = normalizeUsername(process.env.SEED_ADMIN_USERNAME || "@admin");
  const name = process.env.SEED_ADMIN_NAME?.trim() || "COE Administrator";
  const password = requireEnv("SEED_ADMIN_PASSWORD");

  if (password.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.upsert({
    where: { email },
    // Re-running the seed must not silently reset a password the admin has
    // since changed, so `update` deliberately leaves `passwordHash` alone.
    update: {
      name,
      username,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: new Date(),
      deletedAt: null,
    },
    create: {
      name,
      username,
      email,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      discipline: "COE",
      // Pre-verified: there is no mail delivery yet, and the first admin must
      // be able to sign in immediately.
      emailVerified: new Date(),
      passwordChangedAt: new Date(),
    },
  });

  console.log(`  admin: ${admin.email} (${admin.username})`);

  return admin;
}

async function seedAcademics() {
  const coe = await prisma.academicDepartment.upsert({
    where: { code: "COE" },
    update: {
      name: "College of Engineering",
      description: "Engineering and technology programs.",
    },
    create: {
      code: "COE",
      name: "College of Engineering",
      description: "Engineering and technology programs.",
    },
  });

  // Programs matching the course options offered on the portal's signup form.
  const programs = [
    { code: "BSCE", name: "Bachelor of Science in Civil Engineering" },
    { code: "BSEE", name: "Bachelor of Science in Electrical Engineering" },
    { code: "BSIT", name: "Bachelor of Science in Information Technology" },
  ];

  for (const program of programs) {
    await prisma.academicProgram.upsert({
      where: { code: program.code },
      update: { departmentId: coe.id, name: program.name },
      create: {
        departmentId: coe.id,
        code: program.code,
        name: program.name,
        degreeLevel: "Bachelor",
        durationYears: 4,
      },
    });
  }

  const programming = await prisma.course.upsert({
    where: { code: "IT101" },
    update: { departmentId: coe.id, title: "Introduction to Programming", credits: 3 },
    create: {
      departmentId: coe.id,
      code: "IT101",
      title: "Introduction to Programming",
      description: "Programming fundamentals, problem solving, and basic software design.",
      credits: 3,
    },
  });

  await prisma.course.upsert({
    where: { code: "IT203" },
    update: { departmentId: coe.id, title: "Database Systems", credits: 3 },
    create: {
      departmentId: coe.id,
      code: "IT203",
      title: "Database Systems",
      description: "Relational modeling, SQL, normalization, indexing, and transactions.",
      credits: 3,
    },
  });

  await prisma.courseSection.upsert({
    where: {
      courseId_sectionCode_term_academicYear: {
        courseId: programming.id,
        sectionCode: "A",
        term: "1st Semester",
        academicYear: "2026-2027",
      },
    },
    update: { status: "OPEN", capacity: 40, schedule: "MWF 08:00-09:00", room: "ENG-201" },
    create: {
      courseId: programming.id,
      sectionCode: "A",
      term: "1st Semester",
      academicYear: "2026-2027",
      status: "OPEN",
      capacity: 40,
      schedule: "MWF 08:00-09:00",
      room: "ENG-201",
    },
  });
}

async function seedLibrary() {
  const books = [
    {
      isbn: "9780132350884",
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      publisher: "Prentice Hall",
      publicationYear: 2008,
      category: "Software Engineering",
      subjects: ["Programming", "Maintainability"],
    },
    {
      isbn: "9780321125217",
      title: "Domain-Driven Design",
      authors: ["Eric Evans"],
      publisher: "Addison-Wesley",
      publicationYear: 2003,
      category: "Software Architecture",
      subjects: ["Architecture", "Modeling"],
    },
  ];

  for (const book of books) {
    // Scalar lists are unsupported on SQLite, so these columns hold JSON text.
    const authors = JSON.stringify(book.authors);
    const subjects = JSON.stringify(book.subjects);

    await prisma.libraryBook.upsert({
      where: { isbn: book.isbn },
      update: { title: book.title, authors, subjects, category: book.category },
      create: {
        isbn: book.isbn,
        title: book.title,
        authors,
        subjects,
        publisher: book.publisher,
        publicationYear: book.publicationYear,
        category: book.category,
      },
    });
  }
}

/**
 * Build the Engineering Library folder tree:
 *
 *   Course > Year > Subject > Category
 *
 * Idempotent via the `[parentId, slug]` unique constraint, so re-running only
 * fills in what is missing and never duplicates a branch.
 */
async function seedLibraryTree() {
  const { COURSES, YEARS, CATEGORIES, CURRICULUM } = await import("./curriculum");
  const { slugify } = await import("../src/lib/library");

  let created = 0;

  /** Upsert one node and return it, so children can chain off its path. */
  async function ensureFolder(input: {
    parentId: string | null;
    parentPath: string;
    name: string;
    kind: string;
    icon?: string;
    course?: string | null;
    year?: string | null;
    subject?: string | null;
    position: number;
    restricted?: boolean;
  }) {
    const slug = slugify(input.name);
    const path = `${input.parentPath}${slug}/`;

    const existing = await prisma.libraryFolder.findFirst({
      where: { parentId: input.parentId, slug },
    });

    if (existing) return existing;

    created += 1;

    return prisma.libraryFolder.create({
      data: {
        parentId: input.parentId,
        name: input.name,
        slug,
        path,
        kind: input.kind,
        icon: input.icon ?? null,
        course: input.course ?? null,
        year: input.year ?? null,
        subject: input.subject ?? null,
        department: "College of Engineering",
        position: input.position,
        restricted: input.restricted ?? false,
      },
    });
  }

  for (const [courseIndex, course] of COURSES.entries()) {
    const courseFolder = await ensureFolder({
      parentId: null,
      parentPath: "/",
      name: course.name,
      kind: "COURSE",
      icon: "engineering",
      course: course.code,
      position: courseIndex,
    });

    for (const [yearIndex, year] of YEARS.entries()) {
      const yearFolder = await ensureFolder({
        parentId: courseFolder.id,
        parentPath: courseFolder.path,
        name: year,
        kind: "YEAR",
        icon: "calendar_month",
        course: course.code,
        year,
        position: yearIndex,
      });

      const subjects = CURRICULUM[course.code]?.[year] ?? [];

      for (const [subjectIndex, subject] of subjects.entries()) {
        const subjectFolder = await ensureFolder({
          parentId: yearFolder.id,
          parentPath: yearFolder.path,
          name: subject,
          kind: "SUBJECT",
          icon: "menu_book",
          course: course.code,
          year,
          subject,
          position: subjectIndex,
        });

        for (const [categoryIndex, category] of CATEGORIES.entries()) {
          await ensureFolder({
            parentId: subjectFolder.id,
            parentPath: subjectFolder.path,
            name: category.name,
            kind: "CATEGORY",
            icon: category.icon,
            course: course.code,
            year,
            subject,
            position: categoryIndex,
          });
        }
      }
    }
  }

  console.log(`  library tree: ${created} folder(s) created`);
}

async function main() {
  console.log("Seeding database...");

  await seedAdmin();
  await seedAcademics();
  await seedLibrary();
  await seedLibraryTree();

  await prisma.auditLog.create({
    data: {
      action: "IMPORT",
      entity: "SYSTEM",
      message: "Seed data applied for education platform baseline.",
      metadata: JSON.stringify({ source: "prisma/seed.ts" }),
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
