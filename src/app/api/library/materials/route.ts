/**
 * GET /api/library/materials
 *
 * The shared library feed. Every signed-in account queries the same table, so
 * two different users with the same filters see exactly the same results —
 * that is what makes this a shared drive rather than per-browser storage.
 *
 * Search, filter, sort and pagination all run in SQL against indexed columns;
 * nothing is filtered in JavaScript after the fact.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuth } from "@/lib/session";
import { listMaterials, canModerate } from "@/lib/library";
import { getViewerFlags } from "@/lib/library-social";
import { materialQuerySchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Sign in to browse the library." }, { status: 401 });
  }

  // URLSearchParams gives strings; the schema coerces numbers and booleans.
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = materialQuerySchema.safeParse(params);

  if (!parsed.success) {
    const { message, fieldErrors } = formatZodError(parsed.error);
    return NextResponse.json({ message, fieldErrors }, { status: 400 });
  }

  const query = parsed.data;

  // Only moderators may ask for anything other than APPROVED. Ignoring a
  // requested status rather than erroring keeps the UI simple, and a student
  // crafting ?status=PENDING still cannot see unreviewed uploads.
  const status = canModerate(auth.user.role) ? query.status : "APPROVED";

  try {
    const result = await listMaterials({ ...query, status });

    // The viewer's own like/favourite/bookmark state, batched into three
    // queries rather than three per card.
    const flags = await getViewerFlags(
      auth.user.id,
      result.materials.map((material) => material.id),
    );

    return NextResponse.json({
      ...result,
      materials: result.materials.map((material) => ({
        ...material,
        likedByMe: flags.liked.has(material.id),
        favoritedByMe: flags.favorited.has(material.id),
        bookmarkedByMe: flags.bookmarked.has(material.id),
      })),
    });
  } catch (error) {
    console.error("[api/library/materials]", error);
    return NextResponse.json({ message: "Could not load materials." }, { status: 500 });
  }
}
