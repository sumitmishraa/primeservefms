import { NextResponse } from "next/server";

/** Placeholder messages API route */
export async function GET() {
  return NextResponse.json({ message: "Messages API — placeholder" });
}
