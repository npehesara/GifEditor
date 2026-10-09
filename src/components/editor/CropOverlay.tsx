import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Animated } from 'react-native';

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

  // Sync animation values
  const syncVals = (x: number, y: number, w: number, h: number) => {
    valX.current = x; valY.current = y; valW.current = w; valH.current = h;
    animX.setValue(x); animY.setValue(y); animW.setValue(w); animH.setValue(h);
  };

  useEffect(() => {
    // When initialCrop or aspect ratio changes (e.g. from preset buttons)
    // we need to center the new crop rect or apply it.
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
  }, [initialCrop, width, height, aspectRatio]);

  const reportChange = (x: number, y: number, w: number, h: number) => {
    onChange({
      x: x / width,
      y: y / height,
      width: w / width,
      height: h / height,
    });
  };

  const createResizer = (corner: 'tl' | 'tr' | 'bl' | 'br') => {
    const startState = useRef({ x: 0, y: 0, w: 0, h: 0 });
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startState.current = { x: valX.current, y: valY.current, w: valW.current, h: valH.current };
      },
      onPanResponderMove: (e, g) => {
        let { x, y, w, h } = startState.current;
        let dx = g.dx;
        let dy = g.dy;

        // Apply dx/dy based on corner
        if (corner.includes('l')) {
          dx = Math.min(dx, w - MIN_CROP_SIZE); // cannot push past min width
          dx = Math.max(dx, -x); // cannot push past left edge
          x += dx;
          w -= dx;
        } else {
          dx = Math.max(dx, MIN_CROP_SIZE - w);
          dx = Math.min(dx, width - (x + w));
          w += dx;
        }

        if (corner.includes('t')) {
          dy = Math.min(dy, h - MIN_CROP_SIZE);
          dy = Math.max(dy, -y);
          y += dy;
          h -= dy;
        } else {
          dy = Math.max(dy, MIN_CROP_SIZE - h);
          dy = Math.min(dy, height - (y + h));
          h += dy;
        }

        if (aspectRatio) {
          // Enforce aspect ratio. Which dimension drives? Usually the dominant drag axis.
          // For simplicity, let width drive height, but if height exceeds bounds, let height drive width.
          let adjH = w / aspectRatio;
          let adjW = w;
          if (adjH > (corner.includes('t') ? y + h : height - y)) {
            adjH = corner.includes('t') ? y + h : height - y;
            adjW = adjH * aspectRatio;
          }
          if (adjW > (corner.includes('l') ? x + w : width - x)) {
            adjW = corner.includes('l') ? x + w : width - x;
            adjH = adjW / aspectRatio;
          }

          if (corner.includes('l')) x += (w - adjW);
          if (corner.includes('t')) y += (h - adjH);
          w = adjW;
          h = adjH;
        }

        syncVals(x, y, w, h);
      },
      onPanResponderRelease: () => reportChange(valX.current, valY.current, valW.current, valH.current)
    });
  };

  const centerStartState = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const centerResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      centerStartState.current = { x: valX.current, y: valY.current, w: valW.current, h: valH.current };
    },
    onPanResponderMove: (e, g) => {
      const { x, y, w, h } = centerStartState.current;
      let newX = Math.max(0, Math.min(x + g.dx, width - w));
      let newY = Math.max(0, Math.min(y + g.dy, height - h));
      syncVals(newX, newY, w, h);
    },
    onPanResponderRelease: () => reportChange(valX.current, valY.current, valW.current, valH.current)
  })).current;

  const tlResponder = useRef(createResizer('tl')).current;
  const trResponder = useRef(createResizer('tr')).current;
  const blResponder = useRef(createResizer('bl')).current;
  const brResponder = useRef(createResizer('br')).current;

  // Render dimmed background overlay with a hole.
  // We can use 4 absolute views (top, bottom, left, right) around the crop rect.
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Top overlay */}
      <Animated.View style={[styles.dim, { top: 0, left: 0, right: 0, height: animY }]} />
      {/* Bottom overlay */}
      <Animated.View style={[styles.dim, { bottom: 0, left: 0, right: 0, top: Animated.add(animY, animH) }]} />
      {/* Left overlay */}
      <Animated.View style={[styles.dim, { top: animY, height: animH, left: 0, width: animX }]} />
      {/* Right overlay */}
      <Animated.View style={[styles.dim, { top: animY, height: animH, right: 0, left: Animated.add(animX, animW) }]} />

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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  frame: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#ffffff',
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
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  htl: { top: CORNER_SIZE/2 - BORDER_WIDTH, left: CORNER_SIZE/2 - BORDER_WIDTH, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3 },
  htr: { top: CORNER_SIZE/2 - BORDER_WIDTH, right: CORNER_SIZE/2 - BORDER_WIDTH, width: 20, height: 20, borderTopWidth: 3, borderRightWidth: 3 },
  hbl: { bottom: CORNER_SIZE/2 - BORDER_WIDTH, left: CORNER_SIZE/2 - BORDER_WIDTH, width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3 },
  hbr: { bottom: CORNER_SIZE/2 - BORDER_WIDTH, right: CORNER_SIZE/2 - BORDER_WIDTH, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3 },
});
