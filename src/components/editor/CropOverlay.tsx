import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, PanResponder, Animated } from 'react-native';
import { Colors } from '../../constants/colors';

export type CropRect = { x: number; y: number; width: number; height: number };

interface CropOverlayProps {
  initialCrop: CropRect;
  onChange: (crop: CropRect) => void;
  width: number;
  height: number;
  aspectRatio?: number | null; // e.g. 1 (1:1), 16/9, etc. null for free
}

const MIN_CROP_SIZE = 40; // minimum absolute pixels

export function CropOverlay({ initialCrop, onChange, width, height, aspectRatio }: CropOverlayProps) {
  // Use Animated values for smooth dragging without re-renders
  const animX = useRef(new Animated.Value(initialCrop.x * width)).current;
  const animY = useRef(new Animated.Value(initialCrop.y * height)).current;
  const animW = useRef(new Animated.Value(initialCrop.width * width)).current;
  const animH = useRef(new Animated.Value(initialCrop.height * height)).current;

  // Refs to hold current absolute values synchronously for PanResponders
  const valX = useRef(initialCrop.x * width);
  const valY = useRef(initialCrop.y * height);
  const valW = useRef(initialCrop.width * width);
  const valH = useRef(initialCrop.height * height);

  // Keep width/height/aspectRatio in refs so PanResponder closures always read current values
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const aspectRef = useRef(aspectRatio);
  widthRef.current = width;
  heightRef.current = height;
  aspectRef.current = aspectRatio;

  // Keep onChange in a ref to avoid stale closures
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync animation values
  const syncVals = (x: number, y: number, w: number, h: number) => {
    valX.current = x; valY.current = y; valW.current = w; valH.current = h;
    animX.setValue(x); animY.setValue(y); animW.setValue(w); animH.setValue(h);
  };

  useEffect(() => {
    // When initialCrop or aspect ratio changes (e.g. from preset buttons)
    let newW = initialCrop.width * width;
    let newH = initialCrop.height * height;

    if (aspectRatio) {
      if (newW / newH > aspectRatio) {
        newW = newH * aspectRatio;
      } else {
        newH = newW / aspectRatio;
      }
    }

    // center it
    const newX = initialCrop.x * width + (initialCrop.width * width - newW) / 2;
    const newY = initialCrop.y * height + (initialCrop.height * height - newH) / 2;

    syncVals(newX, newY, newW, newH);
    if (width > 0 && height > 0) {
      onChangeRef.current({
        x: newX / width,
        y: newY / height,
        width: newW / width,
        height: newH / height,
      });
    }
  }, [initialCrop, width, height, aspectRatio]);

  const reportChange = () => {
    const w = widthRef.current;
    const h = heightRef.current;
    if (w <= 0 || h <= 0) return;
    onChangeRef.current({
      x: valX.current / w,
      y: valY.current / h,
      width: valW.current / w,
      height: valH.current / h,
    });
  };

  // Start states for each pan responder (plain refs, no hooks inside functions)
  const centerStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const tlStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const trStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const blStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const brStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleResize = (corner: 'tl' | 'tr' | 'bl' | 'br', startRef: React.MutableRefObject<{ x: number; y: number; w: number; h: number }>, dx: number, dy: number) => {
    const cWidth = widthRef.current;
    const cHeight = heightRef.current;
    const ar = aspectRef.current;
    let { x, y, w, h } = startRef.current;

    // Apply dx/dy based on corner
    if (corner.includes('l')) {
      dx = Math.min(dx, w - MIN_CROP_SIZE); // cannot push past min width
      dx = Math.max(dx, -x); // cannot push past left edge
      x += dx;
      w -= dx;
    } else {
      dx = Math.max(dx, MIN_CROP_SIZE - w);
      dx = Math.min(dx, cWidth - (x + w));
      w += dx;
    }

    if (corner.includes('t')) {
      dy = Math.min(dy, h - MIN_CROP_SIZE);
      dy = Math.max(dy, -y);
      y += dy;
      h -= dy;
    } else {
      dy = Math.max(dy, MIN_CROP_SIZE - h);
      dy = Math.min(dy, cHeight - (y + h));
      h += dy;
    }

    if (ar) {
      // Enforce aspect ratio
      let adjH = w / ar;
      let adjW = w;
      if (adjH > (corner.includes('t') ? y + h : cHeight - y)) {
        adjH = corner.includes('t') ? y + h : cHeight - y;
        adjW = adjH * ar;
      }
      if (adjW > (corner.includes('l') ? x + w : cWidth - x)) {
        adjW = corner.includes('l') ? x + w : cWidth - x;
        adjH = adjW / ar;
      }

      if (corner.includes('l')) x += (w - adjW);
      if (corner.includes('t')) y += (h - adjH);
      w = adjW;
      h = adjH;
    }

    syncVals(x, y, w, h);
  };

  const createResizerResponder = (corner: 'tl' | 'tr' | 'bl' | 'br', startRef: React.MutableRefObject<{ x: number; y: number; w: number; h: number }>) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = { x: valX.current, y: valY.current, w: valW.current, h: valH.current };
      },
      onPanResponderMove: (_e, g) => {
        handleResize(corner, startRef, g.dx, g.dy);
      },
      onPanResponderRelease: () => reportChange(),
      onPanResponderTerminate: () => reportChange(),
    });
  };

  const centerResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      centerStart.current = { x: valX.current, y: valY.current, w: valW.current, h: valH.current };
    },
    onPanResponderMove: (_e, g) => {
      const cWidth = widthRef.current;
      const cHeight = heightRef.current;
      const { x, y, w, h } = centerStart.current;
      const newX = Math.max(0, Math.min(x + g.dx, cWidth - w));
      const newY = Math.max(0, Math.min(y + g.dy, cHeight - h));
      syncVals(newX, newY, w, h);
    },
    onPanResponderRelease: () => reportChange(),
    onPanResponderTerminate: () => reportChange(),
  }), []);

  const tlResponder = useMemo(() => createResizerResponder('tl', tlStart), []);
  const trResponder = useMemo(() => createResizerResponder('tr', trStart), []);
  const blResponder = useMemo(() => createResizerResponder('bl', blStart), []);
  const brResponder = useMemo(() => createResizerResponder('br', brStart), []);

  // Render dimmed background overlay with a hole.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Top overlay */}
      <Animated.View pointerEvents="none" style={[styles.dim, { top: 0, left: 0, right: 0, height: animY }]} />
      {/* Bottom overlay */}
      <Animated.View pointerEvents="none" style={[styles.dim, { bottom: 0, left: 0, right: 0, top: Animated.add(animY, animH) }]} />
      {/* Left overlay */}
      <Animated.View pointerEvents="none" style={[styles.dim, { top: animY, height: animH, left: 0, width: animX }]} />
      {/* Right overlay */}
      <Animated.View pointerEvents="none" style={[styles.dim, { top: animY, height: animH, right: 0, left: Animated.add(animX, animW) }]} />

      {/* Crop Frame */}
      <Animated.View style={[styles.frame, { left: animX, top: animY, width: animW, height: animH }]}>
        {/* Center draggable area */}
        <View style={styles.centerDrag} {...centerResponder.panHandlers} />

        {/* Corners */}
        <View style={[styles.corner, styles.tl]} {...tlResponder.panHandlers}><View style={[styles.handle, styles.htl]}/></View>
        <View style={[styles.corner, styles.tr]} {...trResponder.panHandlers}><View style={[styles.handle, styles.htr]}/></View>
        <View style={[styles.corner, styles.bl]} {...blResponder.panHandlers}><View style={[styles.handle, styles.hbl]}/></View>
        <View style={[styles.corner, styles.br]} {...brResponder.panHandlers}><View style={[styles.handle, styles.hbr]}/></View>
      </Animated.View>
    </View>
  );
}

const CORNER_SIZE = 40;
const BORDER_WIDTH = 2;

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    backgroundColor: Colors.overlay,
  },
  frame: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: Colors.secondaryLight,
  },
  centerDrag: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  tl: { top: -CORNER_SIZE/2, left: -CORNER_SIZE/2 },
  tr: { top: -CORNER_SIZE/2, right: -CORNER_SIZE/2 },
  bl: { bottom: -CORNER_SIZE/2, left: -CORNER_SIZE/2 },
  br: { bottom: -CORNER_SIZE/2, right: -CORNER_SIZE/2 },
  handle: {
    position: 'absolute',
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
  },
  htl: { top: CORNER_SIZE/2 - BORDER_WIDTH, left: CORNER_SIZE/2 - BORDER_WIDTH, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3 },
  htr: { top: CORNER_SIZE/2 - BORDER_WIDTH, right: CORNER_SIZE/2 - BORDER_WIDTH, width: 20, height: 20, borderTopWidth: 3, borderRightWidth: 3 },
  hbl: { bottom: CORNER_SIZE/2 - BORDER_WIDTH, left: CORNER_SIZE/2 - BORDER_WIDTH, width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3 },
  hbr: { bottom: CORNER_SIZE/2 - BORDER_WIDTH, right: CORNER_SIZE/2 - BORDER_WIDTH, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3 },
});
