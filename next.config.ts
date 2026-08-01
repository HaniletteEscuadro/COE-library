import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Content Security Policy.
 *
 * The point of this header is to limit the damage of an XSS bug rather than to
 * pretend there will never be one. The portal writes to `.innerHTML` in about a
 * hundred places, so "some string reaches the DOM as markup" is a realistic
 * failure — and this origin holds everyone's session cookie.
 *
 * Two directives do most of the work and cost nothing:
 *
 *   * `object-src 'none'` — kills `<object>`/`<embed>`, a plugin-era script
 *     vector nothing here uses;
 *   * `base-uri 'self'` — stops an injected `<base href>` from re-pointing every
 *     relative script URL in the page at an attacker's host.
 *
 * `'unsafe-inline'` is present under protest. The portal markup carries inline
 * `on*` handlers and a few `style=` attributes, and Next injects its own inline
 * hydration scripts; removing it needs a nonce pipeline through both, which is a
 * separate piece of work. It is called out here so nobody reads this policy as
 * stronger than it is.
 *
 * The external hosts are the ones the portal actually references — Google Fonts,
 * Google sign-in, and YouTube embeds. Anything else is refused.
 */
function contentSecurityPolicy(frameAncestors: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,

    // See the note above about 'unsafe-inline'.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",

    // `blob:` is required by the PDF viewer and by video previews, which build
    // object URLs from the bytes they fetch. `https:` covers profile pictures,
    // which are arbitrary user-supplied URLs.
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",

    // Same-origin XHR plus the Socket.IO connection. `ws:`/`wss:` are needed
    // explicitly — 'self' does not extend to the WebSocket scheme everywhere.
    "connect-src 'self' ws: wss: https://www.googleapis.com",

    // pdf.js runs its parser in a worker created from a blob URL.
    "worker-src 'self' blob:",

    // Lecture embeds, and the PDF preview iframe.
    "frame-src 'self' blob: https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://accounts.google.com",

    // Only in production: on a plain http://localhost this would rewrite local
    // asset requests to https and break the dev server.
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  turbopack: {
    /*
     * Silence "Encountered unexpected file in NFT list".
     *
     * The trigger is `src/lib/storage.ts`, which resolves the uploads directory
     * from `STORAGE_DIR ?? process.cwd() + "/storage"`. The tracer cannot know
     * that value statically, so it assumes the whole project might be read and
     * warns that its file-trace list is too broad.
     *
     * It is a false positive for this app twice over: the path is configuration,
     * not a dynamic require, and the file-trace list is only consumed by
     * `output: "standalone"`, which is not used here — deployment runs
     * `tsx server.ts` against the real project directory.
     *
     * There is no code shape that avoids it while keeping the directory
     * configurable, and it must stay configurable: on Railway and Render the
     * uploads have to live on a mounted volume, not inside the container.
     *
     * Scoped by title so a genuinely different warning from the same file is
     * still reported.
     */
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: "Encountered unexpected file in NFT list",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy("'none'") },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          /*
           * HSTS — production only.
           *
           * The session cookie is the whole security model, and without this a
           * single http:// link is enough to strip TLS and hand it over on a
           * shared campus network. Railway and Render both terminate TLS and
           * redirect, so the header is safe to send from the first deploy.
           *
           * Withheld in development because a browser that pins localhost to
           * https refuses to load the dev server afterwards, and the pin
           * outlives the project.
           */
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
      {
        /*
         * The library preview, and only it.
         *
         * The blanket `DENY` above applies to every route including this one,
         * and DENY has no same-origin exception — so the portal's own
         * `<iframe src="/api/library/preview/...">` was blocked by the browser
         * and every uploaded PDF opened to an empty pane.
         *
         * SAMEORIGIN still refuses framing by any other site, which is the
         * clickjacking case the header exists for. The CSP is the same policy
         * as above with `frame-ancestors` relaxed to match — rebuilt in full
         * rather than sent as a bare `frame-ancestors` directive, because a
         * second Content-Security-Policy value for the same path would replace
         * the first and silently drop every other protection on this route.
         */
        source: "/api/library/preview/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy("'self'") },
        ],
      },
    ];
  },
};

export default nextConfig;
