import { NextRequest, NextResponse } from "next/server";
import { notion, DATABASE_ID } from "@/lib/notion";
import { generateItemName } from "@/lib/generateItemName";

const BASE_RENT = Number(process.env.BASE_RENT_MXN) || 3000;

interface Deduction {
  id: string;
  karenOwes: number;
  item: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, deductions }: { date: string; deductions: Deduction[] } =
      body;

    const totalDeductions = deductions.reduce((sum, d) => sum + d.karenOwes, 0);
    const adjustedAmount = Math.max(
      0,
      Math.round((BASE_RENT - totalDeductions) * 100) / 100
    );

    const item = generateItemName("Rent", "Recurring Bill", date);

    // Build breakdown note
    const noteLines = [`Base rent: $${BASE_RENT.toLocaleString()}`];
    for (const d of deductions) {
      noteLines.push(`- ${d.item}: -$${d.karenOwes.toFixed(2)}`);
    }
    if (deductions.length > 0) {
      noteLines.push(`Adjusted: $${adjustedAmount.toLocaleString()}`);
    }
    const notes = noteLines.join("\n");

    // 1. Create rent entry
    await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        Item: { title: [{ text: { content: item } }] },
        "Amount (MXN)": { number: adjustedAmount },
        "Karen Owes": { number: 0 },
        Date: { date: { start: date } },
        Category: { select: { name: "Rent" } },
        "Paid By": { select: { name: "Nash & Jordi" } },
        Split: { select: { name: "N&J only" } },
        Type: { select: { name: "Recurring Bill" } },
        Status: { select: { name: "Paid" } },
        "To discuss": { checkbox: false },
        Notes: { rich_text: [{ text: { content: notes } }] },
      } as Parameters<typeof notion.pages.create>[0]["properties"],
    });

    if (deductions.length === 0) {
      return NextResponse.json({
        success: true,
        adjustedAmount,
        deductionsCount: 0,
      });
    }

    // 2. Build settlement name: "Settlement Mar 26 · Rent"
    const d = new Date(date + "T00:00:00");
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = String(d.getFullYear()).slice(-2);
    const settlementName = `Settlement ${month} ${year} · Rent`;

    // 3. Create Settlement entry for the deductions
    const settlementPage = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        Item: { title: [{ text: { content: settlementName } }] },
        "Amount (MXN)": {
          number: Math.round(totalDeductions * 100) / 100,
        },
        "Karen Owes": { number: 0 },
        Date: { date: { start: date } },
        Type: { select: { name: "Settlement" } },
        "Settlement Method": { select: { name: "Rent deduction" } },
        Status: { select: { name: "Paid" } },
        "To discuss": { checkbox: false },
      } as Parameters<typeof notion.pages.create>[0]["properties"],
    });

    const settlementId = settlementPage.id;

    // 4. Link each deduction to the Settlement entry
    for (const ded of deductions) {
      await notion.pages.update({
        page_id: ded.id,
        properties: {
          Settlement: { relation: [{ id: settlementId }] },
        } as Parameters<typeof notion.pages.update>[0]["properties"],
      });
    }

    return NextResponse.json({
      success: true,
      adjustedAmount,
      deductionsCount: deductions.length,
      settlementId,
    });
  } catch (error) {
    console.error("Failed to create rent entry:", error);
    return NextResponse.json(
      { error: "Failed to create rent entry" },
      { status: 500 }
    );
  }
}
