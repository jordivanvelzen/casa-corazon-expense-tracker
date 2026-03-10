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
    const { date, deductions }: { date: string; deductions: Deduction[] } = body;

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
    const rentPage = await notion.pages.create({
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

    const rentId = rentPage.id;

    // 2. Link each deduction to the rent entry via Settlement relation
    for (const d of deductions) {
      await notion.pages.update({
        page_id: d.id,
        properties: {
          Settlement: { relation: [{ id: rentId }] },
        } as Parameters<typeof notion.pages.update>[0]["properties"],
      });
    }

    return NextResponse.json({
      success: true,
      rentId,
      adjustedAmount,
      deductionsCount: deductions.length,
    });
  } catch (error) {
    console.error("Failed to create rent entry:", error);
    return NextResponse.json(
      { error: "Failed to create rent entry" },
      { status: 500 }
    );
  }
}
