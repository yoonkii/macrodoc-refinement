import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Firebase signInWithPopup needs the opener relationship; explicit same-origin-allow-popups prevents a future stricter COOP from breaking sign-in (the SDK's window.closed polling warnings from Google's own pages remain benign).
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // apis.google.com hosts the gapi loader that Firebase Auth's
              // signInWithPopup pulls in; *.ingest.sentry.io only used when a DSN is set.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline'",
              // Firebase Auth talks to identitytoolkit/securetoken; the popup handler
              // lives on the firebaseapp.com authDomain. Sentry ingest for error reports.
              "connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com https://api.anthropic.com https://api.x.ai https://*.run.app https://va.vercel-scripts.com https://vitals.vercel-insights.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseapp.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
              // The Google sign-in popup/iframe is served from these origins.
              "frame-src 'self' https://apis.google.com https://accounts.google.com https://macro-doc-refinement-8d9fa.firebaseapp.com",
              // Google account avatars (photoURL) come from googleusercontent.com.
              "img-src 'self' data: https://*.googleusercontent.com https://lh3.googleusercontent.com",
              "font-src 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
