import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownUp, Check } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { getLibrarySortModeLabel, LIBRARY_SORT_MODES, type LibrarySortMode } from '../utils/librarySort';

interface LibrarySortControlProps {
  mode: LibrarySortMode;
  onSelect: (mode: LibrarySortMode) => void;
}

const LibrarySortControl: React.FC<LibrarySortControlProps> = ({ mode, onSelect }) => {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const label = getLibrarySortModeLabel(mode);

  const closeMenu = useCallback(() => setOpen(false), []);
  const openMenu = useCallback(() => setOpen(true), []);
  const selectMode = useCallback((nextMode: LibrarySortMode) => {
    onSelect(nextMode);
    setOpen(false);
  }, [onSelect]);

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
      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu} testID="library-sort-menu">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sortierung schließen"
          onPress={closeMenu}
          style={styles.backdrop}
          testID="library-sort-menu-backdrop"
        >
          <Pressable
            accessibilityRole="menu"
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
                  accessibilityRole="menuitem"
                  accessibilityLabel={`Nach ${getLibrarySortModeLabel(sortMode)} sortieren`}
                  accessibilityState={{ selected }}
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
          </Pressable>
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
