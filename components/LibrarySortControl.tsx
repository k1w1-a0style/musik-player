import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownUp, Check } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { getLibrarySortModeLabel, LIBRARY_SORT_MODES, type LibrarySortMode } from '../utils/librarySort';

interface LibrarySortControlProps {
  mode: LibrarySortMode;
  onCycle: () => void;
}

const getCycleStepCount = (currentMode: LibrarySortMode, targetMode: LibrarySortMode): number => {
  const currentIndex = LIBRARY_SORT_MODES.indexOf(currentMode);
  const targetIndex = LIBRARY_SORT_MODES.indexOf(targetMode);
  if (currentIndex < 0 || targetIndex < 0) return 0;
  return (targetIndex - currentIndex + LIBRARY_SORT_MODES.length) % LIBRARY_SORT_MODES.length;
};

const LibrarySortControl: React.FC<LibrarySortControlProps> = ({ mode, onCycle }) => {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const label = getLibrarySortModeLabel(mode);

  const toggleMenu = useCallback(() => setOpen(value => !value), []);
  const selectMode = useCallback((targetMode: LibrarySortMode) => {
    const steps = getCycleStepCount(mode, targetMode);
    for (let step = 0; step < steps; step += 1) onCycle();
    setOpen(false);
  }, [mode, onCycle]);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sortierung auswählen"
        accessibilityValue={{ text: label }}
        onPress={toggleMenu}
        style={({ pressed }) => [
          styles.control,
          { backgroundColor: theme.palette.surfaceGlass, borderColor: theme.palette.border },
          pressed && styles.pressed,
        ]}
        testID="library-sort-control"
      >
        <ArrowDownUp color={theme.palette.text.secondary} size={14} />
        <Text style={[styles.label, { color: theme.palette.text.secondary }]} testID="library-sort-control-label">
          {label}
        </Text>
      </Pressable>
      {open ? (
        <View
          style={[
            styles.menu,
            {
              backgroundColor: theme.palette.surfaceElevated,
              borderColor: theme.palette.border,
            },
          ]}
          testID="library-sort-menu-card"
        >
          {LIBRARY_SORT_MODES.map(sortMode => {
            const selected = sortMode === mode;
            return (
              <Pressable
                key={sortMode}
                accessibilityRole="button"
                accessibilityLabel={`Nach ${getLibrarySortModeLabel(sortMode)} sortieren`}
                accessibilityValue={{ text: selected ? 'Aktiv' : 'Nicht aktiv' }}
                onPress={() => selectMode(sortMode)}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    backgroundColor: selected ? theme.palette.primaryGlow : theme.palette.surface,
                    borderColor: selected ? theme.palette.primaryDark : theme.palette.border,
                  },
                  pressed && styles.pressed,
                ]}
                testID={`library-sort-option-${sortMode}`}
              >
                <Text style={[styles.menuItemLabel, { color: theme.palette.text.primary }]}>{getLibrarySortModeLabel(sortMode)}</Text>
                {selected ? <Check color={theme.palette.primary} size={16} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 3,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: staticTokens.borderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.72 },
  label: {
    fontFamily: staticTokens.fonts.body,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  menu: {
    position: 'absolute',
    top: 38,
    right: 0,
    minWidth: 180,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: staticTokens.radii.card,
    gap: staticTokens.spacing.xs,
    padding: staticTokens.spacing.sm,
  },
  menuItem: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: staticTokens.borderRadius.pill,
    paddingHorizontal: staticTokens.spacing.sm,
  },
  menuItemLabel: {
    fontFamily: staticTokens.fonts.body,
    fontSize: 13,
  },
});

export default LibrarySortControl;
