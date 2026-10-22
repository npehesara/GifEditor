import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../constants/colors';

export type AspectRatioType = 'free' | 'original' | '1:1' | '4:5' | '16:9' | '9:16';

interface CropControlsProps {
  currentRatio: AspectRatioType;
  onRatioSelect: (ratio: AspectRatioType) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
  insets: { bottom: number };
}

const RATIOS: { id: AspectRatioType; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'original', label: 'Original' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
];

export function CropControls({ currentRatio, onRatioSelect, onApply, onCancel, onReset, insets }: CropControlsProps) {
  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}><Text style={styles.headerBtn}>Cancel</Text></TouchableOpacity>
        <Text style={styles.title}>Crop</Text>
        <TouchableOpacity onPress={onApply}><Text style={[styles.headerBtn, styles.applyBtn]}>Apply</Text></TouchableOpacity>
      </View>

      <View style={styles.ratioScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratioScroll}>
          {RATIOS.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.ratioBtn, currentRatio === r.id && styles.ratioBtnActive]}
              onPress={() => onRatioSelect(r.id)}
            >
              <Text style={[styles.ratioText, currentRatio === r.id && styles.ratioTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={onReset} style={styles.resetBtn}>
          <Text style={styles.resetText}>Reset Crop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, borderTopWidth: 1, borderColor: Colors.border, justifyContent: 'space-between', paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  title: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  headerBtn: { color: Colors.textSecondary, fontSize: 16 },
  applyBtn: { color: Colors.secondaryLight, fontWeight: 'bold' },
  ratioScrollContainer: { height: 60, justifyContent: 'center' },
  ratioScroll: { paddingHorizontal: 16, gap: 12, alignItems: 'center' },
  ratioBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border },
  ratioBtnActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  ratioText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  ratioTextActive: { color: '#080912', fontWeight: 'bold' },
  footer: { alignItems: 'center', paddingHorizontal: 16 },
  resetBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: Colors.surfaceLight },
  resetText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
});

