import { NextRequest, NextResponse } from "next/server";
import { notion, DATABASE_ID } from "@/lib/notion";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      date,
      amount,
      method,
      itemIds,
    }: {
      name: string;
      date: string;
      amount: number;
      method: string;
      itemIds: string[];
    } = body;

    // 1. Create Settlement entry
    const settlementPage = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        Item: { title: [{ text: { content: name } }] },
        "Amount (MXN)": { number: amount },
        "Karen Owes": { number: 0 },
        Date: { date: { start: date } },
        Type: { select: { name: "Settlement" } },
        "Settlement Method": { select: { name: method } },
        Status: { select: { name: "Paid" } },
        "To discuss": { checkbox: false },
      } as Parameters<typeof notion.pages.create>[0]["properties"],
    });

    const settlementId = settlementPage.id;

    // 2. Link each expense to the settlement entry
    for (const itemId of itemIds) {
      await notion.pages.update({
        page_id: itemId,
        properties: {
          Settlement: {
            relation: [{ id: settlementId }],
          },
        } as Parameters<typeof notion.pages.update>[0]["properties"],
      });
    }

    return NextResponse.json({ success: true, settlementId });
  } catch (error) {
    console.error("Failed to create settlement:", error);
    return NextResponse.json(
      { error: "Failed to create settlement" },
      { status: 500 }
    );
  }
}
