import "./landing.css";
import type { Metadata, Viewport } from "next";
import { Features } from "@/components/landing/Features";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Hero } from "@/components/landing/Hero";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { LogoStrip } from "@/components/landing/LogoStrip";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { SeoSection } from "@/components/landing/SeoSection";

export const metadata: Metadata = {
  metadataBase: new URL("https://marktasks.com"),
  title: "MarkTasks – Simple Task Management Software for Teams",
  description:
    "Manage projects, organize tasks, and track progress with visual boards, lists, and cards. MarkTasks helps teams plan work, collaborate, and stay on track.",
  keywords: [
    "task management software",
    "project management tool",
    "task boards",
    "project boards",
    "team task management",
    "visual task tracking",
    "online task manager",
    "board management software",
  ],
  robots: { index: true, follow: true },
  authors: [{ name: "MarkTasks" }],
  alternates: { canonical: "https://marktasks.com/" },
  verification: {
    google: "aH1pZLfkJnV1Iovv9Tg8U4WBgOjJhg5CU3JQopBG9ro",
  },
  openGraph: {
    type: "website",
    url: "https://marktasks.com/",
    title: "MarkTasks – Simple Task Management Software for Teams",
    description:
      "Create project boards, organize tasks, assign work, and track progress in one clean workspace built for productive teams.",
    siteName: "MarkTasks",
    images: [
      {
        url: "https://marktasks.com/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "MarkTasks task management boards for teams",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarkTasks – Simple Task Management Software for Teams",
    description:
      "Plan projects, organize tasks, and track team progress with simple visual boards, lists, and cards.",
    images: ["https://marktasks.com/og-image.jpg"],
  },
  other: {
    title: "MarkTasks – Simple Task Management Software for Teams",
    language: "English",
    "twitter:url": "https://marktasks.com/",
  },
};

export const viewport: Viewport = {
  themeColor: "#061B3A",
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MarkTasks",
  url: "https://marktasks.com/",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "MarkTasks is a simple task management software for teams to plan projects, organize tasks, and track progress with visual boards, lists, and cards.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "MarkTasks",
  url: "https://marktasks.com/",
  description:
    "Simple task management software for teams, project boards, task lists, and visual progress tracking.",
};

export default function LandingPage() {
  return (
    <div className="landing-root">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <LandingNav />
      <main>
        <Hero />
        <div className="page" id="product">
          <div className="preview-wrap">
            <ProductPreview />
          </div>
        </div>
        <LogoStrip />
        <Features />
        <SeoSection />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
