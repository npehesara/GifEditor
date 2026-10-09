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

  const [textSize, setTextSize] = useState({ width: 0, height: 0, measured: false });

  // Update animated values when props change externally
  useEffect(() => {
    panX.setValue((layer.x / 100) * containerWidth);
    panY.setValue((layer.y / 100) * containerHeight);
    scale.setValue(layer.scale || 1);
  }, [layer.x, layer.y, layer.scale, containerWidth, containerHeight]);

  const padding = 24;

  // Calculate full bounds based on measurement
  // If not yet measured, use a fallback size that allows rendering
  const boundsWidth = textSize.measured ? textSize.width + padding * 2 : 200;
  const boundsHeight = textSize.measured ? textSize.height + padding * 2 : 100;

  const gestureState = useRef({
    previousFocalX: 0,
    previousFocalY: 0,
    previousDistance: 0,
    isPinching: false,
    touchesCount: 0,
  }).current;

  const boundsRef = useRef({ width: boundsWidth, height: boundsHeight });
  boundsRef.current = { width: boundsWidth, height: boundsHeight };

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const getClampedPosition = (newX: number, newY: number, newScale: number) => {
    const { width, height } = boundsRef.current;
    const halfW = (width * newScale) / 2;
    const halfH = (height * newScale) / 2;

    // Allow moving completely to the edge/corner (even slightly offscreen)
    const marginX = halfW;
    const marginY = halfH;

    const clampedX = clamp(newX, -marginX, containerWidth + marginX);
    const clampedY = clamp(newY, -marginY, containerHeight + marginY);

    return { clampedX, clampedY };
  };

  const lastTapRef = useRef<number>(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          onDoubleTap();
        } else {
          onSelect();
        }
        lastTapRef.current = now;

        const touches = evt.nativeEvent.touches;

        let focalX = 0;
        let focalY = 0;
        for (let t of touches) {
          focalX += t.pageX;
          focalY += t.pageY;
        }
        focalX /= touches.length;
        focalY /= touches.length;

        gestureState.previousFocalX = focalX;
        gestureState.previousFocalY = focalY;
        gestureState.touchesCount = touches.length;

        if (touches.length >= 2) {
          gestureState.isPinching = true;
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          gestureState.previousDistance = Math.sqrt(dx * dx + dy * dy);
        } else {
          gestureState.isPinching = false;
        }
      },
      onPanResponderMove: (evt, gestureStateData) => {
        const touches = evt.nativeEvent.touches;

        let focalX = 0;
        let focalY = 0;
        for (let t of touches) {
          focalX += t.pageX;
          focalY += t.pageY;
        }
        focalX /= touches.length;
        focalY /= touches.length;

        if (touches.length !== gestureState.touchesCount) {
          gestureState.previousFocalX = focalX;
          gestureState.previousFocalY = focalY;
          gestureState.touchesCount = touches.length;
          if (touches.length >= 2) {
            gestureState.isPinching = true;
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            gestureState.previousDistance = Math.sqrt(dx * dx + dy * dy);
          } else {
            gestureState.isPinching = false;
          }
          return;
        }

        const deltaX = focalX - gestureState.previousFocalX;
        const deltaY = focalY - gestureState.previousFocalY;

        let currentScale = (scale as any)._value;
        let newPanX = (panX as any)._value + deltaX;
        let newPanY = (panY as any)._value + deltaY;

        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const currentDistance = Math.sqrt(dx * dx + dy * dy);

          if (gestureState.previousDistance > 0) {
             const rawRatio = currentDistance / gestureState.previousDistance;
             // Dampen the scale for a more professional, smooth feel
             const dampedRatio = 1 + (rawRatio - 1) * 0.4;

             let newScale = currentScale * dampedRatio;
             newScale = clamp(newScale, 0.25, 5);

             // Anchor translation compensation
             const shiftX = (focalX - newPanX) * (newScale / currentScale - 1);
             const shiftY = (focalY - newPanY) * (newScale / currentScale - 1);

             newPanX -= shiftX;
             newPanY -= shiftY;
             currentScale = newScale;

             scale.setValue(newScale);
          }
          gestureState.previousDistance = currentDistance;
        }

        const { clampedX, clampedY } = getClampedPosition(newPanX, newPanY, currentScale);
        panX.setValue(clampedX);
        panY.setValue(clampedY);

        gestureState.previousFocalX = focalX;
        gestureState.previousFocalY = focalY;
      },
      onPanResponderRelease: () => {
        gestureState.isPinching = false;
        gestureState.touchesCount = 0;

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
      },
      onPanResponderTerminate: () => {
        gestureState.isPinching = false;
        gestureState.touchesCount = 0;
      }
    })
  ).current;

  // Render SVG text lines
  const lines = layer.text.split('\n');
  const lineHeight = layer.fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;

  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
  let anchorX = '50%';
  if (layer.textAlign === 'left') { textAnchor = 'start'; anchorX = '0%'; }
  if (layer.textAlign === 'right') { textAnchor = 'end'; anchorX = '100%'; }

  const textFillProps = {
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
  };

  return (
    <>
      {/* Hidden Text for actual measurement */}
      <View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: -10000 }}>
        <RNText
          onLayout={(e) => {
            setTextSize({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
              measured: true
            });
            // Immediately clamp in case of font change making it wider
            setTimeout(() => {
              const { clampedX, clampedY } = getClampedPosition(
                (panX as any)._value,
                (panY as any)._value,
                (scale as any)._value
              );
              panX.setValue(clampedX);
              panY.setValue(clampedY);
            }, 0);
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
          <Svg width={boundsWidth - 16} height={boundsHeight - 16} style={{ overflow: 'visible' }}>
            {layer.backgroundEnabled && textSize.measured && (
              <Rect
                x={layer.textAlign === 'left' ? 0 : layer.textAlign === 'right' ? (boundsWidth - 16) - textSize.width : ((boundsWidth - 16) - textSize.width)/2}
                y={(boundsHeight - 16) / 2 - textSize.height / 2 - layer.backgroundPadding}
                width={textSize.width}
                height={textSize.height + layer.backgroundPadding * 2}
                fill={layer.backgroundColor || '#000'}
                fillOpacity={layer.backgroundOpacity ?? 1}
                rx={8}
                ry={8}
              />
            )}
            {lines.map((line: string, i: number) => (
              <React.Fragment key={i}>
                {layer.shadowEnabled && (
                  <SvgText
                    x={anchorX}
                    y={(boundsHeight - 16) / 2 - totalHeight / 2 + (i + 0.8) * lineHeight}
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
                  y={(boundsHeight - 16) / 2 - totalHeight / 2 + (i + 0.8) * lineHeight}
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
            ))}
          </Svg>

          {isSelected && (
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
