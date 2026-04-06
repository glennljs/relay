import { defineConfig, defineProject } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      defineProject({
        test: {
          name: "server",
          include: ["tests/server/**/*.test.ts"],
          environment: "node",
          globals: true,
          setupFiles: ["./tests/setup.ts"]
        }
      }),
      defineProject({
        test: {
          name: "client",
          include: ["tests/client/**/*.test.tsx"],
          environment: "jsdom",
          globals: true,
          setupFiles: ["./tests/setup.ts"]
        }
      })
    ]
  }
});
