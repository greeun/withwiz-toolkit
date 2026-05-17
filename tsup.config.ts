import { defineConfig } from "tsup";

// Compile all source files individually (no cross-file bundling)
// This preserves the subpath exports structure:
//   dist/auth/index.js, dist/cache/index.js, etc.
export default defineConfig({
  entry: [
    "src/initialize.ts",
    "src/core/**/*.ts",
    "!src/core/**/*.d.ts",
    "src/next/**/*.ts",
    "src/react/**/*.ts",
    "src/react/**/*.tsx",
    "src/prisma/**/*.ts",
  ],
  format: ["esm"],
  outExtension: () => ({ js: ".js" }),
  platform: "node",
  dts: false,
  splitting: true,
  clean: true,
  outDir: "dist",
  external: [
    "react",
    "react-dom",
    "next",
    "@prisma/client",
    "bcryptjs",
    "jose",
    "@upstash/redis",
    "@aws-sdk/client-s3",
    "winston",
    "winston-daily-rotate-file",
    "ioredis",
    "clsx",
    "tailwind-merge",
    "lucide-react",
    "sonner",
    "zod",
    "date-fns",
    "@radix-ui/react-select",
    "nodemailer",
  ],
});
