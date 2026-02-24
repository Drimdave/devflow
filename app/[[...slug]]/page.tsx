import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ClientPage from "../ClientPage";
import LandingPage from "@/components/landing/LandingPage";

export default async function Page({
    params
}: {
    params: Promise<{ slug?: string[] }>
}) {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    const { slug } = await params;

    const isRoot = !slug || slug.length === 0;

    if (isRoot && !session) {
        return <LandingPage />;
    }

    if (!session) {
        redirect("/login");
    }

    return <ClientPage initialSlug={slug} />;
}
