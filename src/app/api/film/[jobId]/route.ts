import { NextResponse } from "next/server";
import { readFilm } from "@/lib/agent/engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const status = await readFilm(jobId);

  if (!status) {
    return NextResponse.json({ error: "No such render." }, { status: 404 });
  }

  return NextResponse.json(status);
}
