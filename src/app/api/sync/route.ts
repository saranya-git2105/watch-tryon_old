import { NextResponse } from "next/server";

// A global in-memory store for the sync session (survives dev-mode hot reloads)
// In production, you would use Redis or S3.
const syncStore = new Map<string, string>();

export async function POST(req: Request) {
  try {
    const { id, image, wristSide } = await req.json();
    if (!id || !image) return NextResponse.json({ error: "Missing ID or Image" }, { status: 400 });
    
    syncStore.set(id, JSON.stringify({ image, wristSide: wristSide || "LEFT" }));
    return NextResponse.json({ success: true, message: "Wrist data beamed to nexus" });
  } catch (err) {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "No session ID" }, { status: 400 });

  const rawData = syncStore.get(id);
  if (!rawData) return NextResponse.json({ status: "WAITING" });

  try {
      const data = JSON.parse(rawData);
      return NextResponse.json({ status: "READY", image: data.image, wristSide: data.wristSide });
  } catch(e) {
      return NextResponse.json({ status: "READY", image: rawData, wristSide: "LEFT" });
  }
}
