import { NextRequest, NextResponse } from "next/server";
import { notion, DATABASE_ID } from "@/lib/notion";
import { Expense, Category, PaidBy, Split, ExpenseType, Status, SettlementMethod } from "@/lib/types";
import { calculateKarenOwes } from "@/lib/calculateKarenOwes";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

function getTitle(page: PageObjectResponse, name: string): string {
  const prop = page.properties[name];
  if (prop?.type === "title") {
    return prop.title.map((t) => t.plain_text).join("");
  }
  return "";
}

function getNumber(page: PageObjectResponse, name: string): number {
  const prop = page.properties[name];
  if (prop?.type === "number") {
    return prop.number ?? 0;
  }
  return 0;
}

function getDate(page: PageObjectResponse, name: string): string {
  const prop = page.properties[name];
  if (prop?.type === "date" && prop.date) {
    return prop.date.start;
  }
  return "";
}

function getSelect(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (prop?.type === "select" && prop.select) {
    return prop.select.name;
  }
  return null;
}

function getCheckbox(page: PageObjectResponse, name: string): boolean {
  const prop = page.properties[name];
  if (prop?.type === "checkbox") {
    return prop.checkbox;
  }
  return false;
}

function getRichText(page: PageObjectResponse, name: string): string {
  const prop = page.properties[name];
  if (prop?.type === "rich_text") {
    return prop.rich_text.map((t) => t.plain_text).join("");
  }
  return "";
}

function getRelation(page: PageObjectResponse, name: string): string[] {
  const prop = page.properties[name];
  if (prop?.type === "relation") {
    return prop.relation.map((r) => r.id);
  }
  return [];
}

function mapPageToExpense(page: PageObjectResponse): Expense {
  return {
    id: page.id,
    notionUrl: page.url,
    item: getTitle(page, "Item"),
    amount: getNumber(page, "Amount (MXN)"),
    karensOwes: getNumber(page, "Karen Owes"),
    date: getDate(page, "Date"),
    category: getSelect(page, "Category") as Category | null,
    paidBy: getSelect(page, "Paid By") as PaidBy | null,
    split: getSelect(page, "Split") as Split | null,
    type: getSelect(page, "Type") as ExpenseType | null,
    status: getSelect(page, "Status") as Status | null,
    settlementMethod: getSelect(page, "Settlement Method") as SettlementMethod | null,
    toDiscuss: getCheckbox(page, "To discuss"),
    notes: getRichText(page, "Notes"),
    settlement: getRelation(page, "Settlement"),
  };
}

export async function GET() {
  try {
    const allPages: PageObjectResponse[] = [];
    let hasMore = true;
    let cursor: string | undefined = undefined;

    while (hasMore && allPages.length < 500) {
      // Use REST API directly — SDK v5 removed databases.query
      const body: Record<string, unknown> = {
        sorts: [{ property: "Date", direction: "descending" }],
        page_size: 100,
      };
      if (cursor) body.start_cursor = cursor;

      const res = await fetch(
        `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      const response = await res.json();

      if (!res.ok || !Array.isArray(response.results)) {
        console.error("Notion API error:", JSON.stringify(response));
        return NextResponse.json(
          { error: "Notion API error", details: response.message || JSON.stringify(response) },
          { status: 502 }
        );
      }

      for (const page of response.results) {
        if (page && typeof page === "object" && "properties" in page) {
          allPages.push(page as PageObjectResponse);
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
    }

    const expenses = allPages.map(mapPageToExpense);
    return NextResponse.json(expenses);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch expenses:", message, error);
    return NextResponse.json(
      { error: "Failed to fetch expenses", details: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const karensOwes = calculateKarenOwes(body.amount, body.split, body.paidBy);

    const properties: Record<string, unknown> = {
      Item: {
        title: [{ text: { content: body.item || "" } }],
      },
      "Amount (MXN)": {
        number: body.amount,
      },
      "Karen Owes": {
        number: karensOwes,
      },
      Date: {
        date: { start: body.date },
      },
    };

    if (body.category) {
      properties.Category = { select: { name: body.category } };
    }
    if (body.paidBy) {
      properties["Paid By"] = { select: { name: body.paidBy } };
    }
    if (body.split) {
      properties.Split = { select: { name: body.split } };
    }
    if (body.type) {
      properties.Type = { select: { name: body.type } };
    }
    if (body.status) {
      properties.Status = { select: { name: body.status } };
    }
    if (body.settlementMethod) {
      properties["Settlement Method"] = {
        select: { name: body.settlementMethod },
      };
    }

    properties["To discuss"] = { checkbox: body.toDiscuss ?? false };

    if (body.notes) {
      properties.Notes = {
        rich_text: [{ text: { content: body.notes } }],
      };
    }

    const response = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
    });

    if ("properties" in response) {
      const expense = mapPageToExpense(response as PageObjectResponse);
      return NextResponse.json(expense, { status: 201 });
    }

    return NextResponse.json(
      { error: "Unexpected response from Notion" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Failed to create expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}
