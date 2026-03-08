import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { About } from "@/components/landing/about";
import { Features } from "@/components/landing/features";
import { Capabilities } from "@/components/landing/capabilities";
import { TwoBackends } from "@/components/landing/two-backends";
import { TechMarquee } from "@/components/landing/tech-marquee";
import { GettingStarted } from "@/components/landing/getting-started";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Features />
        <Capabilities />
        <TwoBackends />
        <TechMarquee />
        <GettingStarted />
      </main>
      <Footer />
    </>
  );
}
