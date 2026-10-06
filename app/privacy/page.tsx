import type { Metadata } from "next";
import LegalPage, { Contact, LEGAL_NAME } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · DevFlow", description: "What DevFlow stores, who processes it, and how long it is kept." };

export default function PrivacyPage() {
    return (
        <LegalPage title="Privacy Policy" updated="October 2026">
            <p>
                This explains what DevFlow stores about you and your workflows, who helps process it, and the choices you have. DevFlow is run by <strong>{LEGAL_NAME}</strong>. Questions: <Contact />.
            </p>

            <section>
                <h2>What we store</h2>
                <ul>
                    <li><strong>Your account:</strong> name, email address, and a one-way hash of your password (we can&apos;t read your password). Whether your email is verified.</li>
                    <li><strong>Sign-in sessions:</strong> a session token, plus the IP address and browser details of the device, so you can stay signed in and we can limit abuse.</li>
                    <li><strong>Your workflows:</strong> the nodes, connections and settings you build, including the sample data you type into them.</li>
                    <li><strong>Run history:</strong> the result of each run, including what each step received and returned. This can include personal data from the services you connect. We keep each workflow&apos;s latest 100 runs for 30 days, then delete them. Deleting a workflow deletes its run history immediately.</li>
                    <li><strong>Saved credentials:</strong> API keys, tokens and webhook URLs you add. They are encrypted before they are stored and are never shown again; they are decrypted only while one of your workflows runs.</li>
                    <li><strong>Webhook calls:</strong> data sent to your workflow&apos;s webhook is processed by that run and appears in its run history like any other input.</li>
                </ul>
            </section>

            <section>
                <h2>Who else handles it</h2>
                <ul>
                    <li><strong>Database hosting</strong> (Neon, PostgreSQL) stores all of the above.</li>
                    <li><strong>App hosting</strong> runs the service and sees requests as they pass through.</li>
                    <li><strong>Groq</strong> (AI model provider) receives the descriptions you type into the chat and the text an AI step in your workflow sends. Don&apos;t put secrets or personal data in prompts you aren&apos;t comfortable sending to an AI provider.</li>
                    <li><strong>Resend</strong> (email delivery), only if this service has email turned on, receives your email address to send account emails. It also delivers emails that your own workflows send, using your Resend key.</li>
                    <li><strong>Services your workflows call</strong> (Slack, Discord, any URL you enter) receive whatever you configure your workflows to send them.</li>
                </ul>
                <p className="mt-3">We don&apos;t sell personal data, we don&apos;t run advertising, and the app contains no analytics or third-party tracking scripts.</p>
            </section>

            <section>
                <h2>Cookies</h2>
                <p>DevFlow sets only the cookies it needs to keep you signed in. Your theme choice is kept in your browser&apos;s local storage. There are no marketing or analytics cookies.</p>
            </section>

            <section>
                <h2>Your choices</h2>
                <ul>
                    <li><strong>See and export</strong> your workflows from Settings (Export all workflows).</li>
                    <li><strong>Delete</strong> workflows, saved credentials and run history yourself in the app.</li>
                    <li><strong>Delete your account</strong> and everything in it, or ask what we hold about you, by emailing <Contact />.</li>
                </ul>
            </section>

            <section>
                <h2>Security</h2>
                <p>Connections are encrypted (HTTPS), passwords are hashed, saved credentials are encrypted at rest, and requests that try to reach private networks from a workflow are blocked. No service is perfectly secure; if we learn that your data was exposed we will tell you.</p>
            </section>

            <section>
                <h2>Changes</h2>
                <p>If this policy changes in a way that matters, we will say so in the app before it takes effect.</p>
            </section>
        </LegalPage>
    );
}
