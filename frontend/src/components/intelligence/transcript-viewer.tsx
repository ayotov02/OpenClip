"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TranscriptViewer({ transcript }: { transcript: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!transcript) {
    return (
      <div className="rounded-lg border border-border/50 p-3">
        <p className="text-xs text-muted-foreground">No transcript available</p>
      </div>
    );
  }

  const isLong = transcript.length > 300;
  const displayText = expanded || !isLong ? transcript : transcript.slice(0, 300) + "...";

  function handleCopy() {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Transcript</span>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px]" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{displayText}</p>
      </div>
      {isLong && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-full gap-1 text-[10px]"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Show less" : "Show full transcript"}
        </Button>
      )}
    </div>
  );
}
