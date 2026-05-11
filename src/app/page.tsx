import "./landing.css";
import { Features } from "@/components/landing/Features";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Hero } from "@/components/landing/Hero";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { LogoStrip } from "@/components/landing/LogoStrip";
import { ProductPreview } from "@/components/landing/ProductPreview";

export default function LandingPage() {
  return (
    <div className="landing-root">
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
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
