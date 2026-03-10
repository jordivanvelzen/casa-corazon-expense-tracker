import { NextResponse } from "next/server";

const BASE_RENT = Number(process.env.BASE_RENT_MXN) || 3000;

export async function GET() {
  return NextResponse.json({ baseRent: BASE_RENT });
}
