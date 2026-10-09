import { File } from 'expo-file-system';
import { parseGIF, decompressFrames, ParsedFrame } from 'gifuct-js';

export interface DecodedGifInfo {
  uri: string;
  filename: string;
  width: number;
  height: number;
  frameCount: number;
  durationMs: number;
  durationSeconds: number;
  fileSizeBytes: number;
  frames: ParsedFrame[];
}

export async function decodeGifFromUri(uri: string, filename?: string): Promise<DecodedGifInfo> {
  try {
    const file = new File(uri);
    let bytes: Uint8Array;
    let size = 0;

    if (file.exists) {
      bytes = await file.bytes();
      size = file.size ?? bytes.length;
    } else {
      // Fallback for content/remote URIs
      const response = await fetch(uri);
      const buffer = await response.arrayBuffer();
      bytes = new Uint8Array(buffer);
      size = bytes.length;
    }

    const name = filename || uri.split('/').pop() || 'animated.gif';
    const parsedGif = parseGIF(bytes.buffer as ArrayBuffer);
    const frames = decompressFrames(parsedGif, true);

    const width = parsedGif.lsd.width || (frames.length > 0 ? frames[0].dims.width : 300);
    const height = parsedGif.lsd.height || (frames.length > 0 ? frames[0].dims.height : 300);

    let totalDurationMs = 0;
    for (const frame of frames) {
      // Default delay if 0 is usually 100ms
      const delay = frame.delay && frame.delay > 0 ? frame.delay : 100;
      totalDurationMs += delay;
    }

    if (totalDurationMs === 0 && frames.length > 0) {
      totalDurationMs = frames.length * 100;
    }

    return {
      uri,
      filename: name,
      width,
      height,
      frameCount: frames.length,
      durationMs: totalDurationMs,
      durationSeconds: totalDurationMs / 1000,
      fileSizeBytes: size,
      frames
    };
  } catch (error) {
    console.warn('Error decoding GIF:', error);
    // Return basic fallback if deep decoding encounters unusual binary header
    const fallbackName = filename || uri.split('/').pop() || 'selected.gif';
    return {
      uri,
      filename: fallbackName,
      width: 400,
      height: 400,
      frameCount: 1,
      durationMs: 1000,
      durationSeconds: 1.0,
      fileSizeBytes: 0,
      frames: []
    };
  }
}

export interface CompositedFrame {
  data: Uint8Array;
  delayMs: number;
}

export function compositeGifFrames(info: DecodedGifInfo): CompositedFrame[] {
  const { width, height, frames } = info;
  
  // Ensure even dimensions for H.264 encoding
  const outWidth = width % 2 !== 0 ? width + 1 : width;
  const outHeight = height % 2 !== 0 ? height + 1 : height;
  
  const numPixels = outWidth * outHeight;
  const canvasSize = numPixels * 4;
  
  const compositedFrames: CompositedFrame[] = [];
  
  // The current state of the canvas
  const canvas = new Uint8Array(canvasSize);
  
  // A buffer to store the canvas state before the current frame is drawn
  const previousCanvas = new Uint8Array(canvasSize);
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const { patch, dims, disposalType, delay } = frame;
    
    // Default delay to 100ms if not specified or 0
    const delayMs = delay && delay > 0 ? delay : 100;
    
    // Save current canvas state before drawing if disposalType === 3
    if (disposalType === 3) {
      previousCanvas.set(canvas);
    }
    
    // Draw the patch onto the canvas
    const patchWidth = dims.width;
    const patchHeight = dims.height;
    const top = dims.top;
    const left = dims.left;
    
    for (let py = 0; py < patchHeight; py++) {
      for (let px = 0; px < patchWidth; px++) {
        const patchIdx = (py * patchWidth + px) * 4;
        const cx = left + px;
        const cy = top + py;
        
        // Skip out of bounds (using original width/height so we don't stretch into padding)
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
        
        // Calculate index based on padded outWidth
        const canvasIdx = (cy * outWidth + cx) * 4;
        
        const a = patch[patchIdx + 3];
        if (a > 0) {
          canvas[canvasIdx] = patch[patchIdx];
          canvas[canvasIdx + 1] = patch[patchIdx + 1];
          canvas[canvasIdx + 2] = patch[patchIdx + 2];
          canvas[canvasIdx + 3] = a;
        }
      }
    }
    
    // Save the composited frame as a copy
    compositedFrames.push({
      data: new Uint8Array(canvas),
      delayMs,
    });
    
    // Handle disposal for the NEXT frame
    if (disposalType === 2) {
      // Restore to background (clear the patch area to transparent)
      for (let py = 0; py < patchHeight; py++) {
        for (let px = 0; px < patchWidth; px++) {
          const cx = left + px;
          const cy = top + py;
          if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
          const canvasIdx = (cy * outWidth + cx) * 4;
          canvas[canvasIdx] = 0;
          canvas[canvasIdx + 1] = 0;
          canvas[canvasIdx + 2] = 0;
          canvas[canvasIdx + 3] = 0;
        }
      }
    } else if (disposalType === 3) {
      // Restore to previous
      canvas.set(previousCanvas);
    }
    // disposalType === 0 or 1: Do not dispose.
  }
  
  return compositedFrames;
}
