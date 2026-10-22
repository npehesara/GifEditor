import { CropRect } from '../components/editor/CropOverlay';
import { TextLayer } from '../types/editor';

export interface ContentDimensions {
  contentWidth: number;
  contentHeight: number;
  contentAspect: number;
}

export interface PreviewContentRect {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface ExportGeometry {
  targetWidth: number;
  targetHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  exportWidth: number;
  exportHeight: number;
  aspectRatio: number;
}

/**
 * Calculates the visible content dimensions and aspect ratio from source dimensions and optional crop.
 */
export function calculateContentDimensions(
  sourceWidth: number,
  sourceHeight: number,
  crop?: CropRect | null
): ContentDimensions {
  const safeW = Math.max(1, sourceWidth);
  const safeH = Math.max(1, sourceHeight);

  if (crop && (crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0)) {
    const cropW = Math.max(1, safeW * crop.width);
    const cropH = Math.max(1, safeH * crop.height);
    return {
      contentWidth: cropW,
      contentHeight: cropH,
      contentAspect: cropW / cropH,
    };
  }

  return {
    contentWidth: safeW,
    contentHeight: safeH,
    contentAspect: safeW / safeH,
  };
}

/**
 * Computes the preview content rectangle fitted inside a preview container while preserving aspect ratio.
 */
export function calculatePreviewContentRect(
  containerWidth: number,
  containerHeight: number,
  contentAspect: number
): PreviewContentRect {
  if (containerWidth <= 0 || containerHeight <= 0 || contentAspect <= 0) {
    return { width: containerWidth, height: containerHeight, aspectRatio: contentAspect || 1 };
  }

  const containerRatio = containerWidth / containerHeight;
  let renderW: number;
  let renderH: number;

  if (contentAspect > containerRatio) {
    renderW = containerWidth;
    renderH = containerWidth / contentAspect;
  } else {
    renderH = containerHeight;
    renderW = containerHeight * contentAspect;
  }

  return {
    width: Math.round(renderW),
    height: Math.round(renderH),
    aspectRatio: contentAspect,
  };
}

/**
 * Calculates the exact output dimensions and crop pixel offsets for export.
 * Preserves the source or cropped aspect ratio without stretching or unintended implicit crops.
 */
export function calculateExportGeometry(
  sourceWidth: number,
  sourceHeight: number,
  crop?: CropRect | null,
  maxDimension: number = 480
): ExportGeometry {
  const isCropped = Boolean(
    crop && (crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0)
  );

  const effectiveCrop = isCropped && crop
    ? crop
    : { x: 0, y: 0, width: 1, height: 1 };

  // Calculate proportional downscale for full source frame into maxDimension
  const scale = Math.min(
    maxDimension / Math.max(1, sourceWidth),
    maxDimension / Math.max(1, sourceHeight),
    1.0
  );

  // Derive targetWidth and targetHeight with even dimensions
  let targetWidth = Math.round(sourceWidth * scale);
  let targetHeight = Math.round(sourceHeight * scale);

  if (targetWidth % 2 !== 0) targetWidth -= 1;
  if (targetHeight % 2 !== 0) targetHeight -= 1;
  targetWidth = Math.max(2, targetWidth);
  targetHeight = Math.max(2, targetHeight);

  let cropX = 0;
  let cropY = 0;
  let cropWidth = targetWidth;
  let cropHeight = targetHeight;

  if (isCropped) {
    cropX = Math.round(targetWidth * effectiveCrop.x);
    cropY = Math.round(targetHeight * effectiveCrop.y);
    cropWidth = Math.round(targetWidth * effectiveCrop.width);
    cropHeight = Math.round(targetHeight * effectiveCrop.height);

    if (cropWidth % 2 !== 0) cropWidth -= 1;
    if (cropHeight % 2 !== 0) cropHeight -= 1;
    cropWidth = Math.max(2, Math.min(cropWidth, targetWidth - cropX));
    cropHeight = Math.max(2, Math.min(cropHeight, targetHeight - cropY));
  }

  return {
    targetWidth,
    targetHeight,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    exportWidth: cropWidth,
    exportHeight: cropHeight,
    aspectRatio: cropWidth / cropHeight,
  };
}

/**
 * Transforms a persistent text layer into native extraction options,
 * mapping normalized crop-relative coordinates to uncropped full-frame percentages,
 * and scaling font, outline, and padding to match the final output resolution.
 */
export function transformLayerForExport(
  layer: TextLayer,
  crop: CropRect | null | undefined,
  previewHeight: number,
  exportCropHeight: number
) {
  const isCropped = Boolean(
    crop && (crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0)
  );
  const effectiveCrop = isCropped && crop
    ? crop
    : { x: 0, y: 0, width: 1, height: 1 };

  // Convert layer x, y (percentage 0..100 of visible cropped area) to uncropped full-frame percentage
  const uncroppedPctX = (effectiveCrop.x * 100) + (layer.x * effectiveCrop.width);
  const uncroppedPctY = (effectiveCrop.y * 100) + (layer.y * effectiveCrop.height);

  const exportFontScale = previewHeight > 0 ? exportCropHeight / previewHeight : 1;
  const exportedFontSize = (layer.fontSize * (layer.scale || 1)) * exportFontScale;

  return {
    text: layer.text,
    fontFamily: layer.fontFamily,
    color: layer.color,
    isBold: layer.isBold,
    isItalic: layer.isItalic,
    outlineEnabled: layer.outlineEnabled,
    outlineColor: layer.outlineColor,
    outlineWidth: (layer.outlineWidth || 2) * exportFontScale,
    startMs: layer.startMs,
    endMs: layer.endMs,
    x: uncroppedPctX,
    y: uncroppedPctY,
    fontSize: exportedFontSize,
    scale: 1.0,
    rotation: layer.rotation || 0,
    textAlign: layer.textAlign || 'center',
    backgroundEnabled: layer.backgroundEnabled,
    backgroundColor: layer.backgroundColor,
    backgroundOpacity: layer.backgroundOpacity,
    backgroundPadding: (layer.backgroundPadding ?? 8) * exportFontScale,
    shadowEnabled: layer.shadowEnabled,
    shadowColor: layer.shadowColor,
    shadowOffsetX: (layer.shadowOffsetX ?? 2) * exportFontScale,
    shadowOffsetY: (layer.shadowOffsetY ?? 2) * exportFontScale,
  };
}

/**
 * Transforms a persistent sticker layer into native extraction options.
 */
export function transformStickerForExport(
  sticker: { content: string; x: number; y: number; scale: number; rotation: number; startFrame: number; endFrame: number },
  crop: CropRect | null | undefined,
  previewHeight: number,
  exportCropHeight: number
) {
  const isCropped = Boolean(
    crop && (crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0)
  );
  const effectiveCrop = isCropped && crop
    ? crop
    : { x: 0, y: 0, width: 1, height: 1 };

  const uncroppedPctX = (effectiveCrop.x * 100) + (sticker.x * effectiveCrop.width);
  const uncroppedPctY = (effectiveCrop.y * 100) + (sticker.y * effectiveCrop.height);

  const exportFontScale = previewHeight > 0 ? exportCropHeight / previewHeight : 1;
  const exportedFontSize = (72 * sticker.scale) * exportFontScale;

  return {
    text: sticker.content,
    color: '#FFFFFF',
    startMs: 0,
    endMs: 999999999,
    x: uncroppedPctX,
    y: uncroppedPctY,
    fontSize: exportedFontSize,
    scale: 1.0,
    rotation: sticker.rotation || 0,
    textAlign: 'center',
  };
}

/**
 * Convert persistent percentage (0..100) to preview pixel offset.
 */
export function persistentToPreviewPixels(
  x: number,
  y: number,
  contentWidth: number,
  contentHeight: number
) {
  return {
    pixelX: (x / 100) * contentWidth,
    pixelY: (y / 100) * contentHeight,
  };
}

/**
 * Convert preview pixel offset to persistent percentage (0..100).
 */
export function previewPixelsToPersistent(
  pixelX: number,
  pixelY: number,
  contentWidth: number,
  contentHeight: number
) {
  return {
    x: contentWidth > 0 ? (pixelX / contentWidth) * 100 : 50,
    y: contentHeight > 0 ? (pixelY / contentHeight) * 100 : 50,
  };
}
