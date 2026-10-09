import { decodeGifFromUri, compositeGifFrames } from '../gif/decoder';
import VideoFrameExtractorModule from '../../../modules/video-frame-extractor/src/VideoFrameExtractorModule';

export type PreparedFrame = {
  rgba: Uint8Array;
  width: number;
  height: number;
  durationMs: number;
};

export type PreparedItem = {
  id: string;
  isGif: boolean;
  frames: PreparedFrame[];
  width: number;
  height: number;
  totalDurationMs: number;
};

/**
 * Prepares a GIF by decoding it and compositing its frames into full RGBA frames.
 */
export async function prepareGifFrame(id: string, uri: string): Promise<PreparedItem> {
  const decodedGif = await decodeGifFromUri(uri);
  const composited = compositeGifFrames(decodedGif);
  
  // compositeGifFrames outputs padded even width/height
  const outWidth = decodedGif.width % 2 !== 0 ? decodedGif.width + 1 : decodedGif.width;
  const outHeight = decodedGif.height % 2 !== 0 ? decodedGif.height + 1 : decodedGif.height;
  
  let totalDurationMs = 0;
  
  const preparedFrames: PreparedFrame[] = composited.map(comp => {
    totalDurationMs += comp.delayMs;
    return {
      rgba: comp.data,
      width: outWidth,
      height: outHeight,
      durationMs: comp.delayMs
    };
  });
  
  return {
    id,
    isGif: true,
    frames: preparedFrames,
    width: outWidth,
    height: outHeight,
    totalDurationMs
  };
}

/**
 * Prepares a static image by decoding it into a single RGBA frame.
 * We use the native VideoFrameExtractorModule's newly added decodeImage function
 * to reuse the native ARGB_8888 -> RGBA logic securely without extra dependencies.
 */
export async function prepareStaticImageFrame(id: string, uri: string, maxWidth: number = 480, maxHeight: number = 480): Promise<PreparedItem> {
  const decoded = await VideoFrameExtractorModule.decodeImage(uri, maxWidth, maxHeight);
  
  const preparedFrames: PreparedFrame[] = [{
    rgba: decoded.rgba,
    width: decoded.width,
    height: decoded.height,
    durationMs: 100, // Conceptually it's a single static frame, 100ms is a safe default
  }];
  
  return {
    id,
    isGif: false,
    frames: preparedFrames,
    width: decoded.width,
    height: decoded.height,
    totalDurationMs: 100
  };
}
