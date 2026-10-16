import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const ENV_DIR = "../..";
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

export default defineConfig(({ mode }) => {
  // A production bundle bakes VITE_API_BASE_URL in at build time, so a
  // missing or insecure value must fail the build rather than ship a bundle
  // that silently talks to localhost (see src/config/env.ts's dev fallback).
  if (mode === "production") {
    const apiBaseUrl = loadEnv(mode, ENV_DIR, "VITE_").VITE_API_BASE_URL?.trim();
    if (!apiBaseUrl) {
      throw new Error("VITE_API_BASE_URL must be set for a production Web build (the public https:// URL of the API).");
    }
    let url: URL;
    try {
      url = new URL(apiBaseUrl);
    } catch {
      throw new Error("VITE_API_BASE_URL is not a valid URL.");
    }
    if (url.protocol !== "https:" && !LOCAL_HOSTNAMES.includes(url.hostname)) {
      throw new Error("VITE_API_BASE_URL must use https:// in a production Web build (plain http is only allowed for localhost smoke builds).");
    }
  }

  return {
    plugins: [react()],
    // The monorepo keeps a single .env at the repository root (see
    // tests/helpers/db.ts and apps/api's migrate scripts) - point Vite's env
    // loading there too instead of introducing a second .env file.
    envDir: ENV_DIR,
  };
});
