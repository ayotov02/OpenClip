"use client";

import { useState } from "react";
import {
  Plus,
  Palette,
  Type,
  Music,
  Film,
  Check,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { mockBrandKits } from "@/lib/mock-data";
import { getRelativeTime } from "@/lib/helpers";

export default function BrandsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brand Kits</h1>
          <p className="text-sm text-muted-foreground">
            Manage brand templates that auto-apply to generated clips
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Brand Kit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Brand Kit</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Brand Name</label>
                <Input placeholder="e.g. Main Channel" />
              </div>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium">Colors</label>
                <div className="grid grid-cols-4 gap-3">
                  {["Primary", "Secondary", "Accent", "Caption"].map((label) => (
                    <div key={label} className="space-y-1">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-8 w-8 rounded-md border border-border bg-primary/20" />
                        <Input placeholder="#7c3aed" className="text-xs h-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium">Logo</label>
                <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
                  <Upload className="mx-auto h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-2 text-xs text-muted-foreground">Upload logo (PNG, SVG)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Heading Font</label>
                  <Input placeholder="Outfit" className="text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Body Font</label>
                  <Input placeholder="Inter" className="text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => setDialogOpen(false)}>Create Brand Kit</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Brand Kit Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockBrandKits.map((brand) => (
          <Card key={brand.id} className="transition-shadow hover:shadow-md hover:shadow-primary/5 cursor-pointer">
            <CardContent className="p-5 space-y-4">
              {/* Color Strip */}
              <div className="flex h-3 rounded-full overflow-hidden">
                <div className="flex-1" style={{ backgroundColor: brand.primaryColor }} />
                <div className="flex-1" style={{ backgroundColor: brand.secondaryColor }} />
                <div className="flex-1" style={{ backgroundColor: brand.accentColor }} />
                <div className="flex-1" style={{ backgroundColor: brand.captionHighlight }} />
              </div>

              <div>
                <h3 className="text-base font-semibold text-foreground">{brand.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {getRelativeTime(brand.createdAt)}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Type className="h-3.5 w-3.5" />
                  <span>{brand.fontHeading} / {brand.fontBody}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Palette className="h-3.5 w-3.5" />
                  <div className="flex gap-1">
                    {[brand.primaryColor, brand.secondaryColor, brand.accentColor].map((c) => (
                      <div key={c} className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature badges */}
              <div className="flex flex-wrap gap-1.5">
                {brand.hasIntro && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Film className="h-3 w-3" />
                    Intro
                  </Badge>
                )}
                {brand.hasOutro && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Film className="h-3 w-3" />
                    Outro
                  </Badge>
                )}
                {brand.hasAudioBranding && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Music className="h-3 w-3" />
                    Audio
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
