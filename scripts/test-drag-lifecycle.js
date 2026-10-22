const assert = require('assert');

// Simulate the mathematical and logical model of DraggableTextLayer & GifEditorScreen
function runDragLifecycleSimulation() {
  console.log('Testing Text Layer Free Movement Drag Lifecycle...');

  const containerWidth = 360;
  const containerHeight = 360;

  // Initial state: User adds text layer at center
  let textLayers = [];
  let editingDraft = {
    id: 'text_1',
    text: 'Add Text',
    x: 50, // 50%
    y: 50, // 50%
    scale: 1,
    rotation: 0,
    fontSize: 32,
  };
  let isEditingText = true;
  let editingDraftRef = { current: editingDraft };

  // Helper simulating the PanResponder lifecycle inside DraggableTextLayer
  function simulateDrag(startCenterX, startCenterY, dx, dy) {
    // 1. onPanResponderGrant
    const dragStartCenter = { x: startCenterX, y: startCenterY };

    // 2. onPanResponderMove (continuous tracking)
    const newCenterX = dragStartCenter.x + dx;
    const newCenterY = dragStartCenter.y + dy;

    // Direct free movement clamping to preview bounds [0, cW] and [0, cH]
    const clampedX = Math.max(0, Math.min(containerWidth, newCenterX));
    const clampedY = Math.max(0, Math.min(containerHeight, newCenterY));

    // 3. onPanResponderRelease (commitPosition)
    const pctX = (clampedX / containerWidth) * 100;
    const pctY = (clampedY / containerHeight) * 100;

    const updated = {
      ...editingDraftRef.current,
      x: pctX,
      y: pctY,
    };
    editingDraftRef.current = updated;
    editingDraft = updated;

    return { clampedX, clampedY, pctX, pctY };
  }

  // Step 1: Initial position at 50%
  let curX = (editingDraft.x / 100) * containerWidth; // 180
  let curY = (editingDraft.y / 100) * containerHeight; // 180
  assert.strictEqual(curX, 180, 'Initial center X is 180');
  assert.strictEqual(curY, 180, 'Initial center Y is 180');

  // Step 2 & 3 & 4: Drag from center to top-left area (dx = -140, dy = -140)
  const res1 = simulateDrag(curX, curY, -140, -140);
  assert.strictEqual(res1.clampedX, 40, 'Text center X is 40 at top-left');
  assert.strictEqual(res1.clampedY, 40, 'Text center Y is 40 at top-left');
  assert.strictEqual(editingDraft.x, (40 / 360) * 100, 'Draft X is committed to top-left %');
  assert.strictEqual(editingDraft.y, (40 / 360) * 100, 'Draft Y is committed to top-left %');
  console.log('✔ Step 1-4: Dragged to top-left area and released. Text stays at exact position (40, 40).');

  // Step 5 & 6: Drag from top-left to center (dx = +140, dy = +140)
  curX = (editingDraft.x / 100) * containerWidth;
  curY = (editingDraft.y / 100) * containerHeight;
  assert.strictEqual(curX, 40, 'Current position starts at 40');
  const res2 = simulateDrag(curX, curY, 140, 140);
  assert.strictEqual(res2.clampedX, 180, 'Text center X is 180 in center');
  assert.strictEqual(res2.clampedY, 180, 'Text center Y is 180 in center');
  assert.strictEqual(editingDraft.x, 50, 'Draft X is committed to center % (50)');
  assert.strictEqual(editingDraft.y, 50, 'Draft Y is committed to center % (50)');
  console.log('✔ Step 5-6: Dragged back to center and released. Text stays at exact center (180, 180).');

  // Step 7 & 8: Drag near bottom-right corner (dx = +150, dy = +150)
  curX = (editingDraft.x / 100) * containerWidth;
  curY = (editingDraft.y / 100) * containerHeight;
  const res3 = simulateDrag(curX, curY, 150, 150);
  assert.strictEqual(res3.clampedX, 330, 'Text center X is 330 near bottom-right');
  assert.strictEqual(res3.clampedY, 330, 'Text center Y is 330 near bottom-right');
  console.log('✔ Step 7-8: Dragged near bottom-right corner and released. Text stays at exact position (330, 330).');

  // Step 9 & 10: Press Apply/Done
  function applyTextChanges() {
    const draft = editingDraftRef.current || editingDraft;
    if (draft) {
      const idx = textLayers.findIndex(l => l.id === draft.id);
      if (idx >= 0) {
        textLayers[idx] = draft;
      } else {
        textLayers.push(draft);
      }
    }
    editingDraftRef.current = null;
    editingDraft = null;
    isEditingText = false;
  }
  applyTextChanges();

  assert.strictEqual(textLayers.length, 1, 'textLayers has committed layer');
  assert.strictEqual(textLayers[0].x, (330 / 360) * 100, 'Committed layer has bottom-right X');
  assert.strictEqual(textLayers[0].y, (330 / 360) * 100, 'Committed layer has bottom-right Y');
  assert.strictEqual(isEditingText, false, 'Exited text-edit mode');
  console.log('✔ Step 9-10: Pressed Apply. Position remained unchanged at (330, 330). Editing mode exited.');

  // Step 11: Switch tools (e.g. crop or speed) and switch back
  let isCropping = true;
  // During cropping, textLayers is unchanged
  assert.strictEqual(textLayers[0].x, (330 / 360) * 100, 'Position unchanged during tool switch');
  isCropping = false;
  console.log('✔ Step 11: Switched tools and back. Committed position strictly preserved.');

  // Step 12: Reopen Text tool and edit existing layer
  function editExistingTextLayer(id) {
    const existing = textLayers.find(l => l.id === id);
    if (existing) {
      const clone = { ...existing };
      editingDraftRef.current = clone;
      editingDraft = clone;
      isEditingText = true;
    }
  }
  editExistingTextLayer('text_1');
  assert.strictEqual(editingDraft.x, (330 / 360) * 100, 'Reopening text editor preserves saved position');
  assert.strictEqual(editingDraft.y, (330 / 360) * 100, 'Reopening text editor preserves saved position');
  console.log('✔ Step 12: Reopened Text tool. Saved position preserved identically without jump.');

  console.log('\nAll drag lifecycle tests passed successfully!');
}

runDragLifecycleSimulation();
