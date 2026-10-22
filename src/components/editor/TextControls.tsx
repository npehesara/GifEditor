import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Keyboard, Animated, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { BlurView } from 'expo-blur';
import { TextLayer } from '../../types/editor';
import { AlignLeft, AlignCenter, AlignRight, Type, Palette, TypeOutline as TypeOutline, Square, Droplet, LayoutTemplate, Trash2, X, Check } from 'lucide-react-native';
import { Colors } from '../../constants/colors';

interface TextControlsProps {
  layer: TextLayer;
  onChange: (layer: TextLayer) => void;
  onApply: () => void;
  onCancel: () => void;
  fonts: string[];
  insets: { bottom: number; top: number };
  onAddLayer?: () => void;
  canAddLayer?: boolean;
}

const COLORS = [
  '#ffffff', '#e4e4e7', '#a1a1aa', '#3f3f46', '#000000',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', 'transparent'
];

type Tab = 'text' | 'font' | 'color' | 'outline' | 'shadow' | 'bg';

export function TextControls({ layer, onChange, onApply, onCancel, fonts, insets, onAddLayer, canAddLayer }: TextControlsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [isKbVisible, setIsKbVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const kShow = Keyboard.addListener('keyboardDidShow', e => {
      setIsKbVisible(true);
      Animated.timing(translateY, {
        toValue: -e.endCoordinates.height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
    const kHide = Keyboard.addListener('keyboardDidHide', () => {
      setIsKbVisible(false);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
    return () => { kShow.remove(); kHide.remove(); }
  }, [translateY]);

  const update = (key: keyof TextLayer, value: any) => {
    onChange({ ...layer, [key]: value });
  };

  const renderColorSwatches = (key: 'color' | 'outlineColor' | 'shadowColor' | 'backgroundColor', alphaKey?: 'backgroundOpacity' | 'shadowOpacity') => (
    <View style={styles.colorGrid}>
      {COLORS.map(c => (
        <TouchableOpacity
          key={c}
          style={[styles.colorSwatch, { backgroundColor: c === 'transparent' ? Colors.surfaceLight : c }, layer[key] === c && styles.swatchActive]}
          onPress={() => {
            update(key, c);
            if (alphaKey && c !== 'transparent') update(alphaKey, 1);
            if (alphaKey && c === 'transparent') update(alphaKey, 0);
          }}
        >
          {c === 'transparent' && <Droplet size={16} color={Colors.textSecondary} />}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <>
      <Modal visible={isKbVisible} transparent={true} animationType="fade">
        <View style={StyleSheet.absoluteFill}>
          {Platform.OS === 'android' ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]} />
          ) : (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          )}

          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => Keyboard.dismiss()}>
            <View style={{ paddingTop: (insets?.top || 44) + 12, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.iconBtn}><X color="#fff" size={28} /></TouchableOpacity>
              <TouchableOpacity onPress={() => {
                     const aligns = ['left', 'center', 'right'];
                     const nextIdx = (aligns.indexOf(layer.textAlign) + 1) % 3;
                     update('textAlign', aligns[nextIdx]);
                  }} style={styles.iconBtn}>
                     {layer.textAlign === 'left' && <AlignLeft color="#fff" size={28} />}
                     {layer.textAlign === 'center' && <AlignCenter color="#fff" size={28} />}
                     {layer.textAlign === 'right' && <AlignRight color="#fff" size={28} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.iconBtn}><Check color="#fff" size={28} /></TouchableOpacity>
            </View>

            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
              <TextInput
                style={{
                  fontSize: 40,
                  color: layer.color || '#fff',
                  fontFamily: layer.fontFamily,
                  textAlign: layer.textAlign as any,
                  textShadowColor: layer.shadowEnabled ? layer.shadowColor : 'transparent',
                  textShadowOffset: { width: 1, height: 1 },
                  textShadowRadius: layer.shadowEnabled ? 5 : 0,
                }}
                value={layer.text}
                onChangeText={t => update('text', t)}
                placeholder="Enter your text"
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                autoFocus
              />
            </View>
          </TouchableOpacity>


        </View>
      </Modal>

      {!isKbVisible && (
        <Animated.View style={[
          styles.container,
          { paddingBottom: (insets?.bottom || 0) + 12 }
        ]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={{ padding: 4 }}><Text style={styles.headerBtn}>Cancel</Text></TouchableOpacity>
            <Text style={styles.title}>Edit Text</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {canAddLayer && onAddLayer && (
                <TouchableOpacity onPress={onAddLayer} style={{ padding: 4 }}>
                  <Text style={[styles.headerBtn, { color: Colors.secondaryLight, fontWeight: 'bold' }]}>+ Add</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onApply} style={{ padding: 4 }}><Text style={[styles.headerBtn, styles.applyBtn]}>Apply</Text></TouchableOpacity>
            </View>
          </View>

          <View style={styles.tabsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(['text', 'font', 'color', 'outline', 'shadow', 'bg'] as Tab[]).map(t => (
                <TouchableOpacity key={t} style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]} onPress={() => setActiveTab(t)}>
                  <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            {activeTab === 'text' && (
              <View style={styles.panel}>
                <TouchableOpacity onPress={() => { setActiveTab('text'); setIsKbVisible(true); }} style={styles.tapToEditText}>
                  <Text style={styles.tapToEditTextLabel}>Tap here to type...</Text>
                </TouchableOpacity>
                <View style={styles.alignRow}>
                  <TouchableOpacity onPress={() => update('textAlign', 'left')} style={[styles.alignBtn, layer.textAlign === 'left' && styles.alignActive]}>
                    <AlignLeft color={layer.textAlign === 'left' ? '#ffffff' : Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => update('textAlign', 'center')} style={[styles.alignBtn, layer.textAlign === 'center' && styles.alignActive]}>
                    <AlignCenter color={layer.textAlign === 'center' ? '#ffffff' : Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => update('textAlign', 'right')} style={[styles.alignBtn, layer.textAlign === 'right' && styles.alignActive]}>
                    <AlignRight color={layer.textAlign === 'right' ? '#ffffff' : Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'font' && (
              <View style={styles.panel}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {fonts.map(f => (
                    <TouchableOpacity key={f} style={[styles.fontBtn, layer.fontFamily === f && styles.fontBtnActive]} onPress={() => update('fontFamily', f)}>
                      <Text style={[{ fontFamily: f }, styles.fontText, layer.fontFamily === f && styles.fontTextActive]}>{f.replace(/_400Regular|_700Bold/g, '')}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.row}>
                  <Text style={styles.label}>Size: {Math.round(layer.fontSize)}</Text>
                  <TouchableOpacity style={styles.adjBtn} onPress={() => update('fontSize', Math.max(8, layer.fontSize - 4))}><Text style={styles.adjText}>-</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.adjBtn} onPress={() => update('fontSize', Math.min(200, layer.fontSize + 4))}><Text style={styles.adjText}>+</Text></TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'color' && (
              <View style={styles.panel}>
                <Text style={styles.label}>Text Color</Text>
                {renderColorSwatches('color')}
                <View style={styles.row}>
                  <Text style={styles.label}>Opacity: {Math.round(layer.opacity * 100)}%</Text>
                  <TouchableOpacity style={styles.adjBtn} onPress={() => update('opacity', Math.max(0, layer.opacity - 0.1))}><Text style={styles.adjText}>-</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.adjBtn} onPress={() => update('opacity', Math.min(1, layer.opacity + 0.1))}><Text style={styles.adjText}>+</Text></TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'outline' && (
              <View style={styles.panel}>
                <View style={styles.row}>
                  <Text style={styles.label}>Outline</Text>
                  <TouchableOpacity style={styles.toggleBtn} onPress={() => update('outlineEnabled', !layer.outlineEnabled)}>
                    <Text style={styles.toggleText}>{layer.outlineEnabled ? 'ON' : 'OFF'}</Text>
                  </TouchableOpacity>
                </View>
                {layer.outlineEnabled && (
                  <>
                    <Text style={styles.label}>Color</Text>
                    {renderColorSwatches('outlineColor')}
                    <View style={styles.row}>
                      <Text style={styles.label}>Width: {layer.outlineWidth}</Text>
                      <TouchableOpacity style={styles.adjBtn} onPress={() => update('outlineWidth', Math.max(1, layer.outlineWidth - 1))}><Text style={styles.adjText}>-</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.adjBtn} onPress={() => update('outlineWidth', Math.min(20, layer.outlineWidth + 1))}><Text style={styles.adjText}>+</Text></TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {activeTab === 'shadow' && (
              <View style={styles.panel}>
                <View style={styles.row}>
                  <Text style={styles.label}>Shadow</Text>
                  <TouchableOpacity style={styles.toggleBtn} onPress={() => update('shadowEnabled', !layer.shadowEnabled)}>
                    <Text style={styles.toggleText}>{layer.shadowEnabled ? 'ON' : 'OFF'}</Text>
                  </TouchableOpacity>
                </View>
                {layer.shadowEnabled && (
                  <>
                    <Text style={styles.label}>Color</Text>
                    {renderColorSwatches('shadowColor', 'shadowOpacity')}
                  </>
                )}
              </View>
            )}

            {activeTab === 'bg' && (
              <View style={styles.panel}>
                <View style={styles.row}>
                  <Text style={styles.label}>Background</Text>
                  <TouchableOpacity style={styles.toggleBtn} onPress={() => update('backgroundEnabled', !layer.backgroundEnabled)}>
                    <Text style={styles.toggleText}>{layer.backgroundEnabled ? 'ON' : 'OFF'}</Text>
                  </TouchableOpacity>
                </View>
                {layer.backgroundEnabled && (
                  <>
                    <Text style={styles.label}>Color</Text>
                    {renderColorSwatches('backgroundColor', 'backgroundOpacity')}
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { height: 308, backgroundColor: Colors.surface, borderTopWidth: 1, borderColor: Colors.border },
  tapToEditText: { backgroundColor: Colors.surfaceLight, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, alignItems: 'center' },
  tapToEditTextLabel: { color: Colors.textSecondary, fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  headerBtn: { color: Colors.textSecondary, fontSize: 16 },
  applyBtn: { color: Colors.secondaryLight, fontWeight: 'bold' },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surfaceLight, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontSize: 12, fontWeight: 'bold' },
  tabTextActive: { color: '#ffffff' },
  content: { flex: 1, paddingHorizontal: 16 },
  panel: { flex: 1 },
  alignRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  alignBtn: { padding: 12, borderRadius: 8, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  alignActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fontBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: Colors.surfaceLight, marginRight: 8, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center' },
  fontBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fontText: { color: Colors.textSecondary, fontSize: 16 },
  fontTextActive: { color: '#ffffff' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 16, justifyContent: 'space-between' },
  label: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  adjBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  adjText: { color: Colors.text, fontSize: 20, fontWeight: 'bold' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  swatchActive: { borderColor: Colors.secondaryLight },
  colorSwatchTyping: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  swatchTypingActive: { borderColor: Colors.secondaryLight },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.surfaceLight },
  toggleText: { color: Colors.secondaryLight, fontWeight: 'bold', fontSize: 12 },
  iconBtn: { padding: 8 },
});
