import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Contact, LEGAL_NAME } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · DevFlow", description: "The rules for using DevFlow." };

export default function TermsPage() {
    return (
        <LegalPage title="Terms of Service" updated="October 2026">
            <p>
                These terms apply when you use DevFlow, which is run by <strong>{LEGAL_NAME}</strong>. By creating an account or using the service you agree to them. Questions: <Contact />.
            </p>

            <section>
                <h2>Your account</h2>
                <ul>
                    <li>Give accurate information and keep your password private. You are responsible for what happens under your account, including what your workflows do.</li>
                    <li>You must be old enough to form a binding contract where you live.</li>
                </ul>
            </section>

            <section>
                <h2>What you may do</h2>
                <p>Build automations for your own use and your own organisation. You keep ownership of your workflows and data; you give us permission to store and process them to provide the service.</p>
            </section>

            <section>
                <h2>What you may not do</h2>
                <ul>
                    <li>Break the law, or send spam, malware or harassing messages with a workflow.</li>
                    <li>Use the service to attack, scan or overload other systems, or try to reach private or internal networks.</li>
                    <li>Try to get around rate limits, security controls or other people&apos;s accounts and data.</li>
                    <li>Resell or share access in a way that hides who is actually using it.</li>
                </ul>
                <p className="mt-3">We may limit, pause or remove accounts and workflows that do this or that put the service at risk.</p>
            </section>

            <section>
                <h2>Limits and availability</h2>
                <p>To keep the service fair, runs, requests, emails, AI calls and stored history are limited (for example scheduled runs must be at least five minutes apart and run history is kept for 30 days). Limits can change. Scheduled and webhook runs depend on infrastructure that can fail or run late; don&apos;t rely on DevFlow alone for anything where a missed run causes serious harm.</p>
            </section>

            <section>
                <h2>Third-party services</h2>
                <p>Workflows can send data to services you choose, including AI providers. Your use of those is covered by their terms. You are responsible for having the right to send that data.</p>
            </section>

            <section>
                <h2>No warranty, and liability</h2>
                <p>DevFlow is provided &ldquo;as is&rdquo;, without promises that it will be uninterrupted or error-free. To the extent the law allows, we are not liable for indirect or consequential losses, or for losses from workflows you build or from data you send through them. Nothing here limits liability that can&apos;t legally be limited.</p>
            </section>

            <section>
                <h2>Ending things</h2>
                <p>You can stop using DevFlow and delete your data at any time (see the <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">Privacy Policy</Link>). We may suspend or end access if these terms are broken or the service is discontinued; we will give reasonable notice where we can.</p>
            </section>

            <section>
                <h2>Changes</h2>
                <p>If we change these terms in a way that matters, we will tell you in the app before it applies to you.</p>
            </section>
        </LegalPage>
    );
}
