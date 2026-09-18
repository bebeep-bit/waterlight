import { NextResponse } from "next/server";
import { readRender } from "@/lib/agent/engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const status = readRender(jobId);

  if (!status) {
    return NextResponse.json({ error: "No such render." }, { status: 404 });
  }

  return NextResponse.json(status);
}
