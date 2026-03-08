import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { PremiumHero } from "@/components/premium/hero";
import { PremiumProviders } from "@/components/premium/providers";
import { PremiumArchitecture } from "@/components/premium/architecture";
import { PremiumPricing } from "@/components/premium/pricing";

export const metadata = {
  title: "OpenClip Premium — API-Powered, No GPU Needed",
  description:
    "Run OpenClip on a $5/month VPS. Best-in-class AI via OpenRouter, Kie.ai, and Bright Data. No GPU required.",
};

export default function PremiumPage() {
  return (
    <>
      <Navbar />
      <main>
        <PremiumHero />
        <PremiumProviders />
        <PremiumArchitecture />
        <PremiumPricing />
      </main>
      <Footer />
    </>
  );
}
