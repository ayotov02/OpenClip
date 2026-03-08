"use client";

import { useState, useCallback } from "react";
import type {
  EditorState,
  AspectRatio,
  EditorPanel,
  EditorTrack,
  CaptionSegment,
} from "@/lib/editor-types";

const MOCK_TRACKS: EditorTrack[] = [
  {
    id: "t1", type: "video", label: "Video",
    items: [
      { id: "v1", type: "video", startTime: 0, endTime: 30, label: "Main Clip" },
      { id: "v2", type: "video", startTime: 30, endTime: 55, label: "B-Roll 1" },
    ],
  },
  {
    id: "t2", type: "audio", label: "Audio",
    items: [
      { id: "a1", type: "audio", startTime: 0, endTime: 55, label: "Background Music" },
    ],
  },
  {
    id: "t3", type: "caption", label: "Captions",
    items: [
      { id: "c1", type: "caption", startTime: 0, endTime: 5, label: "Welcome back...", text: "Welcome back to the channel" },
      { id: "c2", type: "caption", startTime: 5, endTime: 12, label: "Today we're...", text: "Today we're going to talk about" },
      { id: "c3", type: "caption", startTime: 12, endTime: 20, label: "The most important...", text: "The most important thing is" },
    ],
  },
  {
    id: "t4", type: "overlay", label: "Overlays",
    items: [
      { id: "o1", type: "overlay", startTime: 0, endTime: 5, label: "Logo Watermark" },
    ],
  },
];

const MOCK_CAPTIONS: CaptionSegment[] = [
  { id: "cs1", startTime: 0, endTime: 5, text: "Welcome back to the channel", speaker: "Host" },
  { id: "cs2", startTime: 5, endTime: 12, text: "Today we're going to talk about building viral content", speaker: "Host" },
  { id: "cs3", startTime: 12, endTime: 20, text: "The most important thing is understanding your audience", speaker: "Host" },
  { id: "cs4", startTime: 20, endTime: 30, text: "Let me show you exactly what I mean with some real examples", speaker: "Host" },
  { id: "cs5", startTime: 30, endTime: 40, text: "Here's the first example from a top creator in this space", speaker: "Host" },
  { id: "cs6", startTime: 40, endTime: 55, text: "And that's the framework. Drop a like if this was helpful.", speaker: "Host" },
];

const initialState: EditorState = {
  projectId: "",
  currentTime: 0,
  duration: 55,
  isPlaying: false,
  aspectRatio: "9:16",
  tracks: MOCK_TRACKS,
  captions: MOCK_CAPTIONS,
  activePanel: "captions",
  selectedItemId: null,
};

export function useEditorState(projectId: string) {
  const [state, setState] = useState<EditorState>({
    ...initialState,
    projectId,
  });

  const setCurrentTime = useCallback((time: number) => {
    setState((s) => ({ ...s, currentTime: Math.max(0, Math.min(time, s.duration)) }));
  }, []);

  const togglePlay = useCallback(() => {
    setState((s) => ({ ...s, isPlaying: !s.isPlaying }));
  }, []);

  const setAspectRatio = useCallback((ratio: AspectRatio) => {
    setState((s) => ({ ...s, aspectRatio: ratio }));
  }, []);

  const setActivePanel = useCallback((panel: EditorPanel) => {
    setState((s) => ({ ...s, activePanel: panel }));
  }, []);

  const setSelectedItem = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedItemId: id }));
  }, []);

  const updateCaption = useCallback((id: string, text: string) => {
    setState((s) => ({
      ...s,
      captions: s.captions.map((c) => (c.id === id ? { ...c, text } : c)),
    }));
  }, []);

  return {
    state,
    setCurrentTime,
    togglePlay,
    setAspectRatio,
    setActivePanel,
    setSelectedItem,
    updateCaption,
  };
}
