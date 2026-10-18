import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, Settings2 } from 'lucide-react-native';
import { decodeGifFromUri, DecodedGifInfo } from '../services/gif/decoder';
import { Header } from '../components/common/Header';

interface PreviewScreenProps {
  uri: string;
  onBack: () => void;
  onStartEditing: (info: DecodedGifInfo) => void;
}

export default function PreviewScreen({ uri, onBack, onStartEditing }: PreviewScreenProps) {
  const insets = useSafeAreaInsets();
  const [gifInfo, setGifInfo] = useState<DecodedGifInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function loadGifInfo() {
      try {
        setLoading(true);
        const info = await decodeGifFromUri(uri);
        if (mounted) {
          setGifInfo(info);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to parse GIF');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadGifInfo();
    return () => { mounted = false; };
  }, [uri]);

  return (
    <View style={styles.container}>
      <Header title="Preview" onBack={onBack} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Analyzing GIF...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : gifInfo ? (
          <>
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: gifInfo.uri }} 
                style={styles.image} 
                resizeMode="contain" 
              />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.filename}>{gifInfo.filename}</Text>
              
              <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Dimensions</Text>
                  <Text style={styles.statValue}>{gifInfo.width}x{gifInfo.height}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Frames</Text>
                  <Text style={styles.statValue}>{gifInfo.frameCount}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Duration</Text>
                  <Text style={styles.statValue}>{gifInfo.durationSeconds.toFixed(2)}s</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => onStartEditing(gifInfo)}
            >
              <Settings2 size={24} color="#ffffff" />
              <Text style={styles.primaryButtonText}>Start Editing</Text>
            </TouchableOpacity>
          </>
        ) : null}
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
  content: {
    padding: 20,
  },
  loadingContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  imageContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
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
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
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
  primaryButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 20,
    gap: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
