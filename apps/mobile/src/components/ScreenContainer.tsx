import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenContainerProps {
  /** Always rendered as a large heading - the primary way each screen proves navigation reached the right place. */
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Pass both to enable pull-to-refresh (see src/hooks/useFocusedData.ts). */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Root automation locator for the whole screen, e.g. "dashboard-screen". */
  testID?: string;
}

/**
 * Shared layout shell for every screen - one place for padding, safe-area
 * handling, the title/subtitle style and (optionally) pull-to-refresh,
 * instead of each screen repeating its own StyleSheet. Deliberately plain
 * (system font, a handful of colors, no theming).
 *
 * SafeAreaView comes from react-native-safe-area-context (the provider is
 * mounted by expo-router); react-native's own SafeAreaView is deprecated.
 * The bottom edge is left out: inside the tabs the tab bar already owns it.
 */
export function ScreenContainer({ title, subtitle, children, refreshing, onRefresh, testID }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea} testID={testID} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} /> : undefined}
      >
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {children && <View style={styles.body}>{children}</View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: "#555555",
  },
  body: {
    marginTop: 20,
    gap: 12,
  },
});
