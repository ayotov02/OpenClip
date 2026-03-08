"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SplitText } from "@/components/effects/split-text";
import { ScrollReveal } from "@/components/effects/scroll-reveal";
import { FAQ_ITEMS } from "@/lib/constants";

export function FAQ() {
  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <SplitText
            text="Frequently Asked Questions"
            as="h2"
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-[var(--font-inter-tight)]"
          />
        </div>

        <ScrollReveal>
          <Accordion className="space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem
                key={index}
                className="glass rounded-xl px-6 border-none"
              >
                <AccordionTrigger className="text-left text-sm sm:text-base font-medium text-zinc-200 hover:text-white py-5 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-400 leading-relaxed pb-5">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </section>
  );
}
