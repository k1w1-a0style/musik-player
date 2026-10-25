import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';

interface SettingsGroupProps {
  id: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}

/** Compact, one-tap setting categories that retain native accessibility. */
export const SettingsGroup = ({ id, title, summary, children }: SettingsGroupProps) => {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  return <View style={[styles.group, { borderColor: theme.palette.border, backgroundColor: theme.palette.surface }]}>
    <Pressable testID={`settings-group-${id}`} accessibilityRole="button"
      accessibilityLabel={title} accessibilityState={{ expanded: open }}
      onPress={() => setOpen(previous => !previous)}
      style={styles.header}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.palette.text.primary }]}>{title}</Text>
        <Text style={[styles.summary, { color: theme.palette.text.secondary }]} numberOfLines={open ? 2 : 1}>
          {summary}
        </Text>
      </View>
      <ChevronDown size={20} color={open ? theme.palette.primary : theme.palette.text.muted}
        style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
    </Pressable>
    {open ? <View style={[styles.content, { borderTopColor: theme.palette.border }]}>{children}</View> : null}
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
