import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { purchaseShopItem } from "@/server/journey/journey.service";
import { shopPurchaseSchema } from "@/server/validators/journey";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (!session.ok) return session.response;
    const userId = session.user.id;

    const body = await request.json();
    const parsed = shopPurchaseSchema.omit({ userId: true }).parse({ itemSlug: body.itemSlug, quantity: body.quantity });
    const result = await purchaseShopItem({ ...parsed, userId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to purchase item" }, { status: 400 });
  }
}

