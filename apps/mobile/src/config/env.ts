/**
 * Single centralized place the mobile app reads its API base URL from - no
 * component/screen ever hardcodes a URL itself (mirrors
 * apps/web/src/config/env.ts's same role for the Web app).
 *
 * Expo inlines any `EXPO_PUBLIC_`-prefixed variable from `.env` (or
 * `.env.local`, etc.) *in this app's own directory* (apps/mobile/.env) at
 * bundle time - unlike Vite's `envDir`, Expo does not support pointing this
 * at the monorepo-root `.env` the API/Web apps share, so this app keeps its
 * own `.env` (see apps/mobile/.env.example). Never put secrets here: like
 * Vite's `VITE_` vars, anything `EXPO_PUBLIC_` ships inside the app bundle
 * and is readable by anyone who has the app.
 *
 * IMPORTANT - "localhost" does not mean the same host in every environment
 * this app runs in:
 *
 *   - Desktop/Expo Web (`npm run web`): the app runs in a real desktop
 *     browser on the same machine as the API, so `http://localhost:4000`
 *     (the default below) works exactly like it does for the Web app.
 *
 *   - Android emulator: the emulator is its own virtual machine with its
 *     own loopback interface - "localhost" inside the emulator means the
 *     emulator itself, never the host development machine. Android's
 *     emulator maps the special address `10.0.2.2` to the host machine's
 *     localhost, so set `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000` for
 *     this target (iOS Simulator, by contrast, shares the host's network
 *     directly and CAN use plain `localhost`).
 *
 *   - Physical phone (Expo Go or a dev build): the phone is a separate
 *     device on the network, not the development machine, so `localhost`
 *     and `10.0.2.2` both mean the phone itself and will never reach the
 *     API. Set `EXPO_PUBLIC_API_BASE_URL=http://<developer-lan-ip>:4000`
 *     using the development machine's LAN IP (e.g. `192.168.1.23`) and
 *     ensure the phone is on the same network/Wi-Fi and the API's port is
 *     reachable (Windows Firewall may need to allow inbound connections on
 *     that port for other devices to reach it).
 *
 * This is deliberately manual/explicit (set the right value in .env for
 * whichever target you're running against) rather than auto-detected - see
 * apps/mobile/README.md for the full walkthrough.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// Production safety: the Bearer token travels on every request, so a release
// bundle (where __DEV__ is false) must never be pointed at plain HTTP - this
// also catches a release build that forgot to set EXPO_PUBLIC_API_BASE_URL
// and would otherwise silently fall back to the localhost default above.
// Development, the Android emulator (10.0.2.2) and LAN testing keep using
// plain HTTP, since __DEV__ is true there.
if (!__DEV__ && !API_BASE_URL.toLowerCase().startsWith("https://")) {
  throw new Error("EXPO_PUBLIC_API_BASE_URL must be an https:// URL in a production build.");
}
