import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Save, Share, Edit3 } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Header } from '../components/common/Header';

export interface GifOutputInfo {
  uri: string;
  filename: string;
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
}

interface GifOutputScreenProps {
  info: GifOutputInfo;
  onBack: () => void;
  onDone: () => void;
  onEdit?: (uri: string) => void;
}

export default function GifOutputScreen({ info, onBack, onDone, onEdit }: GifOutputScreenProps) {
  const insets = useSafeAreaInsets();
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

  const handleSave = async () => {
    try {
      if (permissionResponse?.status !== 'granted') {
        const req = await requestPermission();
        if (req.status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant gallery access to save the GIF.');
          return;
        }
      }

      await MediaLibrary.Asset.create(info.uri);
      Alert.alert('Success', 'GIF saved to gallery!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleShare = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(info.uri);
      } else {
        Alert.alert('Not available', 'Sharing is not available on this device');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const fileSizeMB = (info.sizeBytes / (1024 * 1024)).toFixed(2);
  const durationSec = (info.durationMs / 1000).toFixed(1);

  return (
    <View style={styles.container}>
      <Header
        title="GIF Output"
        onBack={onBack}
        rightAction={
          <TouchableOpacity style={styles.doneButton} onPress={onDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: info.uri }}
            style={[styles.previewImage, { aspectRatio: info.width / info.height }]}
            resizeMode="contain"
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.filename}>{info.filename}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Resolution</Text>
              <Text style={styles.statValue}>{info.width}x{info.height}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{durationSec}s</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Size</Text>
              <Text style={styles.statValue}>{fileSizeMB} MB</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={handleSave}>
            <Save color="#fff" size={24} />
            <Text style={styles.primaryButtonText}>Save to Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={handleShare}>
            <Share color="#38bdf8" size={24} />
            <Text style={styles.secondaryButtonText}>Share</Text>
          </TouchableOpacity>

          {onEdit && (
            <TouchableOpacity style={[styles.actionButton, styles.secondaryButton, { borderColor: '#8b5cf6' }]} onPress={() => onEdit(info.uri)}>
              <Edit3 color="#a78bfa" size={24} />
              <Text style={[styles.secondaryButtonText, { color: '#a78bfa' }]}>Open in GIF Editor</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
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
  doneButton: {
    padding: 8,
    marginRight: -8,
  },
  doneButtonText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  previewContainer: {
    backgroundColor: '#000000',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  previewImage: {
    width: '100%',
    maxHeight: 400,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filename: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 24,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#8b5cf6',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  secondaryButtonText: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
