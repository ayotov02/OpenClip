export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export interface EditorTrackItem {
  id: string;
  type: "video" | "audio" | "caption" | "overlay";
  startTime: number;
  endTime: number;
  label: string;
  src?: string;
  text?: string;
}

export interface EditorTrack {
  id: string;
  type: "video" | "audio" | "caption" | "overlay";
  label: string;
  items: EditorTrackItem[];
}

export interface CaptionSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

export interface EditorState {
  projectId: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  aspectRatio: AspectRatio;
  tracks: EditorTrack[];
  captions: CaptionSegment[];
  activePanel: EditorPanel;
  selectedItemId: string | null;
}

export type EditorPanel = "assets" | "captions" | "brand-kit" | "ai-tools" | "export";

export interface ExportConfig {
  format: "mp4" | "webm" | "gif";
  quality: "draft" | "hd" | "4k";
  platform: string;
  includeSubtitles: boolean;
}
