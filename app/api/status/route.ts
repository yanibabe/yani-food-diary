import { connection } from "next/server";
import { aiStatus } from "@/app/lib/server/ai";

export async function GET() {
  await connection(); // always check the live server settings, never a cached copy
  return Response.json(aiStatus());
}
