import Link from "next/link";
import { ArrowRight, FileQuestion, House } from "lucide-react";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-content" aria-labelledby="not-found-title">
        <FileQuestion className="not-found-illustration" strokeWidth={1.5} aria-hidden="true" />
        <p className="not-found-eyebrow">404 · Page not found</p>
        <h1 id="not-found-title">We can&apos;t find this page.</h1>
        <p className="not-found-description">The link may be old, or the address may be wrong. You can go back to the start.</p>
        <div className="not-found-actions">
          <Link className="not-found-primary" href="/"><House aria-hidden="true" /> Go to home</Link>
          <Link className="not-found-secondary" href="/get-started">Choose sign in <ArrowRight aria-hidden="true" /></Link>
        </div>
        <p className="not-found-help">Still need help? Contact your doctor or clinic administrator for the right link.</p>
      </section>
    </main>
  );
}
