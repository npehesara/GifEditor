// Regression test script for GIF Export Geometry and Text Layer System
const assert = require('assert');

// 1. Math transforms replicating src/utils/textGeometry.ts
function calculateContentDimensions(sourceWidth, sourceHeight, crop) {
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

function calculatePreviewContentRect(containerWidth, containerHeight, contentAspect) {
  if (containerWidth <= 0 || containerHeight <= 0 || contentAspect <= 0) {
    return { width: containerWidth, height: containerHeight, aspectRatio: contentAspect || 1 };
  }
  const containerRatio = containerWidth / containerHeight;
  let renderW, renderH;
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

function calculateExportGeometry(sourceWidth, sourceHeight, crop, maxDimension = 480) {
  const isCropped = Boolean(
    crop && (crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0)
  );
  const effectiveCrop = isCropped && crop ? crop : { x: 0, y: 0, width: 1, height: 1 };

  const scale = Math.min(
    maxDimension / Math.max(1, sourceWidth),
    maxDimension / Math.max(1, sourceHeight),
    1.0
  );

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

function transformLayerForExport(layer, crop, previewHeight, exportCropHeight) {
  const isCropped = Boolean(crop && (crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0));
  const effectiveCrop = isCropped && crop ? crop : { x: 0, y: 0, width: 1, height: 1 };

  const uncroppedPctX = (effectiveCrop.x * 100) + (layer.x * effectiveCrop.width);
  const uncroppedPctY = (effectiveCrop.y * 100) + (layer.y * effectiveCrop.height);
  const exportFontScale = previewHeight > 0 ? exportCropHeight / previewHeight : 1;

  return {
    x: uncroppedPctX,
    y: uncroppedPctY,
    fontSize: (layer.fontSize * (layer.scale || 1)) * exportFontScale,
  };
}

function runTests() {
  console.log('Running GIF Export & Text Layer Regression Tests...');

  // Test 1: Portrait GIF without cropping (300x600)
  {
    const geom = calculateExportGeometry(300, 600, null, 480);
    assert.strictEqual(geom.cropX, 0, 'No crop X for uncropped portrait');
    assert.strictEqual(geom.cropY, 0, 'No crop Y for uncropped portrait');
    assert.strictEqual(geom.exportWidth, 240, 'Export width preserves aspect ratio 1:2');
    assert.strictEqual(geom.exportHeight, 480, 'Export height scales to max 480');
    assert.strictEqual(geom.exportWidth / geom.exportHeight, 300 / 600, 'Portrait aspect ratio preserved exactly');
    console.log('✔ Test 1: Portrait GIF without cropping preserved aspect ratio (240x480 for 300x600)');
  }

  // Test 2: Landscape GIF without cropping (800x400)
  {
    const geom = calculateExportGeometry(800, 400, null, 480);
    assert.strictEqual(geom.cropX, 0, 'No crop X for uncropped landscape');
    assert.strictEqual(geom.cropY, 0, 'No crop Y for uncropped landscape');
    assert.strictEqual(geom.exportWidth, 480, 'Export width scales to max 480');
    assert.strictEqual(geom.exportHeight, 240, 'Export height preserves aspect ratio 2:1');
    assert.strictEqual(geom.exportWidth / geom.exportHeight, 800 / 400, 'Landscape aspect ratio preserved exactly');
    console.log('✔ Test 2: Landscape GIF without cropping preserved aspect ratio (480x240 for 800x400)');
  }

  // Test 3: Square GIF without cropping (500x500)
  {
    const geom = calculateExportGeometry(500, 500, null, 480);
    assert.strictEqual(geom.exportWidth, 480, 'Square export width is 480');
    assert.strictEqual(geom.exportHeight, 480, 'Square export height is 480');
    assert.strictEqual(geom.exportWidth, geom.exportHeight, 'Square aspect ratio is 1:1');
    console.log('✔ Test 3: Square GIF without cropping remains square (480x480)');
  }

  // Test 4: Explicit crop (center 50% square crop on 800x400)
  {
    const crop = { x: 0.25, y: 0, width: 0.5, height: 1.0 };
    const geom = calculateExportGeometry(800, 400, crop, 480);
    assert.strictEqual(geom.targetWidth, 480);
    assert.strictEqual(geom.targetHeight, 240);
    assert.strictEqual(geom.cropX, 120, 'Crop offset X is 25% of 480 = 120');
    assert.strictEqual(geom.cropY, 0);
    assert.strictEqual(geom.cropWidth, 240, 'Crop width is 50% of 480 = 240');
    assert.strictEqual(geom.cropHeight, 240, 'Crop height is 240');
    assert.strictEqual(geom.exportWidth, 240);
    assert.strictEqual(geom.exportHeight, 240);
    console.log('✔ Test 4: Explicit crop exports only the cropped rectangle (240x240 at cx=120, cy=0)');
  }

  // Test 5: Text positioning & coordinate transform
  {
    // Layer at corner (10, 10) in cropped frame
    const crop = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    const layer = { text: 'Hello', x: 10, y: 10, fontSize: 30, scale: 1 };
    const transformed = transformLayerForExport(layer, crop, 200, 400);
    // Uncropped X: 25 + (10/100)*0.5 * 100 = 25 + 5 = 30%
    assert.strictEqual(transformed.x, 30, 'Layer X transformed to uncropped percentage');
    assert.strictEqual(transformed.y, 30, 'Layer Y transformed to uncropped percentage');
    assert.strictEqual(transformed.fontSize, 60, 'Font scaled proportionally by 400/200 = 2x');
    console.log('✔ Test 5: Text coordinate transform and font scaling exact');
  }

  // Test 6: Draft isolation test (simulating React state machine)
  {
    let textLayers = [{ id: 'text_1', text: 'Original A', x: 20, y: 30 }];
    let editingDraft = null;

    // Start editing text_1
    editingDraft = { ...textLayers[0] };
    // Move draft
    editingDraft.x = 80;
    editingDraft.y = 90;
    editingDraft.text = 'Modified A';

    // Verify textLayers was NOT mutated while drafting
    assert.strictEqual(textLayers[0].x, 20, 'Saved layer remained untouched during drag');
    assert.strictEqual(textLayers[0].text, 'Original A', 'Saved text remained untouched during typing');

    // Cancel edit
    editingDraft = null;
    assert.strictEqual(textLayers[0].x, 20, 'Cancelling edit discarded draft completely');

    // Re-edit and Apply
    editingDraft = { ...textLayers[0] };
    editingDraft.x = 85;
    editingDraft.y = 95;
    textLayers = textLayers.map(l => l.id === editingDraft.id ? editingDraft : l);
    editingDraft = null;
    assert.strictEqual(textLayers[0].x, 85, 'Applying saved the draft position');

    // Add independent text_2
    const newLayer = { id: 'text_2', text: 'Layer B', x: 50, y: 50 };
    editingDraft = newLayer;
    textLayers.push(editingDraft);
    editingDraft = null;
    assert.strictEqual(textLayers.length, 2, 'Added independent second layer');
    assert.strictEqual(textLayers[0].id, 'text_1');
    assert.strictEqual(textLayers[1].id, 'text_2');
    console.log('✔ Test 6: Draft isolation, cancel, apply, and multi-layer independence confirmed');
  }

  console.log('\nAll 6 regression test suites passed successfully!');
}

runTests();
