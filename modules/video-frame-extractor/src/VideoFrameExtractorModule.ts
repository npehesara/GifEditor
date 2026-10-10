import { NativeModule, requireNativeModule } from 'expo';

export type ExtractedFrame = {
  timestampMs: number;
  uri: string;
};


export type ExtractionTarget = {
  width: number;
  height: number;
};

declare class VideoFrameExtractorModule extends NativeModule {
  extractFrames(videoUri: string, startTimeMs: number, endTimeMs: number, intervalMs: number): Promise<ExtractedFrame[]>;
  beginExtraction(videoUri: string, maxWidth: number, maxHeight: number): Promise<ExtractionTarget>;
  getFrame(timestampMs: number, options?: any): Promise<Uint8Array | null>;
  endExtraction(): Promise<void>;
  decodeImage(imageUri: string, maxWidth: number, maxHeight: number): Promise<{
    width: number;
    height: number;
    rgba: Uint8Array;
  }>;
}

export default requireNativeModule<VideoFrameExtractorModule>('VideoFrameExtractor');
