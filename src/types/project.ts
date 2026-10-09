import { GifFrame, TextLayer, StickerLayer, FilterConfig, TransformConfig, CropConfig, ExportSettings } from './editor';

export interface ProjectMetadata {
  id: string;
  name: string;
  thumbnailUri: string;
  createdAt: number;
  updatedAt: number;
  durationSeconds: number;
  frameCount: number;
  width: number;
  height: number;
}

export interface GifProject {
  metadata: ProjectMetadata;
  frames: GifFrame[];
  textLayers: TextLayer[];
  stickerLayers: StickerLayer[];
  filters: FilterConfig;
  transform: TransformConfig;
  crop: CropConfig;
  exportSettings: ExportSettings;
  playbackSpeed: number;
}
