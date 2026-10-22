import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, PanResponder, Animated, Text as RNText, TouchableOpacity } from 'react-native';
import Svg, { Text as SvgText, Rect } from 'react-native-svg';
import { TextLayer } from '../../types/editor';
import { Colors } from '../../constants/colors';

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
    <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="box-none">
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
  const initialCenterX = (layer.x / 100) * containerWidth;
  const initialCenterY = (layer.y / 100) * containerHeight;

  const currentCenter = useRef({
    x: initialCenterX,
    y: initialCenterY,
    scale: layer.scale || 1
  });

  const layerRef = useRef(layer);
  const editableRef = useRef(editable);
  const isSelectedRef = useRef(isSelected);
  const containerWidthRef = useRef(containerWidth);
  const containerHeightRef = useRef(containerHeight);
  const onUpdateRef = useRef(onUpdate);
  const onSelectRef = useRef(onSelect);
  const isDragging = useRef(false);

  useEffect(() => {
    layerRef.current = layer;
    editableRef.current = editable;
    isSelectedRef.current = isSelected;
    containerWidthRef.current = containerWidth;
    containerHeightRef.current = containerHeight;
    onUpdateRef.current = onUpdate;
    onSelectRef.current = onSelect;
  });

  const [textSize, setTextSize] = useState({ width: 0, height: 0, measured: false });
  const [prevTextKey, setPrevTextKey] = useState(`${layer.text}_${layer.fontSize}_${layer.fontFamily}`);
  const currentTextKey = `${layer.text}_${layer.fontSize}_${layer.fontFamily}`;
  if (currentTextKey !== prevTextKey) {
    setPrevTextKey(currentTextKey);
    if (textSize.measured) {
      setTextSize({ width: 0, height: 0, measured: false });
    }
  }

  // Render SVG text lines
  const lines = layer.text.split('\n');
  const lineHeight = layer.fontSize * 1.25;
  const totalHeight = Math.max(lines.length * lineHeight, 20);

  // Estimate initial text width before layout measurement to avoid jump
  const maxLineLen = Math.max(...lines.map((l: string) => l.length), 1);
  const estWidth = Math.max(maxLineLen * (layer.fontSize * 0.6), 40);

  const textWidth = textSize.measured && textSize.width > 0 ? textSize.width : estWidth;
  const textHeight = totalHeight; // Deterministic height matching native export exactly

  const padding = 16;
  const boundsWidth = Math.ceil(textWidth + padding * 2);
  const boundsHeight = Math.ceil(textHeight + padding * 2);

  const boundsRef = useRef({ width: boundsWidth, height: boundsHeight });
  useEffect(() => {
    boundsRef.current = { width: boundsWidth, height: boundsHeight };
  });

  const [panX] = useState(() => new Animated.Value(initialCenterX - boundsWidth / 2));
  const [panY] = useState(() => new Animated.Value(initialCenterY - boundsHeight / 2));
  const [scale] = useState(() => new Animated.Value(layer.scale || 1));

  // Update animated values when props change externally (unless currently dragging)
  useEffect(() => {
    if (isDragging.current) return;
    const cW = containerWidth;
    const cH = containerHeight;
    if (cW <= 0 || cH <= 0) return;

    const cx = (layer.x / 100) * cW;
    const cy = (layer.y / 100) * cH;
    const s = layer.scale || 1;

    currentCenter.current = { x: cx, y: cy, scale: s };
    panX.setValue(cx - boundsWidth / 2);
    panY.setValue(cy - boundsHeight / 2);
    scale.setValue(s);
  }, [layer.x, layer.y, layer.scale, containerWidth, containerHeight, boundsWidth, boundsHeight, panX, panY, scale]);

  const commitPosition = () => {
    const cW = containerWidthRef.current;
    const cH = containerHeightRef.current;
    if (cW <= 0 || cH <= 0) {
      isDragging.current = false;
      return;
    }

    const finalCenterX = currentCenter.current.x;
    const finalCenterY = currentCenter.current.y;
    const finalScale = currentCenter.current.scale;

    // Center can move across entire visible GIF frame [0, cW] and [0, cH]
    const clampedX = Math.max(0, Math.min(cW, finalCenterX));
    const clampedY = Math.max(0, Math.min(cH, finalCenterY));

    currentCenter.current.x = clampedX;
    currentCenter.current.y = clampedY;

    isDragging.current = false;

    // Convert pixel coordinates directly to percentage (0..100)
    const pctX = (clampedX / cW) * 100;
    const pctY = (clampedY / cH) * 100;

    onUpdateRef.current({
      ...layerRef.current,
      x: pctX,
      y: pctY,
      scale: finalScale,
    });
  };

  // Commit on unmount if gesture was interrupted
  useEffect(() => {
    return () => {
      if (isDragging.current) {
        commitPosition();
      }
    };
  }, []);

  const dragStartCenter = useRef({ x: initialCenterX, y: initialCenterY });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => editableRef.current,
        onMoveShouldSetPanResponder: (_, gesture) => {
          return editableRef.current && (Math.abs(gesture.dx) > 1 || Math.abs(gesture.dy) > 1);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          if (!editableRef.current) return;

          if (!isSelectedRef.current) {
            onSelectRef.current();
          }

          isDragging.current = true;

          dragStartCenter.current = {
            x: currentCenter.current.x,
            y: currentCenter.current.y,
          };
        },
        onPanResponderMove: (_, gesture) => {
          if (!editableRef.current) return;

          const cW = containerWidthRef.current;
          const cH = containerHeightRef.current;
          if (cW <= 0 || cH <= 0) return;

          // Candidate center from gesture initial grant + cumulative displacement
          const newCenterX = dragStartCenter.current.x + gesture.dx;
          const newCenterY = dragStartCenter.current.y + gesture.dy;

          // Completely free movement across the GIF preview content area
          const clampedX = Math.max(0, Math.min(cW, newCenterX));
          const clampedY = Math.max(0, Math.min(cH, newCenterY));

          currentCenter.current.x = clampedX;
          currentCenter.current.y = clampedY;

          const bw = boundsRef.current.width;
          const bh = boundsRef.current.height;

          panX.setValue(clampedX - bw / 2);
          panY.setValue(clampedY - bh / 2);
        },
        onPanResponderRelease: () => {
          if (!editableRef.current) return;
          commitPosition();
        },
        onPanResponderTerminate: () => {
          if (!editableRef.current) return;
          commitPosition();
        }
      }),
    [panX, panY]
  );

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
            left: panX,
            top: panY,
            width: boundsWidth,
            height: boundsHeight,
            transform: [
              { scale: scale },
              { rotate: `${layer.rotation || 0}deg` },
            ],
            opacity: layer.opacity,
            zIndex: isSelected ? 20 : (layer.zIndex || 2),
          }
        ]}
        pointerEvents={editable ? "auto" : "none"}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        {...(editable ? panResponder.panHandlers : {})}
      >
        <View style={[styles.box, isSelected && editable && styles.boxSelected]}>
          <Svg width={svgW} height={svgH} pointerEvents="none" style={{ overflow: 'visible' }}>
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
            <View style={styles.deleteButtonContainer} onStartShouldSetResponderCapture={() => true}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                style={styles.deleteButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
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
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 8,
  },
  boxSelected: {
    borderColor: Colors.secondaryLight,
    borderStyle: 'dashed',
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
    backgroundColor: Colors.danger,
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
