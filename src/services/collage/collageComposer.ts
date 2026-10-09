import { PreparedItem as BasePreparedItem, PreparedFrame } from './framePrep';
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import * as FileSystem from 'expo-file-system';

export type PreparedItem = BasePreparedItem & {
  transform?: {
    scale: number;
    translateX: number;
    translateY: number;
  }
};

export interface ComposerOptions {
  items: PreparedItem[];
  onProgress?: (progress: number) => void;
  targetSize?: number; // default 480
}

interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function composeCollage(options: ComposerOptions): Promise<{ uri: string, filename: string, sizeBytes: number }> {
  const { items, onProgress, targetSize = 480 } = options;
  if (items.length === 0 || items.length > 4) {
    throw new Error('Collage requires 1 to 4 items.');
  }

  // 1. Determine Output Duration
  const gifItems = items.filter(i => i.isGif);
  const maxGifDurationMs = gifItems.length > 0 
    ? Math.max(...gifItems.map(i => i.totalDurationMs))
    : 100; // Single frame for static images

  // Timeline interval (e.g. 100ms for 10fps)
  const intervalMs = 100;
  const totalFrames = Math.max(1, Math.ceil(maxGifDurationMs / intervalMs));

  // 2. Define layout cells
  const layout = getLayout(items.length, targetSize);

  // 3. Initialize GIFEncoder
  const gif = GIFEncoder();

  // 4. Create and process each output frame sequentially for memory safety
  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    const timeMs = frameIdx * intervalMs;
    const canvas = new Uint8Array(targetSize * targetSize * 4); // RGBA

    // Draw each item into its cell
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const cell = layout[i];
      const sourceFrame = getFrameForTime(item, timeMs);
      
      drawFrameToCell(sourceFrame, cell, canvas, targetSize, item.transform);
    }

    // Quantize and write frame
    const palette = quantize(canvas, 256, { format: 'rgba4444' });
    const index = applyPalette(canvas, palette, 'rgba4444');
    
    gif.writeFrame(index, targetSize, targetSize, {
      palette,
      delay: intervalMs,
      // We don't have transparency in the final collage output (black background)
      // but if we did we could set transparent index.
    });

    if (onProgress) {
      onProgress(Math.round(((frameIdx + 1) / totalFrames) * 100));
    }
    
    // Tiny delay to avoid blocking JS thread completely
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  gif.finish();
  const outputBuffer = gif.bytes();

  // 5. Save to FileSystem
  const filename = `gif_collage_${Date.now()}.gif`;
  const fileInfo = new FileSystem.File(FileSystem.Paths.cache, filename);
  await fileInfo.write(outputBuffer);

  return {
    uri: fileInfo.uri,
    filename,
    sizeBytes: outputBuffer.length
  };
}

/**
 * Returns the appropriate source frame for a given timestamp.
 * If the time exceeds the item's duration, it loops back around.
 */
function getFrameForTime(item: PreparedItem, timeMs: number): PreparedFrame {
  if (item.frames.length === 0) throw new Error('Empty item frames');
  if (item.frames.length === 1) return item.frames[0];

  const loopedTimeMs = timeMs % item.totalDurationMs;
  let accumulated = 0;
  
  for (let i = 0; i < item.frames.length; i++) {
    const f = item.frames[i];
    accumulated += f.durationMs;
    if (loopedTimeMs < accumulated) {
      return f;
    }
  }
  return item.frames[item.frames.length - 1];
}

function getLayout(count: number, size: number): CellRect[] {
  const half = size / 2;
  switch (count) {
    case 1:
      return [{ x: 0, y: 0, w: size, h: size }];
    case 2:
      return [
        { x: 0, y: 0, w: half, h: size },
        { x: half, y: 0, w: half, h: size }
      ];
    case 3:
      return [
        { x: 0, y: 0, w: size, h: half },
        { x: 0, y: half, w: half, h: half },
        { x: half, y: half, w: half, h: half }
      ];
    case 4:
      return [
        { x: 0, y: 0, w: half, h: half },
        { x: half, y: 0, w: half, h: half },
        { x: 0, y: half, w: half, h: half },
        { x: half, y: half, w: half, h: half }
      ];
    default:
      throw new Error('Unsupported layout');
  }
}

/**
 * Draws the source frame into the cell with 'contain' scaling, then applies user transform.
 */
function drawFrameToCell(frame: PreparedFrame, cell: CellRect, canvas: Uint8Array, canvasSize: number, transform?: { scale: number, translateX: number, translateY: number }) {
  const srcW = frame.width;
  const srcH = frame.height;
  
  // Base contain scaling
  const baseScale = Math.min(cell.w / srcW, cell.h / srcH);
  
  const scaledW = srcW * baseScale;
  const scaledH = srcH * baseScale;
  
  // Base centered offset
  const baseOffsetX = (cell.w - scaledW) / 2;
  const baseOffsetY = (cell.h - scaledH) / 2;
  
  // User transform
  const userScale = transform ? transform.scale : 1;
  const userTx = transform ? transform.translateX : 0;
  const userTy = transform ? transform.translateY : 0;
  
  // To match the UI exactly:
  // The UI applies transform (translate, scale) on the View which is the exact size of the cell.
  // Wait, if the UI applies translation to the whole Image View relative to the cell center,
  // we apply the transform in the cell's coordinate space.
  
  // Cell center relative to cell top-left
  const cellCX = cell.w / 2;
  const cellCY = cell.h / 2;

  // We loop over the cell pixels
  for (let cy = 0; cy < cell.h; cy++) {
    for (let cx = 0; cx < cell.w; cx++) {
      const px = cell.x + cx;
      const py = cell.y + cy;
      
      if (px < 0 || px >= canvasSize || py < 0 || py >= canvasSize) continue;
      
      const canvasIdx = (py * canvasSize + px) * 4;
      
      // Calculate inverse transform to find where this pixel comes from in the original content (scaledW x scaledH)
      // UI Transform: Point p = (contentP - center) * scale + center + translation
      // So inverse: contentP = (p - translation - center) / scale + center
      
      const contentX = (cx - userTx - cellCX) / userScale + cellCX;
      const contentY = (cy - userTy - cellCY) / userScale + cellCY;
      
      // Now map contentX, contentY back to the source image
      const sx = Math.floor((contentX - baseOffsetX) / baseScale);
      const sy = Math.floor((contentY - baseOffsetY) / baseScale);
      
      if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        const srcIdx = (sy * srcW + sx) * 4;
        
        // Alpha blending with black background
        const srcA = frame.rgba[srcIdx + 3];
        if (srcA === 255) {
          canvas[canvasIdx] = frame.rgba[srcIdx];
          canvas[canvasIdx + 1] = frame.rgba[srcIdx + 1];
          canvas[canvasIdx + 2] = frame.rgba[srcIdx + 2];
          canvas[canvasIdx + 3] = 255;
        } else if (srcA > 0) {
          const alpha = srcA / 255;
          canvas[canvasIdx] = (frame.rgba[srcIdx] * alpha) + (canvas[canvasIdx] * (1 - alpha));
          canvas[canvasIdx + 1] = (frame.rgba[srcIdx + 1] * alpha) + (canvas[canvasIdx + 1] * (1 - alpha));
          canvas[canvasIdx + 2] = (frame.rgba[srcIdx + 2] * alpha) + (canvas[canvasIdx + 2] * (1 - alpha));
          canvas[canvasIdx + 3] = 255; // Destination is opaque
        }
      }
    }
  }
}
