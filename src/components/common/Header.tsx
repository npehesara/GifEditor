import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '../../constants/colors';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  showBack = true,
  rightAction,
  style,
  backgroundColor = Colors.surface,
}) => {
  const insets = useSafeAreaInsets();
  // Ensure we are safely below the camera cutout / punch hole / status bar on all devices
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 24 : 0) + 8;

  return (
    <View style={[styles.wrapper, { backgroundColor, paddingTop: topPadding }, style]}>
      <View style={styles.content}>
        <View style={styles.sideContainer}>
          {showBack && onBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

        <View style={styles.centerContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={[styles.sideContainer, styles.rightContainer]}>
          {rightAction ? rightAction : <View style={styles.placeholder} />}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 50,
  },
  content: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  sideContainer: {
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 44,
    height: 44,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
    textAlign: 'center',
  },
});
