import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

  const closeMenu = useCallback(() => setOpen(false), []);
  const openMenu = useCallback(() => setOpen(true), []);
  const selectMode = useCallback((targetMode: LibrarySortMode) => {
    const steps = getCycleStepCount(mode, targetMode);
    for (let step = 0; step < steps; step += 1) onCycle();
    setOpen(false);
  }, [mode, onCycle]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sortierung auswählen"
        accessibilityValue={{ text: label }}
        onPress={openMenu}
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
      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sortierung schließen"
          onPress={closeMenu}
          style={styles.backdrop}
          testID="library-sort-menu-backdrop"
        >
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
            <Text style={[styles.menuTitle, { color: theme.palette.text.primary }]}>Sortierung</Text>
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
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: staticTokens.spacing.md,
  },
  menu: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: staticTokens.radii.card,
    gap: staticTokens.spacing.sm,
    padding: staticTokens.spacing.md,
  },
  menuTitle: {
    fontFamily: staticTokens.fonts.heading,
    fontSize: 16,
    marginBottom: staticTokens.spacing.xs,
  },
  menuItem: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: staticTokens.borderRadius.pill,
    paddingHorizontal: staticTokens.spacing.md,
  },
  menuItemLabel: {
    fontFamily: staticTokens.fonts.body,
    fontSize: 14,
  },
});

export default LibrarySortControl;
