# Video Editor UI — Implementation Guide

## Overview
- **What:** Build a browser-based video editor with timeline, trim controls, clip reordering, preview playback, and caption editing.
- **Why:** Users need to review and refine AI-generated clips — trim start/end, reorder scenes, edit caption text, and preview before export.
- **Dependencies:** Phase 1 Feature 8 (React Frontend), Phase 2 Feature 5 (Caption Styles)

## Architecture

### Editor Components
```
EditorPage
├── VideoPreview          # HTML5 video player with current clip
├── Timeline              # Horizontal track with draggable clips
│   ├── VideoTrack        # Clip segments on timeline
│   ├── AudioTrack        # Waveform visualization
│   └── CaptionTrack      # Word-level caption blocks
├── ClipInspector         # Selected clip properties
│   ├── TrimControls      # Start/end time adjustment
│   ├── CaptionEditor     # Inline text editing
│   └── StyleControls     # Caption style, brand kit selection
└── Toolbar               # Export, undo/redo, zoom
```

### State Management
```
EditorState
├── clips: Clip[]              # Ordered list of clips
├── selectedClipId: string     # Currently selected
├── playbackPosition: number   # Current playhead (seconds)
├── isPlaying: boolean
├── zoom: number               # Timeline zoom level
├── history: EditorState[]     # Undo stack
└── captionEdits: Map<id, text[]>  # Modified captions
```

## Step-by-Step Implementation

### Step 1: Create Editor Page
Create `src/app/(dashboard)/projects/[id]/edit/page.tsx`:
```typescript
"use client";
import { useState } from "react";
import { VideoPreview } from "@/components/editor/video-preview";
import { Timeline } from "@/components/editor/timeline";
import { ClipInspector } from "@/components/editor/clip-inspector";

export default function EditorPage({ params }: { params: { id: string } }) {
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);

  return (
    <div className="flex flex-col h-screen">
      {/* Top: Video Preview */}
      <div className="flex-1 flex">
        <div className="flex-1 bg-black flex items-center justify-center">
          <VideoPreview
            clip={clips.find(c => c.id === selectedClip)}
            currentTime={playbackTime}
            onTimeUpdate={setPlaybackTime}
          />
        </div>
        {/* Right: Inspector */}
        {selectedClip && (
          <div className="w-80 border-l p-4 overflow-y-auto">
            <ClipInspector
              clip={clips.find(c => c.id === selectedClip)!}
              onUpdate={(updated) => setClips(prev =>
                prev.map(c => c.id === updated.id ? updated : c)
              )}
            />
          </div>
        )}
      </div>
      {/* Bottom: Timeline */}
      <div className="h-48 border-t">
        <Timeline
          clips={clips}
          selectedId={selectedClip}
          onSelect={setSelectedClip}
          onReorder={(reordered) => setClips(reordered)}
          playbackTime={playbackTime}
        />
      </div>
    </div>
  );
}
```

### Step 2: Create Timeline Component
```typescript
// src/components/editor/timeline.tsx
"use client";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";

export function Timeline({ clips, selectedId, onSelect, onReorder, playbackTime }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b">
        <span className="text-xs text-muted-foreground">Timeline</span>
      </div>
      <div className="flex-1 overflow-x-auto p-2">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={clips.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-1 h-full">
              {clips.map(clip => (
                <TimelineClip
                  key={clip.id}
                  clip={clip}
                  isSelected={clip.id === selectedId}
                  onClick={() => onSelect(clip.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
```

### Step 3: Create Trim Controls
```typescript
// src/components/editor/trim-controls.tsx
export function TrimControls({ clip, onUpdate }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Start Time</label>
        <input
          type="range"
          min={clip.originalStart}
          max={clip.end}
          step={0.1}
          value={clip.start}
          onChange={(e) => onUpdate({ ...clip, start: parseFloat(e.target.value) })}
        />
        <span className="text-xs">{formatTime(clip.start)}</span>
      </div>
      <div>
        <label className="text-sm font-medium">End Time</label>
        <input
          type="range"
          min={clip.start}
          max={clip.originalEnd}
          step={0.1}
          value={clip.end}
          onChange={(e) => onUpdate({ ...clip, end: parseFloat(e.target.value) })}
        />
        <span className="text-xs">{formatTime(clip.end)}</span>
      </div>
    </div>
  );
}
```

## Best Practices
- **HTML5 Video for preview:** Use native `<video>` element. FFmpeg.wasm for client-side trimming is optional but powerful.
- **@dnd-kit for drag-and-drop:** Best React DnD library. Accessible, performant, supports sortable lists.
- **Undo/redo:** Keep a history stack of editor states. Essential for non-destructive editing.
- **Server-side export:** Preview in browser, but final export happens server-side via FFmpeg/Remotion.

## Testing
- Load clips into editor → verify they display on timeline
- Drag to reorder → verify order persists
- Trim start/end → verify preview updates
- Edit caption text → verify changes reflected

## Verification Checklist
- [ ] Timeline displays clips in correct order
- [ ] Drag-and-drop reordering works
- [ ] Trim controls adjust start/end time
- [ ] Video preview plays selected clip
- [ ] Caption editing allows inline text changes
- [ ] Undo/redo works
- [ ] Export sends updated clip data to backend
- [ ] Responsive layout works at different screen sizes
