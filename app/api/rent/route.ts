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
    const {
      rentId,
      date,
      deductions,
    }: { rentId?: string; date: string; deductions: Deduction[] } = body;

    const totalDeductions = deductions.reduce((sum, d) => sum + d.karenOwes, 0);
    const adjustedAmount = Math.max(
      0,
      Math.round((BASE_RENT - totalDeductions) * 100) / 100
    );

    // Calculate carry-over (when deductions exceed base rent)
    const excessAmount = Math.max(
      0,
      Math.round((totalDeductions - BASE_RENT) * 100) / 100
    );

    // Build breakdown note
    const noteLines = [`Base rent: $${BASE_RENT.toLocaleString()}`];
    for (const d of deductions) {
      noteLines.push(`- ${d.item}: -$${d.karenOwes.toFixed(2)}`);
    }
    if (deductions.length > 0) {
      noteLines.push(`Adjusted: $${adjustedAmount.toLocaleString()}`);
    }
    if (excessAmount > 0) {
      noteLines.push(`Carry-over to next month: $${excessAmount.toFixed(2)}`);
    }
    const notes = noteLines.join("\n");

    if (rentId) {
      // ── UPDATE existing pending rent entry ──
      await notion.pages.update({
        page_id: rentId,
        properties: {
          "Amount (MXN)": { number: adjustedAmount },
          Status: { select: { name: "Paid" } },
          Notes: { rich_text: [{ text: { content: notes } }] },
        } as Parameters<typeof notion.pages.update>[0]["properties"],
      });
    } else {
      // ── CREATE new rent entry ──
      const item = generateItemName("Rent", "Recurring Bill", date);
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
    }

    // ── Create Settlement entry for deductions (if any) ──
    if (deductions.length === 0) {
      return NextResponse.json({ success: true, adjustedAmount, deductionsCount: 0 });
    }

    const d = new Date(date + "T00:00:00");
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = String(d.getFullYear()).slice(-2);
    const settlementName = `Settlement ${month} ${year} · Rent`;

    const settlementPage = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        Item: { title: [{ text: { content: settlementName } }] },
        "Amount (MXN)": { number: Math.round(totalDeductions * 100) / 100 },
        "Karen Owes": { number: 0 },
        Date: { date: { start: date } },
        Type: { select: { name: "Settlement" } },
        "Settlement Method": { select: { name: "Rent deduction" } },
        Status: { select: { name: "Paid" } },
        "To discuss": { checkbox: false },
      } as Parameters<typeof notion.pages.create>[0]["properties"],
    });

    const settlementId = settlementPage.id;

    // Link each deduction to the Settlement entry
    for (const ded of deductions) {
      await notion.pages.update({
        page_id: ded.id,
        properties: {
          Settlement: { relation: [{ id: settlementId }] },
        } as Parameters<typeof notion.pages.update>[0]["properties"],
      });
    }

    // ── Create carry-over entry if deductions exceeded base rent ──
    if (excessAmount > 0) {
      const baseDate = new Date(date + "T00:00:00");
      const nextMonthDate = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth() + 1,
        1
      );
      const nextDateStr = `${nextMonthDate.getFullYear()}-${String(
        nextMonthDate.getMonth() + 1
      ).padStart(2, "0")}-01`;
      const currentMonthLabel = baseDate.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });

      await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: {
          Item: {
            title: [
              {
                text: {
                  content: `Rent carry-over — ${currentMonthLabel}`,
                },
              },
            ],
          },
          "Amount (MXN)": { number: excessAmount },
          "Karen Owes": { number: excessAmount },
          Date: { date: { start: nextDateStr } },
          Category: { select: { name: "Other" } },
          "Paid By": { select: { name: "Nash & Jordi" } },
          Split: { select: { name: "Deduct from rent" } },
          Type: { select: { name: "One-Off" } },
          Status: { select: { name: "Paid" } },
          "To discuss": { checkbox: false },
          Notes: {
            rich_text: [
              {
                text: {
                  content: `Deductions in ${currentMonthLabel} exceeded base rent by $${excessAmount.toFixed(
                    2
                  )}. Carried over automatically.`,
                },
              },
            ],
          },
        } as Parameters<typeof notion.pages.create>[0]["properties"],
      });
    }

    return NextResponse.json({
      success: true,
      adjustedAmount,
      deductionsCount: deductions.length,
      settlementId,
      carryOver: excessAmount > 0 ? excessAmount : undefined,
    });
  } catch (error) {
    console.error("Failed to process rent:", error);
    return NextResponse.json(
      { error: "Failed to process rent" },
      { status: 500 }
    );
  }
}
