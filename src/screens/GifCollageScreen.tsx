import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, Alert, Dimensions, Image, ActivityIndicator, PanResponder, Animated } from 'react-native';
import { ArrowLeft, Layers, Plus, X, Trash2, Settings2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { GifOutputInfo } from './GifOutputScreen';

interface GifCollageScreenProps {
  onBack: () => void;
  onConversionComplete: (info: GifOutputInfo) => void;
}

interface CollageTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

interface CollageItem {
  id: string;
  uri: string;
  mimeType?: string;
  isGif: boolean;
  transform: CollageTransform;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLLAGE_SIZE = SCREEN_WIDTH - 48; // 24px padding on each side

interface TransformableItemViewProps {
  item: CollageItem;
  isSelected: boolean;
  onSelect: () => void;
  onTransformChange: (t: CollageTransform) => void;
  onRemove: () => void;
}

function TransformableItemView({ item, isSelected, onSelect, onTransformChange, onRemove }: TransformableItemViewProps) {
  const pan = useRef(new Animated.ValueXY({ x: item.transform.translateX, y: item.transform.translateY })).current;
  const scale = useRef(new Animated.Value(item.transform.scale)).current;
  // State to track current transforms synchronously without relying on Animated private _value
  const state = useRef({
    panX: item.transform.translateX,
    panY: item.transform.translateY,
    scale: item.transform.scale,
    lastTouchCount: 0,
    lastTouchX: 0,
    lastTouchY: 0,
    initialDistance: 0,
    baseScale: item.transform.scale,
  }).current;

  // Update animated values if the item transform prop changes externally (like reset)
  React.useEffect(() => {
    pan.setValue({ x: item.transform.translateX, y: item.transform.translateY });
    scale.setValue(item.transform.scale);

    state.panX = item.transform.translateX;
    state.panY = item.transform.translateY;
    state.scale = item.transform.scale;
  }, [item.transform]);

  const calcDistance = (touches: any) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        onSelect();
        const touches = evt.nativeEvent.touches;
        state.lastTouchCount = touches.length;

        if (touches.length === 1) {
          state.lastTouchX = touches[0].pageX;
          state.lastTouchY = touches[0].pageY;
        } else if (touches.length === 2) {
          state.initialDistance = calcDistance(touches);
          state.baseScale = state.scale;
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;

        // Handle transition between 1 and 2 fingers
        if (touches.length !== state.lastTouchCount) {
          state.lastTouchCount = touches.length;
          if (touches.length === 1) {
            state.lastTouchX = touches[0].pageX;
            state.lastTouchY = touches[0].pageY;
          } else if (touches.length === 2) {
            state.initialDistance = calcDistance(touches);
            state.baseScale = state.scale;
          }
          return; // Skip this frame to avoid jumps
        }

        if (touches.length === 2) {
          // Pinch Zoom
          const currentDistance = calcDistance(touches);
          const scaleDelta = currentDistance / state.initialDistance;
          let newScale = state.baseScale * scaleDelta;

          if (newScale < 1) newScale = 1;
          if (newScale > 4) newScale = 4;

          state.scale = newScale;
          scale.setValue(newScale);
        } else if (touches.length === 1) {
          // Drag Pan
          const dx = touches[0].pageX - state.lastTouchX;
          const dy = touches[0].pageY - state.lastTouchY;

          state.lastTouchX = touches[0].pageX;
          state.lastTouchY = touches[0].pageY;

          let newX = state.panX + dx;
          let newY = state.panY + dy;

          // Soft clamp to prevent dragging completely out of view
          const maxPan = 200 * state.scale;

          if (newX > maxPan) newX = maxPan;
          if (newX < -maxPan) newX = -maxPan;
          if (newY > maxPan) newY = maxPan;
          if (newY < -maxPan) newY = -maxPan;

          state.panX = newX;
          state.panY = newY;
          pan.setValue({ x: newX, y: newY });
        }
      },

      onPanResponderRelease: (evt) => {
        const touches = evt.nativeEvent.touches;
        state.lastTouchCount = touches.length;

        if (touches.length === 1) {
          // One finger remains down, reset its tracking so it doesn't jump
          state.lastTouchX = touches[0].pageX;
          state.lastTouchY = touches[0].pageY;
        } else if (touches.length === 0) {
          // All fingers lifted, save final state
          onTransformChange({
            scale: state.scale,
            translateX: state.panX,
            translateY: state.panY,
          });
        }
      },
    })
  ).current;

  return (
    <View
      style={[styles.itemWrapper, isSelected && styles.itemWrapperSelected]}
      {...panResponder.panHandlers}
    >
      <Animated.View style={{
        width: '100%',
        height: '100%',
        transform: [
          { translateX: pan.x },
          { translateY: pan.y },
          { scale: scale }
        ]
      }}>
        <Image
          source={{ uri: item.uri }}
          style={[styles.itemImage as any]}
          resizeMode="contain"
        />
      </Animated.View>
      <View style={styles.itemBadge}>
        <Text style={styles.itemBadgeText}>{item.isGif ? 'GIF' : 'IMG'}</Text>
      </View>
      {isSelected && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
          activeOpacity={0.7}
        >
          <X size={16} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function GifCollageScreen({ onBack, onConversionComplete }: GifCollageScreenProps) {
  const [items, setItems] = useState<CollageItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleCreateGif = async () => {
    if (items.length === 0) return;

    try {
      setCreating(true);
      setProgress(0);

      // 1. Prepare all items
      const { prepareGifFrame, prepareStaticImageFrame } = await import('../services/collage/framePrep');
      const preparedItems = [];
      for (const item of items) {
        let prepared;
        if (item.isGif) {
          prepared = await prepareGifFrame(item.id, item.uri);
        } else {
          prepared = await prepareStaticImageFrame(item.id, item.uri, 480, 480);
        }

        // Scale transform from UI preview coords to 480x480 export coords
        const scaleFactor = 480 / COLLAGE_SIZE;
        // @ts-ignore
        prepared.transform = {
          scale: item.transform.scale,
          translateX: item.transform.translateX * scaleFactor,
          translateY: item.transform.translateY * scaleFactor,
        };
        preparedItems.push(prepared);
      }

      // 2. Compose collage
      const { composeCollage } = await import('../services/collage/collageComposer');
      const result = await composeCollage({
        items: preparedItems,
        targetSize: 480,
        onProgress: (p) => setProgress(p),
      });

      // 3. Complete
      onConversionComplete({
        uri: result.uri,
        filename: result.filename,
        width: 480,
        height: 480,
        durationMs: preparedItems.some(i => i.isGif) ? Math.max(...preparedItems.filter(i => i.isGif).map(i => i.totalDurationMs)) : 100,
        sizeBytes: result.sizeBytes
      });

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create collage');
      setCreating(false);
    }
  };

  const handleAddItems = async () => {
    if (items.length >= 4) {
      Alert.alert('Maximum reached', 'You can only add up to 4 items in a collage.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 4 - items.length,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        let selectedAssets = result.assets;

        if (selectedAssets.length > 4 - items.length) {
          Alert.alert('Maximum reached', 'You can only add up to 4 items in a collage. Only the first allowed items were added.');
          selectedAssets = selectedAssets.slice(0, 4 - items.length);
        }

        const newItems: CollageItem[] = selectedAssets.map(asset => {
          const uri = asset.uri;
          const fileName = asset.fileName || '';
          const mimeType = asset.mimeType || '';

          const isGifByMime = mimeType === 'image/gif';
          const isGifByExt = uri.toLowerCase().endsWith('.gif') || fileName.toLowerCase().endsWith('.gif');

          return {
            id: Math.random().toString(36).substring(7),
            uri,
            mimeType,
            isGif: isGifByMime || isGifByExt,
            transform: { scale: 1, translateX: 0, translateY: 0 },
          };
        });

        setItems(prev => [...prev, ...newItems]);
      }
    } catch (error) {
      console.warn('Error picking image:', error);
      Alert.alert('Error', 'Could not open image picker.');
    }
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleTestPrep = async () => {
    if (items.length === 0) {
      Alert.alert('Empty', 'Select at least one item to test frame preparation.');
      return;
    }
    try {
      Alert.alert('Testing', 'Processing frames...');
      const { prepareGifFrame, prepareStaticImageFrame } = await import('../services/collage/framePrep');

      const item = items[0];
      let result;
      if (item.isGif) {
        result = await prepareGifFrame(item.id, item.uri);
      } else {
        result = await prepareStaticImageFrame(item.id, item.uri, 480, 480);
      }

      Alert.alert('Prep Success', `Type: ${item.isGif ? 'GIF' : 'IMAGE'}\nDimensions: ${result.width}x${result.height}\nFrames: ${result.frames.length}\nDuration: ${result.totalDurationMs}ms`);
    } catch (e: any) {
      Alert.alert('Prep Error', e.message);
    }
  };

  const renderLayout = () => {
    const count = items.length;

    if (count === 0) {
      return (
        <View style={styles.placeholderCard}>
          <View style={styles.iconContainer}>
            <Layers size={48} color="#ec4899" />
          </View>
          <Text style={styles.placeholderTitle}>Select GIFs to begin</Text>
          <Text style={styles.placeholderText}>
            Combine multiple GIFs into one animated collage.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.collageContainer, { width: COLLAGE_SIZE, height: COLLAGE_SIZE }]}>
        {count === 1 && (
          <View style={styles.grid1}>
            {renderItem(items[0], '100%', '100%')}
          </View>
        )}

        {count === 2 && (
          <View style={styles.grid2}>
            {renderItem(items[0], '49.5%', '100%')}
            {renderItem(items[1], '49.5%', '100%')}
          </View>
        )}

        {count === 3 && (
          <View style={styles.grid3}>
            <View style={styles.grid3Top}>
              {renderItem(items[0], '100%', '100%')}
            </View>
            <View style={styles.grid3Bottom}>
              {renderItem(items[1], '49.5%', '100%')}
              {renderItem(items[2], '49.5%', '100%')}
            </View>
          </View>
        )}

        {count === 4 && (
          <View style={styles.grid4}>
            <View style={styles.gridRow}>
              {renderItem(items[0], '49.5%', '100%')}
              {renderItem(items[1], '49.5%', '100%')}
            </View>
            <View style={styles.gridRow}>
              {renderItem(items[2], '49.5%', '100%')}
              {renderItem(items[3], '49.5%', '100%')}
            </View>
          </View>
        )}
      </View>
    );
  };

  const handleTransformChange = (id: string, newTransform: CollageTransform) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, transform: newTransform } : item));
  };

  const renderItem = (item: CollageItem, width: string | number, height: string | number) => {
    return (
      <View key={item.id} style={{ width: width as any, height: height as any }}>
        <TransformableItemView
          item={item}
          isSelected={selectedId === item.id}
          onSelect={() => setSelectedId(item.id)}
          onTransformChange={(t) => handleTransformChange(item.id, t)}
          onRemove={() => removeItem(item.id)}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft color="#f8fafc" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>GIF Collage</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {renderLayout()}

        <View style={styles.controlsContainer}>
          {items.length < 4 ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddItems}
              activeOpacity={0.8}
            >
              <Plus size={24} color="#ffffff" />
              <Text style={styles.addButtonText}>Add Item ({items.length}/4)</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.maxItemsContainer}>
              <Text style={styles.maxItemsText}>Maximum 4 items reached</Text>
            </View>
          )}

          {items.length > 0 && (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, creating && { opacity: 0.5 }]}
                onPress={handleCreateGif}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <ActivityIndicator color="#ffffff" />
                    <Text style={styles.primaryButtonText}>Creating GIF... {progress}%</Text>
                  </>
                ) : (
                  <>
                    <Settings2 size={24} color="#ffffff" />
                    <Text style={styles.primaryButtonText}>Create GIF</Text>
                  </>
                )}
              </TouchableOpacity>

              {!creating && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  {selectedId && (
                    <TouchableOpacity
                      style={[styles.clearButton, { backgroundColor: '#334155' }]}
                      onPress={() => {
                        handleTransformChange(selectedId, { scale: 1, translateX: 0, translateY: 0 });
                      }}
                    >
                      <Text style={[styles.clearButtonText, { color: '#f8fafc', marginLeft: 0 }]}>Reset Item</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.clearButton, { marginTop: 0 }]}
                    onPress={() => {
                      setItems([]);
                      setSelectedId(null);
                    }}
                  >
                    <Trash2 size={20} color="#ef4444" />
                    <Text style={styles.clearButtonText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  placeholderCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
  collageContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  grid1: {
    flex: 1,
  },
  grid2: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  grid3: {
    flex: 1,
    justifyContent: 'space-between',
  },
  grid3Top: {
    width: '100%',
    height: '49.5%',
  },
  grid3Bottom: {
    width: '100%',
    height: '49.5%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  grid4: {
    flex: 1,
    justifyContent: 'space-between',
  },
  gridRow: {
    width: '100%',
    height: '49.5%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemWrapper: {
    position: 'relative',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemWrapperSelected: {
    borderColor: '#38bdf8',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsContainer: {
    width: '100%',
    marginTop: 32,
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ec4899',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 100,
    width: '100%',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  maxItemsContainer: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 100,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    alignItems: 'center',
  },
  maxItemsText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  clearButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  primaryButton: {
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 20,
    gap: 12,
    width: '100%',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
