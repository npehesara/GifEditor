import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Dimensions, Animated, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image as ImageIcon, Video, Layers, Wand2, FileDown } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import { runSyntheticVideoTest } from '../../modules/gif-to-video';

interface HomeScreenProps {
  onImportGif: () => void;
  onGifToVideo?: () => void;
  onVideoToGif?: () => void;
  onGifCollage?: () => void;
}

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ onImportGif, onGifToVideo, onVideoToGif, onGifCollage }: HomeScreenProps) {
  // Animated values for background blobs
  const blob1Anim = useRef(new Animated.Value(0)).current;
  const blob2Anim = useRef(new Animated.Value(0)).current;

  // Animated values for hero frames
  const frame1Anim = useRef(new Animated.Value(0)).current;
  const frame2Anim = useRef(new Animated.Value(0)).current;
  const frame3Anim = useRef(new Animated.Value(0)).current;

  // Animated loop space symbol
  const orbitAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Background blobs slow float
    Animated.loop(
      Animated.sequence([
        Animated.timing(blob1Anim, { toValue: 1, duration: 15000, useNativeDriver: true }),
        Animated.timing(blob1Anim, { toValue: 0, duration: 15000, useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(blob2Anim, { toValue: 1, duration: 20000, useNativeDriver: true }),
        Animated.timing(blob2Anim, { toValue: 0, duration: 20000, useNativeDriver: true })
      ])
    ).start();

    // Hero frames subtle pulsing/floating
    const createFrameAnimation = (anim: Animated.Value, duration: number, delay: number) => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true })
          ])
        ).start();
      }, delay);
    };

    createFrameAnimation(frame1Anim, 4000, 0);
    createFrameAnimation(frame2Anim, 4500, 500);
    createFrameAnimation(frame3Anim, 5000, 1000);

    // Orbit rotation
    Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();

  }, []);

  // Interpolations
  const blob1TranslateY = blob1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100]
  });
  
  const blob2TranslateX = blob2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100]
  });

  const getFrameStyle = (anim: Animated.Value, baseRotate: string, offset: number) => {
    const rotate = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [baseRotate, `${parseFloat(baseRotate) + 3}deg`]
    });
    const translateY = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -5]
    });
    return {
      transform: [{ rotate }, { translateY }],
      top: offset,
      left: offset
    };
  };

  const orbitRotation = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.container}>
      {/* Animated Background */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.blob, styles.blob1, { transform: [{ translateY: blob1TranslateY }] }]} />
        <Animated.View style={[styles.blob, styles.blob2, { transform: [{ translateX: blob2TranslateX }] }]} />
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>GIF{"\n"}Editor</Text>
          <Text style={styles.headerSubtitle}>CREATE • EDIT • LOOP</Text>
        </View>

        {/* Artistic Hero Section */}
        <View style={styles.heroContainer}>
          <View style={styles.heroVisuals}>
            <Animated.View style={[styles.heroFrame, styles.heroFrame3, getFrameStyle(frame3Anim, '12deg', 20)]} />
            <Animated.View style={[styles.heroFrame, styles.heroFrame2, getFrameStyle(frame2Anim, '6deg', 10)]} />
            <Animated.View style={[styles.heroFrame, styles.heroFrame1, getFrameStyle(frame1Anim, '0deg', 0)]}>
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.2)', 'rgba(6, 182, 212, 0.2)']}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          
          <Pressable 
            style={({ pressed }) => [
              styles.importCta,
              pressed && { transform: [{ scale: 0.96 }] }
            ]}
            onPress={onImportGif}
          >
            <LinearGradient
              colors={['#8b5cf6', '#06b6d4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.importCtaGradient}
            >
              <FileDown size={28} color="#fff" style={styles.importIcon} />
              <View>
                <Text style={styles.importCtaText}>Import a GIF</Text>
                <Text style={styles.importCtaSub}>Turn every frame into your story.</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Quick Actions Menu */}
        <View style={styles.quickActionsContainer}>
          <View style={styles.quickActionsPill}>
            <Pressable 
              style={({ pressed }) => [styles.quickActionItem, pressed && { opacity: 0.7 }]}
              onPress={() => {
                if (onGifCollage) onGifCollage();
              }}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                <Wand2 size={22} color="#ec4899" />
              </View>
              <Text style={styles.quickActionText}>GIF Collage</Text>
            </Pressable>
            
            <View style={styles.quickActionDivider} />
            
            <Pressable 
              style={({ pressed }) => [styles.quickActionItem, pressed && { opacity: 0.7 }]}
              onPress={() => {
                if (onGifToVideo) onGifToVideo();
              }}
              onLongPress={async () => {
                try {
                  const testFile = new FileSystem.File(FileSystem.Paths.cache, 'test_synthetic.mp4');
                  const outUri = testFile.uri;
                  
                  await runSyntheticVideoTest(outUri);
                  
                  const exists = await testFile.exists;
                  Alert.alert('Native Encoder Test', `MP4 created at:\n${outUri}\nExists: ${exists}`);
                } catch (e: any) {
                  Alert.alert('Native Module Error', e.message);
                }
              }}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                <Video size={22} color="#06b6d4" />
              </View>
              <Text style={styles.quickActionText}>GIF → Video</Text>
            </Pressable>
            
            <View style={styles.quickActionDivider} />
            
            <Pressable 
              style={({ pressed }) => [styles.quickActionItem, pressed && { opacity: 0.7 }]}
              onPress={() => {
                if (onVideoToGif) onVideoToGif();
              }}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <ImageIcon size={22} color="#8b5cf6" />
              </View>
              <Text style={styles.quickActionText}>Video → GIF</Text>
            </Pressable>
          </View>
        </View>

        {/* Recent Projects (Artistic Empty State) */}
        <View style={styles.recentSection}>
          <View style={styles.loopSpaceContainer}>
            <View style={styles.loopSymbol}>
              <Layers size={32} color="rgba(255,255,255,0.3)" />
              <Animated.View style={[styles.loopOrbit, { transform: [{ rotate: orbitRotation }] }]} />
            </View>
            <Text style={styles.loopSpaceTitle}>LOOP SPACE</Text>
            <Text style={styles.loopSpaceText}>Your creations will{"\n"}appear here.</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  blob: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    opacity: 0.4,
  },
  blob1: {
    top: -width * 0.2,
    right: -width * 0.2,
    backgroundColor: '#8b5cf6', // Violet
  },
  blob2: {
    bottom: height * 0.2,
    left: -width * 0.3,
    backgroundColor: '#06b6d4', // Cyan
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 70 : 50,
    paddingBottom: 60,
  },
  header: {
    marginBottom: 40,
    alignItems: 'flex-start',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#06b6d4',
    letterSpacing: 4,
    fontWeight: '700',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 52,
    letterSpacing: -1,
  },
  heroContainer: {
    marginBottom: 50,
    alignItems: 'center',
  },
  heroVisuals: {
    width: 220,
    height: 180,
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFrame: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 24,
    borderWidth: 1,
  },
  heroFrame1: {
    borderColor: 'rgba(6, 182, 212, 0.8)',
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    zIndex: 3,
    overflow: 'hidden',
  },
  heroFrame2: {
    borderColor: 'rgba(139, 92, 246, 0.5)',
    backgroundColor: 'rgba(139, 92, 246, 0.02)',
    zIndex: 2,
  },
  heroFrame3: {
    borderColor: 'rgba(236, 72, 153, 0.3)',
    backgroundColor: 'rgba(236, 72, 153, 0.01)',
    zIndex: 1,
  },
  importCta: {
    width: '100%',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  importCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
  },
  importIcon: {
    marginRight: 16,
  },
  importCtaText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  importCtaSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  quickActionsContainer: {
    marginBottom: 50,
    alignItems: 'center',
  },
  quickActionsPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 40,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  quickActionItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignSelf: 'center',
    marginHorizontal: 8,
  },
  recentSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loopSpaceContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loopSymbol: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loopOrbit: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  loopSpaceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 3,
    marginBottom: 8,
  },
  loopSpaceText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  }
});
