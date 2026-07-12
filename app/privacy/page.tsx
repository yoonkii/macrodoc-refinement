import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg)]/80 border-b border-[var(--border)]">
        <div className="flex items-center h-14 px-5 max-w-4xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <div className="flex-1" />
          <h1 className="font-display text-lg font-bold text-[var(--text)]">
            Privacy Policy
          </h1>
          <div className="flex-1" />
          <div className="w-14" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="font-display text-2xl font-bold text-[var(--text)] text-center mb-8">
          Privacy Policy for Macro Doc Refinement
        </h2>

        <p className="font-sans text-sm text-[var(--text)] leading-relaxed mb-8">
          This policy explains what the Macro Doc Refinement browser extension
          and web app collect, where your data goes, and what we do not do with
          it. It covers both the Chrome extension and the web application at
          macrodocrefinement.com.
        </p>

        <PrivacySection title="Browser Extension">
          <PrivacySubsection title="Text You Refine:">
            When you refine a selection, only the text you selected is sent to
            the AI provider you choose. On the default (free) setting, your text
            is sent to Google&apos;s Gemini API through our proxy. If you
            configure your own model in the extension, your text is sent directly
            from your browser to that provider &mdash; OpenAI, Anthropic, Google,
            or xAI (Grok) &mdash; using your own API key. Your selected text is
            only transmitted at the moment you request a refinement. We do not
            retain it after the response is returned.
          </PrivacySubsection>
          <PrivacySubsection title="Style Profiles:">
            The style profiles that shape your refinements (their names,
            instructions, and example snippets) are stored locally in your
            browser using chrome.storage. They are included in the prompt sent to
            your chosen AI provider so the refinement matches your voice. They are
            not sent to any MDR-operated server other than as part of that prompt.
          </PrivacySubsection>
          <PrivacySubsection title="Bring-Your-Own-Model API Keys:">
            If you provide your own API key for OpenAI, Anthropic, Google, or xAI,
            that key is stored locally in your browser and is used only to
            authenticate requests you make directly to that provider. Your API
            keys are never transmitted to Macro Doc Refinement or our proxy, and
            we never see them.
          </PrivacySubsection>
          <PrivacySubsection title="Permissions and Browsing Activity:">
            The extension can read the text you actively select on a page in order
            to refine it, and it requests network access to the AI provider
            endpoints listed above so its requests work reliably. It does not
            collect your browsing history, track the pages you visit, or read page
            content you have not explicitly selected for refinement.
          </PrivacySubsection>
        </PrivacySection>

        <PrivacySection title="Web Application">
          <PrivacySubsection title="Text You Submit:">
            Text you submit on the web app is sent to the AI provider you select
            &mdash; the default Gemini proxy, or a provider of your choice using
            your own API key &mdash; solely to generate the refined output. We do
            not permanently store the text you submit or the refined result.
          </PrivacySubsection>
          <PrivacySubsection title="Local Storage:">
            Your settings, style profiles, and preferences are saved in your
            browser&apos;s localStorage so they persist between visits. This data
            stays in your browser and is not uploaded to an MDR-operated database.
          </PrivacySubsection>
          <PrivacySubsection title="Usage Analytics:">
            We collect anonymous, aggregate usage and performance analytics
            through Vercel Analytics and Speed Insights to understand traffic and
            keep the app fast. These tools do not receive the text you submit, the
            refined output, or your API keys.
          </PrivacySubsection>
          <PrivacySubsection title="Error Diagnostics:">
            When error reporting is enabled, we collect anonymous error
            diagnostics through Sentry to help us find and fix problems. Error
            reports are truncated and scrubbed of sensitive values before they are
            sent, and they do not include your submitted text, refined output, or
            API keys.
          </PrivacySubsection>
        </PrivacySection>

        <PrivacySection title="What We Do Not Do">
          <PrivacySubsection title="No Sale of Data:">
            We do not sell, rent, or trade your personal information or the content
            you submit to any third party.
          </PrivacySubsection>
          <PrivacySubsection title="No Advertising Profiles:">
            We do not use your content to build advertising or marketing profiles,
            and we do not share it for those purposes.
          </PrivacySubsection>
          <PrivacySubsection title="Third-Party AI Providers:">
            When your text is sent to an AI provider to produce a refinement, that
            provider processes it under its own privacy policy and terms. Review
            the policy of the provider you choose to configure to understand how it
            handles the requests you send.
          </PrivacySubsection>
        </PrivacySection>

        <PrivacySection title="Your Choices">
          <PrivacySubsection title="Controlling Your Data:">
            You can clear the style profiles, settings, and API keys stored in your
            browser at any time by clearing the extension&apos;s storage or your
            browser&apos;s site data for the web app. Removing the extension
            deletes the data it stored locally.
          </PrivacySubsection>
          <PrivacySubsection title="Sensitive Information:">
            We strongly advise against submitting sensitive, confidential, or
            personal information &mdash; such as identification numbers, financial
            details, or health data &mdash; because your text is transmitted to a
            third-party AI provider for processing.
          </PrivacySubsection>
        </PrivacySection>

        <PrivacySection title="Contact">
          <PrivacySubsection title="Questions:">
            If you have questions about this policy or how your data is handled,
            contact us at{" "}
            <a
              href="mailto:yoonki.yk.hong@gmail.com"
              className="text-[var(--amber)] hover:underline"
            >
              yoonki.yk.hong@gmail.com
            </a>
            .
          </PrivacySubsection>
        </PrivacySection>

        {/* Footer */}
        <hr className="border-[var(--border)] my-8" />

        <p className="text-sm italic text-[var(--text-muted)]">
          Last Updated: July 11, 2026
        </p>
        <p className="text-sm italic text-[var(--text-muted)] mt-2">
          We may update this policy as the product evolves. Material changes will
          be reflected here with a revised &ldquo;Last Updated&rdquo; date.
        </p>
      </main>
    </div>
  );
}

function PrivacySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="inline-block px-4 py-2 rounded-lg bg-[var(--amber-dim)] mb-4">
        <h3 className="font-display text-xl font-bold text-[var(--text)]">
          {title}
        </h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function PrivacySubsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="font-display text-base font-semibold text-[var(--text)] mb-1">
        {title}
      </h4>
      <div className="font-sans text-sm text-[var(--text)] leading-relaxed">
        {children}
      </div>
    </div>
  );
}
