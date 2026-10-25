import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, type LucideIcon } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface SettingsGroupProps {
  id: string;
  title: string;
  summary: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}

/** Compact, one-tap setting categories that retain native accessibility. */
export const SettingsGroup = ({ id, title, summary, children, icon: Icon }: SettingsGroupProps) => {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: open ? 1 : 0, duration: reduceMotion ? 0 : 140, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [open, reduceMotion, progress]);
  return <View style={[styles.group, { borderColor: theme.palette.border, backgroundColor: theme.palette.surface }]}>
    <Pressable testID={`settings-group-${id}`} accessibilityRole="button"
      accessibilityLabel={title} accessibilityState={{ expanded: open }}
      onPress={() => setOpen(previous => !previous)}
      style={styles.header}>
      {Icon ? <Icon size={20} color={theme.palette.primary} accessibilityElementsHidden importantForAccessibility="no" /> : null}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.palette.text.primary }]}>{title}</Text>
        <Text style={[styles.summary, { color: theme.palette.text.secondary }]} numberOfLines={open ? 2 : 1}>
          {summary}
        </Text>
      </View>
      <Animated.View style={{ transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
        <ChevronDown size={18} color={theme.palette.text.muted} />
      </Animated.View>
    </Pressable>
    {open ? <Animated.View style={[styles.content, { borderTopColor: theme.palette.border, opacity: reduceMotion ? 1 : progress }]}>{children}</Animated.View> : null}
  </View>;
};

const styles = StyleSheet.create({
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 16, fontWeight: '600' },
  summary: { fontSize: 12, lineHeight: 17 },
  content: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 12 },
});
