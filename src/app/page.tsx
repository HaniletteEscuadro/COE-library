import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await getCurrentAuth();

  redirect(auth ? "/dashboard" : "/auth/login");
}
