import { z } from "zod";

const envSchema = z.object({
  // AaveKit GraphQL
  AAVEKIT_GRAPHQL_URL: z.string().url().default("https://api.v3.aave.com/graphql"),

  // The Graph Gateway
  GRAPH_API_KEY: z.string().default(""),
  AAVE_SUBGRAPH_ID: z.string().default("Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g"),

  // Ethereum RPC
  ETH_RPC_URLS: z
    .string()
    .default("https://eth.drpc.org,https://eth.llamarpc.com,https://rpc.ankr.com/eth,https://ethereum-rpc.publicnode.com")
    .transform((val) => val.split(",").map((url) => url.trim())),

  // Cache configuration
  CACHE_TTL_LIVE: z.coerce.number().default(60),
  CACHE_TTL_SNAPSHOTS: z.coerce.number().default(21600),
  CACHE_MAX_SIZE: z.coerce.number().default(1000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Database (Supabase PostgreSQL)
  DATABASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // During build, use defaults
      if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "production") {
        console.warn("⚠️  Using default environment variables for build. Set proper values in production.");
        return envSchema.parse({});
      }
      console.error("❌ Invalid environment variables:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      throw new Error("Environment validation failed");
    }
    throw error;
  }
}

// Lazy initialization to avoid errors during build
let envCache: Env | null = null;

export function getEnv(): Env {
  if (!envCache) {
    envCache = validateEnv();
  }
  return envCache;
}

export const env = getEnv();
