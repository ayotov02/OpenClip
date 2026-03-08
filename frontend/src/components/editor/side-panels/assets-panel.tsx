"use client";

import { Search, Music, Film, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MOCK_BROLL = [
  { id: "br1", name: "City skyline timelapse", duration: "10s", type: "video" },
  { id: "br2", name: "Laptop typing closeup", duration: "8s", type: "video" },
  { id: "br3", name: "Team meeting aerial", duration: "12s", type: "video" },
  { id: "br4", name: "Abstract particles", duration: "15s", type: "video" },
];

const MOCK_MUSIC = [
  { id: "m1", name: "Upbeat Corporate", duration: "2:30", mood: "energetic" },
  { id: "m2", name: "Lo-Fi Focus", duration: "3:15", mood: "calm" },
  { id: "m3", name: "Cinematic Epic", duration: "1:45", mood: "dramatic" },
];

export function AssetsPanel() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Assets</h3>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search assets..." className="h-8 pl-8 text-xs" />
      </div>

      <Tabs defaultValue="broll">
        <TabsList className="w-full">
          <TabsTrigger value="broll" className="flex-1 gap-1 text-xs">
            <Film className="h-3 w-3" /> B-Roll
          </TabsTrigger>
          <TabsTrigger value="music" className="flex-1 gap-1 text-xs">
            <Music className="h-3 w-3" /> Music
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broll" className="mt-2 space-y-2">
          {MOCK_BROLL.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border/50 p-2 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="h-10 w-14 rounded bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <Film className="h-4 w-4 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">{item.duration}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]">Add</Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="music" className="mt-2 space-y-2">
          {MOCK_MUSIC.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border/50 p-2 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center">
                  <Music className="h-4 w-4 text-emerald-600/40" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{item.name}</p>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px]">{item.mood}</Badge>
                    <span className="text-[10px] text-muted-foreground">{item.duration}</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]">Add</Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
