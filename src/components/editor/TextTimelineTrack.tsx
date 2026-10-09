import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity } from 'react-native';
import { TextLayer } from '../../types/editor';

interface TextTimelineTrackProps {
  layer: TextLayer;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateTiming: (startMs: number, endMs: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  totalDurationMs: number;
  timelineWidth: number;
}

export function TextTimelineTrack({
  layer,
  isSelected,
  onSelect,
  onUpdateTiming,
  onDragStart,
  onDragEnd,
  totalDurationMs,
  timelineWidth
}: TextTimelineTrackProps) {
  const minDurationMs = 100;

  // ── Keep refs so PanResponder callbacks always see latest values ──
  const layerRef = useRef(layer);
  const onSelectRef = useRef(onSelect);
  const onUpdateTimingRef = useRef(onUpdateTiming);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const totalDurationMsRef = useRef(totalDurationMs);
  const timelineWidthRef = useRef(timelineWidth);

  useEffect(() => { layerRef.current = layer; }, [layer]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onUpdateTimingRef.current = onUpdateTiming; }, [onUpdateTiming]);
  useEffect(() => { onDragStartRef.current = onDragStart; }, [onDragStart]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => { totalDurationMsRef.current = totalDurationMs; }, [totalDurationMs]);
  useEffect(() => { timelineWidthRef.current = timelineWidth; }, [timelineWidth]);

  const pxToMs = (px: number) => (px / Math.max(timelineWidthRef.current, 1)) * Math.max(totalDurationMsRef.current, 1);
  const msToPx = (ms: number) => (ms / Math.max(totalDurationMs, 1)) * timelineWidth;

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const startPx = msToPx(layer.startMs);
  const endPx = msToPx(layer.endMs);
  const widthPx = Math.max(10, endPx - startPx);

  const dragState = useRef({
    startMsAtGrab: 0,
    endMsAtGrab: 0,
  }).current;

  // ── Left Handle: drags startMs ──
  const leftHandleResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        onSelectRef.current();
        dragState.startMsAtGrab = layerRef.current.startMs;
        onDragStartRef.current?.();
      },
      onPanResponderMove: (_evt, gestureState) => {
        const deltaMs = pxToMs(gestureState.dx);
        let newStart = dragState.startMsAtGrab + deltaMs;
        newStart = clamp(newStart, 0, layerRef.current.endMs - minDurationMs);
        onUpdateTimingRef.current(newStart, layerRef.current.endMs);
      },
      onPanResponderRelease: () => onDragEndRef.current?.(),
      onPanResponderTerminate: () => onDragEndRef.current?.(),
    }),
  []);

  // ── Right Handle: drags endMs ──
  const rightHandleResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        onSelectRef.current();
        dragState.endMsAtGrab = layerRef.current.endMs;
        onDragStartRef.current?.();
      },
      onPanResponderMove: (_evt, gestureState) => {
        const deltaMs = pxToMs(gestureState.dx);
        let newEnd = dragState.endMsAtGrab + deltaMs;
        newEnd = clamp(newEnd, layerRef.current.startMs + minDurationMs, totalDurationMsRef.current);
        onUpdateTimingRef.current(layerRef.current.startMs, newEnd);
      },
      onPanResponderRelease: () => onDragEndRef.current?.(),
      onPanResponderTerminate: () => onDragEndRef.current?.(),
    }),
  []);

  // ── Middle: drags the whole bar (preserves duration) ──
  const middleResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // NO capture here — so child handles (now siblings with higher zIndex) win
      onPanResponderGrant: () => {
        onSelectRef.current();
        dragState.startMsAtGrab = layerRef.current.startMs;
        dragState.endMsAtGrab = layerRef.current.endMs;
        onDragStartRef.current?.();
      },
      onPanResponderMove: (_evt, gestureState) => {
        const deltaMs = pxToMs(gestureState.dx);
        const duration = dragState.endMsAtGrab - dragState.startMsAtGrab;
        let newStart = dragState.startMsAtGrab + deltaMs;
        let newEnd = dragState.endMsAtGrab + deltaMs;
        const total = totalDurationMsRef.current;

        if (newStart < 0) {
          newStart = 0;
          newEnd = duration;
        } else if (newEnd > total) {
          newEnd = total;
          newStart = total - duration;
        }

        onUpdateTimingRef.current(newStart, newEnd);
      },
      onPanResponderRelease: () => onDragEndRef.current?.(),
      onPanResponderTerminate: () => onDragEndRef.current?.(),
    }),
  []);

  return (
    <View style={styles.trackContainer}>
      {/* Background / tap target */}
      <TouchableOpacity 
        style={styles.trackBackground}
        onPress={onSelect}
        activeOpacity={1}
      />
      
      {/* Active colored bar (middle drag) */}
      <View 
        style={[
          styles.activeBar, 
          { 
            left: startPx, 
            width: widthPx,
            backgroundColor: isSelected ? '#06b6d4' : '#3f3f46' 
          }
        ]}
        {...middleResponder.panHandlers}
      >
        <Text style={styles.trackText} numberOfLines={1}>
          {layer.text || 'Text'}
        </Text>
      </View>

      {/* Left Handle — SIBLING, not child, so it gets its own responder */}
      <View 
        style={[styles.handleHitbox, { left: startPx - 20 }]}
        {...leftHandleResponder.panHandlers}
      >
        <View style={[styles.handleVisible, isSelected && styles.handleVisibleSelected]} />
      </View>

      {/* Right Handle — SIBLING, not child */}
      <View 
        style={[styles.handleHitbox, { left: endPx - 20 }]}
        {...rightHandleResponder.panHandlers}
      >
        <View style={[styles.handleVisible, isSelected && styles.handleVisibleSelected]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trackContainer: {
    height: 36,
    marginBottom: 6,
    position: 'relative',
    justifyContent: 'center',
  },
  trackBackground: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: '#18181b',
    borderRadius: 6,
  },
  activeBar: {
    position: 'absolute',
    height: '100%',
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 24, // extra padding so text doesn't overlap handles
  },
  trackText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Shared style for both left & right drag handles
  // Positioned as siblings of the activeBar, with high zIndex
  handleHitbox: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 40,       // big 40pt touch target
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,      // above activeBar
  },
  handleVisible: {
    width: 5,
    height: 24,
    backgroundColor: '#a1a1aa',
    borderRadius: 3,
  },
  handleVisibleSelected: {
    backgroundColor: '#ffffff',
    width: 6,
  }
});
