import Link from "next/link";
import { GITHUB_URL } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-black/5 py-8 px-6">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
        <Link href="/" className="font-bold tracking-tight">
          OpenClip.
        </Link>

        <div className="flex items-center gap-6 text-[#999999]">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-black transition-colors"
          >
            GitHub
          </a>
          <a href="#features" className="hover:text-black transition-colors">
            Features
          </a>
          <Link href="/premium" className="hover:text-black transition-colors">
            Premium
          </Link>
          <a href="#stack" className="hover:text-black transition-colors">
            Stack
          </a>
        </div>

        <p className="text-[#999999]">Free and open-source forever.</p>
      </div>
    </footer>
  );
}
