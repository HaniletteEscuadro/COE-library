/**
 * POST /api/library/resolve-folder
 *
 * Turn the portal's folder coordinates into a real LibraryFolder id, creating
 * any missing level on the way down.
 *
 * WHY THIS EXISTS
 * ---------------
 * `createMaterial` inherits a material's course/year/subject from its folder
 * row rather than from the upload payload, so an upload cannot be classified
 * unless a matching folder already exists. The portal, however, addresses
 * folders by coordinates it derives from its own tree
 * ("CE" / "1st Year" / "MAT 171 - CALCULUS 1" / "Handouts") and has no idea
 * what a folder id is.
 *
 * `POST /api/library/folders` cannot fill that gap: it is admin-only and takes
 * a parentId, so a faculty member uploading into a subject that has not been
 * seeded yet would be stuck.
 *
 * PERMISSIONS
 * -----------
 * Gated on `canUpload`, not on `canModerate`. Creating the folder a material is
 * about to go into is part of uploading it — but the levels this may create are
 * fixed (COURSE > YEAR > SUBJECT > CATEGORY) and it can only ever create
 * unrestricted folders, so this is not a way to get general folder-admin
 * rights. An existing `restricted` folder is returned as-is and still enforces
 * its own upload rule inside `createMaterial`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { verifyCsrf, csrfError } from "@/lib/security";
import { canUpload, slugify } from "@/lib/library";
import { prisma } from "@/lib/prisma";
import { emitRealtime } from "@/lib/realtime";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * The category level. Kept in step with MATERIAL_CATEGORIES in the portal's
 * enhanced-library.js — a value outside this set would create a folder the
 * portal's tree cannot render.
 */
const CATEGORIES = ["Reference Books", "Handouts", "Video Lectures", "Lessons", "GDrive Links"] as const;

const bodySchema = z.object({
  course: z.string().trim().min(1).max(40),
  year: z.string().trim().max(40).optional().default(""),
  subject: z.string().trim().max(160).optional().default(""),
  category: z.enum(CATEGORIES).optional(),
});

/** Human label for a course code, matching the portal's breadcrumb. */
function courseLabel(course: string) {
  if (course === "CE") return "Civil Engineering";
  if (course === "EE") return "Electrical Engineering";
  return course;
}

type Level = {
  name: string;
  kind: "COURSE" | "YEAR" | "SUBJECT" | "CATEGORY";
  course: string | null;
  year: string | null;
  subject: string | null;
};

/**
 * Find a folder by its slug under a parent, or create it.
 *
 * Races are real here: two people uploading into a brand-new subject at the
 * same moment would both find nothing and both try to create it. The unique
 * constraint on (parentId, slug) makes the loser's insert fail, and that is
 * caught and turned back into a lookup rather than a 500.
 */
async function findOrCreate(parent: { id: string; path: string } | null, level: Level, actorId: string) {
  const slug = slugify(level.name);
  const parentId = parent?.id ?? null;

  const existing = await prisma.libraryFolder.findFirst({
    where: { parentId, slug, deletedAt: null },
  });

  if (existing) return existing;

  const path = `${parent ? parent.path : "/"}${slug}/`;

  try {
    const created = await prisma.libraryFolder.create({
      data: {
        parentId,
        name: level.name,
        slug,
        path,
        kind: level.kind,
        course: level.course,
        year: level.year,
        subject: level.subject,
        // Never restricted: this route may only ever widen the tree, not
        // create a folder that locks other people out.
        restricted: false,
        createdById: actorId,
      },
    });

    emitRealtime("folder:changed", {
      id: created.id,
      parentId: created.parentId,
      name: created.name,
      path: created.path,
    });

    return created;
  } catch {
    // Lost the race — the other request created it. Read it back.
    const raced = await prisma.libraryFolder.findFirst({
      where: { parentId, slug, deletedAt: null },
    });

    if (raced) return raced;
    throw new Error(`Could not create or find the folder "${level.name}".`);
  }
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!canUpload(auth.user.role)) {
    return NextResponse.json(
      { message: "Your account does not have permission to upload." },
      { status: 403 },
    );
  }

  if (!verifyCsrf(request)) {
    return csrfError();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid folder coordinates." },
      { status: 400 },
    );
  }

  const { course, year, subject, category } = parsed.data;

  // Built top-down; each level carries the classification the material will
  // inherit. A blank level stops the descent, so an upload aimed at a course
  // with no subject still lands somewhere sensible.
  const levels: Level[] = [
    { name: courseLabel(course), kind: "COURSE", course, year: null, subject: null },
  ];

  if (year) {
    levels.push({ name: year, kind: "YEAR", course, year, subject: null });

    if (subject) {
      levels.push({ name: subject, kind: "SUBJECT", course, year, subject });

      if (category) {
        levels.push({ name: category, kind: "CATEGORY", course, year, subject });
      }
    }
  }

  try {
    let parent: { id: string; path: string } | null = null;

    for (const level of levels) {
      parent = await findOrCreate(parent, level, auth.user.id);
    }

    const folder = parent!;

    return NextResponse.json({
      folderId: folder.id,
      path: (folder as { path: string }).path,
    });
  } catch (error) {
    console.error("[api/library/resolve-folder]", error);
    return NextResponse.json({ message: "Could not resolve that folder." }, { status: 500 });
  }
}
