export interface GifFrame {
  id: string;
  index: number;
  uri: string; // file path or data URI for rendering
  delay: number; // in milliseconds (e.g. 100ms = 10fps)
  width: number;
  height: number;
  thumbnailUri?: string;
  // Raw RGBA patch data if available for software processing
  rgbaData?: Uint8ClampedArray;
}

export interface TextLayer {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  x: number; // 0-100%
  y: number; // 0-100%
  scale: number;
  rotation: number;
  opacity: number;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  color: string;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundPadding: number;
  textAlign: 'left' | 'center' | 'right';
  zIndex: number;
}

export interface StickerLayer {
  id: string;
  content: string; // emoji character or SVG/PNG asset id
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  scale: number;
  rotation: number;
  opacity: number;
  startFrame: number;
  endFrame: number;
}

export type FilterPresetId =
  | 'original' | 'bright' | 'contrast' | 'saturated' | 'vibrant'
  | 'cinematic' | 'dramatic' | 'movie' | 'teal_orange' | 'cool'
  | 'vintage' | 'retro' | 'fade' | 'sepia' | 'warm'
  | 'noir' | 'black_white' | 'dream' | 'vivid' | 'pop';

export interface FilterConfig {
  preset: FilterPresetId;
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  fade: number;
  vignette: number;
  sharpen: number;
  hue: number;
}

export interface TransformConfig {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
}

export interface CropConfig {
  enabled: boolean;
  x: number; // 0-100%
  y: number; // 0-100%
  width: number; // 0-100%
  height: number; // 0-100%
  aspectRatio: 'original' | '1:1' | '16:9' | '9:16' | '4:3' | 'free';
}

export interface ExportSettings {
  resolution: 'original' | '1080p' | '720p' | '480p' | '360p';
  customWidth?: number;
  customHeight?: number;
  fps: number;
  quality: 'low' | 'medium' | 'high';
  loop: 'forever' | 'once' | '3times';
}

export interface EditorState {
  frames: GifFrame[];
  originalWidth: number;
  originalHeight: number;
  currentFrameIndex: number;
  selectedFrameIds: string[];
  playbackSpeed: number; // multiplier e.g. 1.0, 1.5, 2.0
  isLooping: boolean;
  isPlaying: boolean;
  textLayers: TextLayer[];
  stickerLayers: StickerLayer[];
  filters: FilterConfig;
  transform: TransformConfig;
  crop: CropConfig;
  exportSettings: ExportSettings;
}
