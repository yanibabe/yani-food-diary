// Yani's Parts Studio: read and save the face parts file. Works ONLY on her Mac (npm run dev).
// On the live site this does not exist (404), so nobody can change the parts from outside.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { checkLibrary } from "@/app/lib/buddy/elements";

const FILE = path.join(process.cwd(), "app/lib/buddy/studio-parts.json");
const devOnly = () => process.env.NODE_ENV !== "development";
const notFound = () => new Response("Not found", { status: 404 });

export async function GET() {
  await connection();
  if (devOnly()) return notFound();
  const v = checkLibrary(JSON.parse(await readFile(FILE, "utf8")));
  return v.ok ? Response.json(v.library) : Response.json({ error: v.error }, { status: 500 });
}

export async function PUT(req: Request) {
  await connection();
  if (devOnly()) return notFound();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Not JSON" }, { status: 400 });
  }
  const v = checkLibrary(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  await writeFile(FILE, JSON.stringify(v.library, null, 2) + "\n", "utf8");
  return Response.json({ ok: true, count: v.library.parts.length });
}
