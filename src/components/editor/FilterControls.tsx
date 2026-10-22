import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, PanResponder } from 'react-native';
import { FilterConfig, FilterPresetId } from '../../types/editor';
import { FILTER_PRESETS, getPresetConfig } from '../../constants/filters';
import { Colors } from '../../constants/colors';

interface FilterControlsProps {
  currentConfig: FilterConfig;
  onChange: (config: FilterConfig) => void;
  onApply: () => void;
  onCancel: () => void;
  insets: { bottom: number };
}

type SliderKey = keyof Omit<FilterConfig, 'preset'>;

const SLIDERS: { key: SliderKey; label: string; min: number; max: number }[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'exposure', label: 'Exposure', min: -100, max: 100 },
  { key: 'temperature', label: 'Temperature', min: -100, max: 100 },
  { key: 'tint', label: 'Tint', min: -100, max: 100 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
  { key: 'fade', label: 'Fade', min: 0, max: 100 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100 },
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100 },
  { key: 'hue', label: 'Hue', min: -180, max: 180 },
];

function CustomSlider({ label, value, min, max, onChange }: { label: string, value: number, min: number, max: number, onChange: (v: number) => void }) {
  const [width, setWidth] = useState(0);

  // A more reliable slider gesture handling without relying on locationX alone:
  const handleMove = (dx: number, startVal: number) => {
    if (width === 0) return;
    const range = max - min;
    const deltaVal = (dx / width) * range;
    let newVal = startVal + deltaVal;
    newVal = Math.max(min, Math.min(max, Math.round(newVal)));
    onChange(newVal);
  };

  const panState = React.useRef({ startVal: 0 });
  const pan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panState.current.startVal = value;
      },
      onPanResponderMove: (evt, gestureState) => {
        handleMove(gestureState.dx, panState.current.startVal);
      },
    })
  ).current;

  const pct = width > 0 ? ((value - min) / (max - min)) * 100 : 50;

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.header}>
        <Text style={sliderStyles.label}>{label}</Text>
        <Text style={sliderStyles.value}>{value}</Text>
      </View>
      <View
        style={sliderStyles.trackContainer}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <View style={sliderStyles.trackBackground} />
        {/* Fill */}
        <View style={[sliderStyles.trackFill, { width: `${pct}%` }]} />
        {/* Center mark for -100 to 100 sliders */}
        {min < 0 && <View style={sliderStyles.centerMark} />}
        {/* Thumb */}
        <View style={[sliderStyles.thumb, { left: `${pct}%` }]} />
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: { marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  value: { color: Colors.textSecondary, fontSize: 14 },
  trackContainer: { height: 24, justifyContent: 'center', position: 'relative' },
  trackBackground: { height: 4, backgroundColor: Colors.border, borderRadius: 2, position: 'absolute', left: 0, right: 0 },
  trackFill: { height: 4, backgroundColor: Colors.secondary, borderRadius: 2, position: 'absolute', left: 0 },
  centerMark: { position: 'absolute', left: '50%', width: 2, height: 8, backgroundColor: Colors.textMuted, marginLeft: -1 },
  thumb: { position: 'absolute', width: 20, height: 20, backgroundColor: '#fff', borderRadius: 10, marginLeft: -10, elevation: 3, shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 3 },
});


export function FilterControls({ currentConfig, onChange, onApply, onCancel, insets }: FilterControlsProps) {

  const handlePresetSelect = (id: FilterPresetId) => {
    onChange(getPresetConfig(id));
  };

  const handleSliderChange = (key: SliderKey, value: number) => {
    // If we change a slider, should we keep the preset id or mark as custom?
    // According to instructions: "Preset label: Vintage • Custom" or "keep Vintage selected while showing changed slider values".
    // We'll just keep the preset string but update the value.
    onChange({ ...currentConfig, [key]: value });
  };

  const handleReset = () => {
    onChange(getPresetConfig('original'));
  };

  // Check if current is modified from preset
  const presetConfig = getPresetConfig(currentConfig.preset);
  const isModified = SLIDERS.some(s => currentConfig[s.key] !== presetConfig[s.key]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}><Text style={styles.headerBtn}>Cancel</Text></TouchableOpacity>
        <Text style={styles.title}>Filter</Text>
        <TouchableOpacity onPress={onApply}><Text style={[styles.headerBtn, styles.applyBtn]}>Apply</Text></TouchableOpacity>
      </View>

      <View style={styles.presetsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsScroll}>
          {FILTER_PRESETS.map(preset => {
            const isActive = currentConfig.preset === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[styles.presetBtn, isActive && styles.presetBtnActive]}
                onPress={() => handlePresetSelect(preset.id)}
              >
                <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
                  {preset.label} {isActive && isModified ? '• *' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.slidersContainer} contentContainerStyle={styles.slidersContent} showsVerticalScrollIndicator={true}>
        {SLIDERS.map(s => (
          <CustomSlider
            key={s.key}
            label={s.label}
            min={s.min}
            max={s.max}
            value={currentConfig[s.key]}
            onChange={(v) => handleSliderChange(s.key, v)}
          />
        ))}
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>Reset to Default</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, borderTopWidth: 1, borderColor: Colors.border, paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  title: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  headerBtn: { color: Colors.textSecondary, fontSize: 16 },
  applyBtn: { color: Colors.secondaryLight, fontWeight: 'bold' },
  presetsContainer: { height: 50, marginBottom: 12 },
  presetsScroll: { paddingHorizontal: 16, gap: 12, alignItems: 'center' },
  presetBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  presetBtnActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  presetText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  presetTextActive: { color: '#080912', fontWeight: 'bold' },
  slidersContainer: { flex: 1 },
  slidersContent: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 },
  resetBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: Colors.surfaceLight },
  resetBtnText: { color: Colors.textSecondary, fontWeight: 'bold' }
});

