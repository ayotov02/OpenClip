import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { Solution } from "@/components/landing/solution";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Comparison } from "@/components/landing/comparison";
import { TechMarquee } from "@/components/landing/tech-marquee";
import { Deployment } from "@/components/landing/deployment";
import { Stats } from "@/components/landing/stats";
import { FAQ } from "@/components/landing/faq";
import { CTAFooter } from "@/components/landing/cta-footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <Features />
        <HowItWorks />
        <Comparison />
        <TechMarquee />
        <Deployment />
        <Stats />
        <FAQ />
        <CTAFooter />
      </main>
    </>
  );
}
