import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AppShell } from "@/components/app-shell";
import { DisclaimerModal } from "@/components/disclaimer-modal";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <a
          href="/"
          className="inline-flex mt-6 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MedAI — Dual-AI Medical Analysis" },
      {
        name: "description",
        content:
          "MedAI is a dual-AI clinical analysis prototype that interprets symptoms and lab reports for educational use only.",
      },
      { name: "author", content: "MedAI" },
      { property: "og:title", content: "MedAI — Dual-AI Medical Analysis" },
      {
        property: "og:description",
        content: "Educational dual-AI medical analysis dashboard powered by Lovable AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "MedAI — Dual-AI Medical Analysis" },
      { name: "description", content: "MedAI analyzes medical data to provide possible conditions and risk assessments." },
      { property: "og:description", content: "MedAI analyzes medical data to provide possible conditions and risk assessments." },
      { name: "twitter:description", content: "MedAI analyzes medical data to provide possible conditions and risk assessments." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/18127c1b-eff8-42b7-8181-9d1634ebfcdc/id-preview-1f01abd8--a39427e0-18f9-429e-af29-8695ad196052.lovable.app-1777397994740.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/18127c1b-eff8-42b7-8181-9d1634ebfcdc/id-preview-1f01abd8--a39427e0-18f9-429e-af29-8695ad196052.lovable.app-1777397994740.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }, { rel: "preconnect", href: "https://fonts.googleapis.com" }, { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }, { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AppShell>
      <DisclaimerModal />
      <Outlet />
    </AppShell>
  );
}
