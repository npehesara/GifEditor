import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Film, Settings2 } from 'lucide-react-native';
import { decodeGifFromUri, DecodedGifInfo, compositeGifFrames } from '../services/gif/decoder';
import { Header } from '../components/common/Header';
import { Colors } from '../constants/colors';

interface GifToVideoScreenProps {
  uri: string;
  onBack: () => void;
  onConversionComplete?: (info: { uri: string; filename: string; width: number; height: number; durationMs: number; sizeBytes: number }) => void;
}

export default function GifToVideoScreen({ uri, onBack, onConversionComplete }: GifToVideoScreenProps) {
  const insets = useSafeAreaInsets();
  const [gifInfo, setGifInfo] = useState<DecodedGifInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [converting, setConverting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number>(0);

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
      <Header title="GIF → Video" onBack={onBack} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.secondaryLight} />
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
                style={[styles.primaryButton, { marginTop: 16 }, converting && { opacity: 0.5 }]}
                disabled={converting}
                onPress={async () => {
                  try {
                    setConverting(true);
                    setProgressText('Preparing...');
                    
                    // 1. Create output file URI
                    const timestamp = new Date().getTime();
                    const outFile = new (require('expo-file-system').File)(require('expo-file-system').Paths.cache, `gif_to_video_${timestamp}.mp4`);
                    const outUri = outFile.uri;
                    
                    // 2. Decode and composite GIF frames (in JS)
                    setProgressText('Decoding frames...');
                    // Use setTimeout to yield to the UI thread so 'Decoding frames...' is rendered
                    await new Promise(resolve => setTimeout(resolve, 50));
                    const frames = compositeGifFrames(gifInfo);
                    
                    if (frames.length === 0) throw new Error('No frames found in GIF');
                    
                    // 3. Ensure even dimensions
                    const outWidth = gifInfo.width % 2 !== 0 ? gifInfo.width + 1 : gifInfo.width;
                    const outHeight = gifInfo.height % 2 !== 0 ? gifInfo.height + 1 : gifInfo.height;
                    
                    // 4. Initialize native encoder
                    setProgressText('Initializing encoder...');
                    const GifToVideoModule = require('../../modules/gif-to-video').default;
                    await GifToVideoModule.initVideoEncoder(outWidth, outHeight, 30, 2000000, outUri);
                    
                    // 5. Encode frames
                    for (let i = 0; i < frames.length; i++) {
                      setProgressText(`Encoding frame ${i + 1}/${frames.length}...`);
                      await GifToVideoModule.encodeFrame(frames[i].data, frames[i].delayMs);
                    }
                    
                    // 6. Finish encoder
                    setProgressText('Finalizing video...');
                    await GifToVideoModule.finishVideoEncoder();
                    
                    // 7. Verify
                    const exists = outFile.exists;
                    if (!exists) throw new Error('Failed to create MP4 file.');
                    
                    if (onConversionComplete) {
                      onConversionComplete({
                        uri: outUri,
                        filename: `gif_to_video_${timestamp}.mp4`,
                        width: outWidth,
                        height: outHeight,
                        durationMs: gifInfo.durationMs,
                        sizeBytes: outFile.size ?? 0
                      });
                    }
                  } catch (e: any) {
                    Alert.alert('Conversion Error', e.message);
                  } finally {
                    setConverting(false);
                  }
                }}
              >
                {converting ? (
                  <>
                    <ActivityIndicator color="#ffffff" />
                    <Text style={styles.primaryButtonText}>{progressText}</Text>
                  </>
                ) : (
                  <>
                    <Film size={24} color="#ffffff" />
                    <Text style={styles.primaryButtonText}>Convert to MP4</Text>
                  </>
                )}
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 16,
  },
  imageContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filename: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
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
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
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
  successContainer: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 16,
  },
  successIconContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 16,
    borderRadius: 40,
    marginBottom: 16,
  },
  successTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  successText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  successActions: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
  },
});
