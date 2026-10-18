import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Animated, Text as RNText, TouchableOpacity } from 'react-native';
import Svg, { Text as SvgText, Rect } from 'react-native-svg';
import { TextLayer } from '../../types/editor';

interface TextOverlayProps {
  layers: TextLayer[];
  currentTimeMs: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onDoubleTapLayer: (id: string) => void;
  onUpdateLayer: (layer: TextLayer) => void;
  onDeleteLayer: (id: string) => void;
  containerWidth: number;
  containerHeight: number;
  editable: boolean;
}

export function TextOverlay({
  layers,
  currentTimeMs,
  selectedLayerId,
  onSelectLayer,
  onDoubleTapLayer,
  onUpdateLayer,
  onDeleteLayer,
  containerWidth,
  containerHeight,
  editable
}: TextOverlayProps) {

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {layers.map(layer => {
        const isVisible = currentTimeMs >= layer.startMs && currentTimeMs <= layer.endMs;
        if (!isVisible) return null;

        return (
          <DraggableTextLayer
            key={layer.id}
            layer={layer}
            isSelected={selectedLayerId === layer.id}
            onSelect={() => onSelectLayer(layer.id)}
            onDoubleTap={() => onDoubleTapLayer(layer.id)}
            onUpdate={onUpdateLayer}
            onDelete={() => onDeleteLayer(layer.id)}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            editable={editable}
          />
        );
      })}
    </View>
  );
}

function DraggableTextLayer({ layer, isSelected, onSelect, onDoubleTap, onUpdate, onDelete, containerWidth, containerHeight, editable }: any) {
  const panX = useRef(new Animated.Value((layer.x / 100) * containerWidth)).current;
  const panY = useRef(new Animated.Value((layer.y / 100) * containerHeight)).current;
  const scale = useRef(new Animated.Value(layer.scale || 1)).current;

  const layerRef = useRef(layer);
  useEffect(() => { layerRef.current = layer; }, [layer]);

  const isDragging = useRef(false);

  // Update animated values when props change externally (unless currently dragging)
  useEffect(() => {
    if (isDragging.current) return;
    panX.setValue((layer.x / 100) * containerWidth);
    panY.setValue((layer.y / 100) * containerHeight);
    scale.setValue(layer.scale || 1);
  }, [layer.x, layer.y, layer.scale, containerWidth, containerHeight]);

  const [textSize, setTextSize] = useState({ width: 0, height: 0, measured: false });

  // Render SVG text lines
  const lines = layer.text.split('\n');
  const lineHeight = layer.fontSize * 1.25;
  const totalHeight = Math.max(lines.length * lineHeight, 20);

  // Estimate initial text width/height before layout measurement to avoid jump
  const maxLineLen = Math.max(...lines.map((l: string) => l.length), 1);
  const estWidth = Math.max(maxLineLen * (layer.fontSize * 0.6), 40);

  const textWidth = textSize.measured ? textSize.width : estWidth;
  const textHeight = textSize.measured ? textSize.height : totalHeight;

  const padding = 16;
  const boundsWidth = Math.ceil(textWidth + padding * 2);
  const boundsHeight = Math.ceil(textHeight + padding * 2);

  const boundsRef = useRef({ width: boundsWidth, height: boundsHeight });
  boundsRef.current = { width: boundsWidth, height: boundsHeight };

  const getClampedPosition = (newX: number, newY: number, newScale: number) => {
    if (containerWidth <= 0 || containerHeight <= 0) {
      return { clampedX: newX, clampedY: newY };
    }
    const halfW = (boundsRef.current.width * newScale) / 2;
    const halfH = (boundsRef.current.height * newScale) / 2;

    // Allow positioning text cleanly anywhere within preview container bounds
    const minX = -halfW * 0.4;
    const maxX = containerWidth + halfW * 0.4;
    const minY = -halfH * 0.4;
    const maxY = containerHeight + halfH * 0.4;

    const clampedX = Math.max(minX, Math.min(maxX, newX));
    const clampedY = Math.max(minY, Math.min(maxY, newY));

    return { clampedX, clampedY };
  };

  const dragStart = useRef({
    panX: (layer.x / 100) * containerWidth,
    panY: (layer.y / 100) * containerHeight,
    scale: layer.scale || 1,
    initialDistance: 0,
    isPinching: false,
  });

  const commitPosition = () => {
    isDragging.current = false;
    dragStart.current.isPinching = false;
    dragStart.current.initialDistance = 0;

    if (containerWidth <= 0 || containerHeight <= 0) return;

    const finalX = (panX as any)._value;
    const finalY = (panY as any)._value;
    const finalScale = (scale as any)._value;

    const { clampedX, clampedY } = getClampedPosition(finalX, finalY, finalScale);

    onUpdate({
      ...layerRef.current,
      x: (clampedX / containerWidth) * 100,
      y: (clampedY / containerHeight) * 100,
      scale: finalScale
    });
  };

  const lastTapRef = useRef<number>(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return editable && (Math.abs(gesture.dx) > 1 || Math.abs(gesture.dy) > 1);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        if (!editable) return;
        isDragging.current = true;

        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          onDoubleTap();
        } else {
          onSelect();
        }
        lastTapRef.current = now;

        dragStart.current = {
          panX: (panX as any)._value,
          panY: (panY as any)._value,
          scale: (scale as any)._value,
          initialDistance: 0,
          isPinching: false,
        };

        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          dragStart.current.isPinching = true;
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          dragStart.current.initialDistance = Math.sqrt(dx * dx + dy * dy);
        }
      },
      onPanResponderMove: (evt, gesture) => {
        if (!editable) return;
        const touches = evt.nativeEvent.touches;

        // Two-finger pinch to scale smoothly around center
        if (touches && touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const currentDistance = Math.sqrt(dx * dx + dy * dy);

          if (!dragStart.current.isPinching || dragStart.current.initialDistance === 0) {
            dragStart.current.isPinching = true;
            dragStart.current.initialDistance = currentDistance;
            dragStart.current.scale = (scale as any)._value;
          } else if (dragStart.current.initialDistance > 10) {
            const rawRatio = currentDistance / dragStart.current.initialDistance;
            const newScale = Math.max(0.25, Math.min(5, dragStart.current.scale * rawRatio));
            scale.setValue(newScale);
          }
          return;
        }

        // Single finger drag tracking delta from initial grant position
        if (dragStart.current.isPinching) {
          dragStart.current.isPinching = false;
          dragStart.current.panX = (panX as any)._value - gesture.dx;
          dragStart.current.panY = (panY as any)._value - gesture.dy;
        }

        const newX = dragStart.current.panX + gesture.dx;
        const newY = dragStart.current.panY + gesture.dy;
        const currentScale = (scale as any)._value;

        const { clampedX, clampedY } = getClampedPosition(newX, newY, currentScale);
        panX.setValue(clampedX);
        panY.setValue(clampedY);
      },
      onPanResponderRelease: () => {
        if (!editable) return;
        commitPosition();
      },
      onPanResponderTerminate: () => {
        if (!editable) return;
        commitPosition();
      }
    })
  ).current;

  const svgW = boundsWidth - 16;
  const svgH = boundsHeight - 16;
  const svgCenterX = svgW / 2;

  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
  let anchorX: number = svgCenterX;
  if (layer.textAlign === 'left') {
    textAnchor = 'start';
    anchorX = Math.max(0, svgCenterX - textWidth / 2);
  } else if (layer.textAlign === 'right') {
    textAnchor = 'end';
    anchorX = Math.min(svgW, svgCenterX + textWidth / 2);
  }

  const textFillProps = {
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
  };

  const bgPadding = layer.backgroundPadding ?? 8;

  return (
    <>
      {/* Hidden Text for layout measurement */}
      <View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: -10000 }}>
        <RNText
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (Math.abs(textSize.width - width) > 1 || Math.abs(textSize.height - height) > 1 || !textSize.measured) {
              setTextSize({
                width,
                height,
                measured: true
              });
            }
          }}
          style={{
            fontFamily: layer.fontFamily,
            fontSize: layer.fontSize,
            textAlign: layer.textAlign,
          }}
        >
          {layer.text}
        </RNText>
      </View>

      <Animated.View
        style={[
          styles.layerContainer,
          {
            top: 0,
            left: 0,
            width: boundsWidth,
            height: boundsHeight,
            transform: [
              { translateX: panX },
              { translateY: panY },
              { translateX: -boundsWidth / 2 },
              { translateY: -boundsHeight / 2 },
              { scale: scale },
              { rotate: `${layer.rotation || 0}deg` }
            ],
            opacity: layer.opacity,
            zIndex: layer.zIndex || 1,
          }
        ]}
        pointerEvents={editable ? "auto" : "none"}
        {...(editable ? panResponder.panHandlers : {})}
      >
        <View style={[styles.box, isSelected && editable && styles.boxSelected]}>
          <Svg width={svgW} height={svgH} style={{ overflow: 'visible' }}>
            {layer.backgroundEnabled && (
              <Rect
                x={svgCenterX - textWidth / 2 - bgPadding}
                y={(svgH - textHeight) / 2 - bgPadding}
                width={textWidth + bgPadding * 2}
                height={textHeight + bgPadding * 2}
                fill={layer.backgroundColor || '#000'}
                fillOpacity={layer.backgroundOpacity ?? 1}
                rx={8}
                ry={8}
              />
            )}
            {lines.map((line: string, i: number) => {
              const lineY = (svgH - totalHeight) / 2 + (i + 0.8) * lineHeight;
              return (
                <React.Fragment key={i}>
                  {layer.shadowEnabled && (
                    <SvgText
                      x={anchorX}
                      y={lineY}
                      textAnchor={textAnchor}
                      fill={layer.shadowColor}
                      fillOpacity={layer.shadowOpacity ?? 0.8}
                      {...textFillProps as any}
                      dx={layer.shadowOffsetX ?? 2}
                      dy={layer.shadowOffsetY ?? 2}
                    >
                      {line}
                    </SvgText>
                  )}
                  <SvgText
                    x={anchorX}
                    y={lineY}
                    textAnchor={textAnchor}
                    fill={layer.color}
                    {...textFillProps as any}
                    stroke={layer.outlineEnabled ? layer.outlineColor : 'none'}
                    strokeWidth={layer.outlineEnabled ? layer.outlineWidth : 0}
                    strokeLinejoin="round"
                  >
                    {line}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>

          {isSelected && editable && (
            <View style={styles.deleteButtonContainer}>
              <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
                <RNText style={styles.deleteButtonText}>✕</RNText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  layerContainer: {
    position: 'absolute',
  },
  box: {
    padding: 8,
    flex: 1,
  },
  boxSelected: {
    borderWidth: 2,
    borderColor: '#06b6d4',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  deleteButtonContainer: {
    position: 'absolute',
    top: -12,
    left: -12,
    zIndex: 999,
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  }
});
