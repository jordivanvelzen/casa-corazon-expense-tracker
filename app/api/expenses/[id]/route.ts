import { NextRequest, NextResponse } from "next/server";
import { notion } from "@/lib/notion";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const properties: Record<string, unknown> = {};

    if (body.status !== undefined) {
      properties.Status = { select: { name: body.status } };
    }

    if (body.toDiscuss !== undefined) {
      properties["To discuss"] = { checkbox: body.toDiscuss };
    }

    if (body.notes !== undefined) {
      properties.Notes = {
        rich_text: [{ text: { content: body.notes } }],
      };
    }

    if (body.split !== undefined) {
      properties.Split = body.split
        ? { select: { name: body.split } }
        : { select: null };
    }

    if (body.karensOwes !== undefined) {
      properties["Karen Owes"] = { number: body.karensOwes };
    }

    if (body.settlement !== undefined) {
      properties.Settlement = {
        relation: body.settlement.map((sid: string) => ({ id: sid })),
      };
    }

    if (body.imageUrl !== undefined) {
      properties.Image = { url: body.imageUrl ?? null };
    }

    await notion.pages.update({
      page_id: id,
      properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update expense:", error);
    return NextResponse.json(
      { error: "Failed to update expense" },
      { status: 500 }
    );
  }
}
