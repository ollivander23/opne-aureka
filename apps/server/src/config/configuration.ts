export function configuration() {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      url: process.env.DATABASE_URL || 'sqlite:./data/metadata.db',
    },
    cache: {
      store: process.env.CACHE_STORE || 'memory',
      url: process.env.CACHE_URL || 'sqlite:./data/cache.db',
    },
    storage: {
      driver: process.env.STORAGE_DRIVER || 'local',
      uploadDir: process.env.UPLOAD_DIR || './uploads',
    },
    duckdb: {
      database: process.env.DUCKDB_DATABASE || './data/analysis.duckdb',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    jitword: {
      // JitWord is the single source of truth for user credentials. Aureka
      // proxies login to this base URL and reuses the JWT it returns.
      baseUrl: process.env.JITWORD_BASE_URL || 'https://next.jitword.com',
    },
    llm: {
      provider: process.env.LLM_PROVIDER || 'deepseek',
      apiKey: process.env.LLM_API_KEY || '',
      baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
      model: process.env.LLM_MODEL || 'deepseek-chat',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.1'),
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096', 10),
    },
  };
}
