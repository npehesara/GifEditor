import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface SpeedControlsProps {
  currentSpeed: number;
  onSpeedSelect: (speed: number) => void;
  onApply: () => void;
  onCancel: () => void;
  insets: { bottom: number };
}

const SPEEDS: { value: number; label: string }[] = [
  { value: 0.25, label: '0.25×' },
  { value: 0.5, label: '0.5×' },
  { value: 0.75, label: '0.75×' },
  { value: 1, label: '1×' },
  { value: 1.25, label: '1.25×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
  { value: 4, label: '4×' },
];

export function SpeedControls({ currentSpeed, onSpeedSelect, onApply, onCancel, insets }: SpeedControlsProps) {
  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}><Text style={styles.headerBtn}>Cancel</Text></TouchableOpacity>
        <Text style={styles.title}>Speed</Text>
        <TouchableOpacity onPress={onApply}><Text style={[styles.headerBtn, styles.applyBtn]}>Apply</Text></TouchableOpacity>
      </View>

      <View style={styles.speedDisplay}>
        <Text style={styles.speedDisplayText}>{currentSpeed}×</Text>
      </View>

      <View style={styles.scrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {SPEEDS.map(s => (
            <TouchableOpacity
              key={s.value}
              style={[styles.btn, currentSpeed === s.value && styles.btnActive]}
              onPress={() => onSpeedSelect(s.value)}
            >
              <Text style={[styles.text, currentSpeed === s.value && styles.textActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', borderTopWidth: 1, borderColor: '#27272a', justifyContent: 'space-between', paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  headerBtn: { color: '#a1a1aa', fontSize: 16 },
  applyBtn: { color: '#06b6d4', fontWeight: 'bold' },
  speedDisplay: { alignItems: 'center', marginVertical: 12 },
  speedDisplayText: { color: '#f8fafc', fontSize: 24, fontWeight: 'bold' },
  scrollContainer: { height: 60, justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, gap: 12, alignItems: 'center' },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a' },
  btnActive: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
  text: { color: '#a1a1aa', fontSize: 14, fontWeight: '500' },
  textActive: { color: '#09090b', fontWeight: 'bold' },
});
