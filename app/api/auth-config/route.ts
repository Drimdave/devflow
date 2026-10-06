import { NextResponse } from "next/server";
import { mailMode } from "@/lib/auth-mail";
import { MIN_PASSWORD } from "@/lib/password-policy";

export const dynamic = "force-dynamic";

// Public: lets the sign-in page show "Forgot password?" and the right hints only when they will actually work.
export async function GET() {
    return NextResponse.json({ emailEnabled: mailMode() !== "off", minPassword: MIN_PASSWORD });
}
