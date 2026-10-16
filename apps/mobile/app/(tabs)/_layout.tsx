import { Tabs } from "expo-router";
import { SelectedWeekProvider } from "../../src/plan/SelectedWeekContext";

/**
 * The 7 product sections, tab-navigated - mirrors apps/web/src/components/
 * layout/Sidebar.tsx's NAV_ITEMS one-for-one so both platforms converge on
 * the same product shape. The whole group is only reachable while
 * authenticated - it sits inside <Stack.Protected> in app/_layout.tsx, the
 * mobile equivalent of apps/web/src/App.tsx's <ProtectedRoute>.
 *
 * No icons: Milestone 16 asks for simple styling, not a design system -
 * text labels alone are enough to verify navigation between all 7 screens.
 *
 * SelectedWeekProvider keeps Plan and Shopping on the same selected week.
 * tabBarButtonTestID values are the automation locators used by tests/mobile.
 */
export default function TabsLayout() {
  return (
    <SelectedWeekProvider>
      <Tabs screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarButtonTestID: "nav-dashboard" }} />
        <Tabs.Screen name="meals" options={{ title: "Meals", tabBarButtonTestID: "nav-meals" }} />
        <Tabs.Screen name="history" options={{ title: "History", tabBarButtonTestID: "nav-history" }} />
        <Tabs.Screen
          name="recommendations"
          options={{ title: "Recommendations", tabBarButtonTestID: "nav-recommendations" }}
        />
        <Tabs.Screen name="plan" options={{ title: "Plan", tabBarButtonTestID: "nav-plan" }} />
        <Tabs.Screen name="shopping" options={{ title: "Shopping", tabBarButtonTestID: "nav-shopping" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile", tabBarButtonTestID: "nav-profile" }} />
      </Tabs>
    </SelectedWeekProvider>
  );
}
