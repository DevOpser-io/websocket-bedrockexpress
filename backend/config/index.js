/**
 * Application configuration
 * Centralizes all configuration settings for easy management and reference
 */
const dotenv = require('dotenv');
const AWS = require('aws-sdk');

// Load environment variables from .env file
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

// Function to get a secret from AWS Secrets Manager
async function getSecret(secretName) {
  if (!secretName) return null;
  
  const region = process.env.REGION || 'us-east-1';
  const client = new AWS.SecretsManager({
    region: region
  });
  
  try {
    const data = await client.getSecretValue({ SecretId: secretName }).promise();
    if ('SecretString' in data) {
      return data.SecretString;
    }
    return null;
  } catch (err) {
    console.error(`Error retrieving secret ${secretName}:`, err);
    return null;
  }
}

// Initialize database config with default values
const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  username: process.env.POSTGRES_USER || 'devuser',
  password: process.env.POSTGRES_PASSWORD || 'password',
  name: process.env.POSTGRES_DB || 'devdb',
  logging: process.env.DATABASE_LOGGING === 'true',
  // Secret names for AWS Secrets Manager
  secretNames: {
    dbName: process.env.DB_NAME_SECRET_NAME,
    dbUser: process.env.DB_USER_SECRET_NAME,
    dbPassword: process.env.DB_PASSWORD_SECRET_NAME,
    dbHost: process.env.DB_HOST_SECRET_NAME,
    dbPort: process.env.DB_PORT_SECRET_NAME
  }
};

// Force development mode if we're running locally and not in a container
if (!process.env.KUBERNETES_SERVICE_HOST && process.env.NODE_ENV === 'production') {
  console.log('CONFIG: Detected local environment, forcing development mode');
  process.env.NODE_ENV = 'development';
}

// If in production, load secrets synchronously before exporting the config
if (process.env.NODE_ENV === 'production') {
  // We need to use a self-invoking async function to load secrets synchronously
  (async () => {
    try {
      console.log('Loading database credentials from AWS Secrets Manager...');
      
      // Get secrets from AWS Secrets Manager
      const dbNameSecret = await getSecret(dbConfig.secretNames.dbName);
      const dbUserSecret = await getSecret(dbConfig.secretNames.dbUser);
      const dbPasswordSecret = await getSecret(dbConfig.secretNames.dbPassword);
      const dbHostSecret = await getSecret(dbConfig.secretNames.dbHost);
      const dbPortSecret = await getSecret(dbConfig.secretNames.dbPort);
      
      // Update database config with values from secrets manager
      if (dbNameSecret) dbConfig.name = dbNameSecret;
      if (dbUserSecret) dbConfig.username = dbUserSecret;
      if (dbPasswordSecret) dbConfig.password = dbPasswordSecret;
      if (dbHostSecret) dbConfig.host = dbHostSecret;
      if (dbPortSecret) dbConfig.port = parseInt(dbPortSecret);
      
      console.log('Database credentials loaded successfully from AWS Secrets Manager');
    } catch (error) {
      console.error('Error loading database credentials from AWS Secrets Manager:', error);
    }
  })();
}

module.exports = {
  // Server settings
  port: process.env.PORT || 8000,
  host: process.env.HOST || 'localhost',
  env: process.env.NODE_ENV || 'development',
  debug: process.env.DEBUG === 'true',

  // AWS configuration
  aws: {
    region: process.env.REGION || 'us-east-1',
    customerCrossAccountRoleArn: process.env.CUSTOMER_CROSS_ACCOUNT_ROLE_ARN || ''
  },

  // Amazon Bedrock settings
  bedrock: {
    region: process.env.REGION || 'us-east-1',
    modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0', // Using the same model ID as failed_attempt
    maxTokens: parseInt(process.env.MAX_TOKENS || '2048'),
    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
  },

  // Chat settings
  chat: {
    systemPrompt: process.env.SYSTEM_PROMPT || `Write naturally, using formatting only when it genuinely enhances content clarity or readability.

Document Structure:
- Always use headers (# or ##) for titles of articles, essays, or documents
- Use subheaders (## or ###) for major sections in longer content

Technical Content:
- Use code blocks only for actual code, commands, or technical output
- Use inline code only for variables, commands, or technical terms

Lists and Emphasis:
- Use lists only for sequential steps or truly itemized content
- Use bold/italic only for genuine emphasis or standard writing conventions

Avoid excessive formatting in:
- Natural dialogue within stories
- Descriptive narrative passages
- Informal responses
- Conversational exchanges

Format titles and major sections with headers even in narrative content, but keep the rest of the narrative flowing naturally. When in doubt about other formatting, prefer plain text. Use appropriate Markdown syntax for:
- Code blocks (with language specification)
- Inline code
- Lists (ordered and unordered)
- Headers (use appropriate levels)
- Bold and italic text
- Links
- Blockquotes`,
    maxHistoryMessages: parseInt(process.env.MAX_HISTORY || '10'),
    chunkSize: parseInt(process.env.CHUNK_SIZE || '500'),
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379/0'
  },
  
  // PostgreSQL configuration
  database: dbConfig,

  // Session settings
  session: {
    secret: process.env.SESSION_SECRET || 'bedrock-express-default-secret',
    cookieName: process.env.NODE_ENV === 'production' ? '__Host-session' : 'bedrock-express.sid',
    cookie: {
      maxAge: parseInt(process.env.SESSION_MAX_AGE || (24 * 60 * 60 * 1000)), // 1 day default
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      path: process.env.NODE_ENV === 'production' ? '/' : undefined // Required for __Host- prefix
    },
    preferredUrlScheme: process.env.NODE_ENV === 'production' ? 'https' : 'http'
  },
  
  // Cache settings
  cache: {
    version: process.env.CACHE_VERSION || '1.0.0',
    ttl: parseInt(process.env.CACHE_TTL || '3600') // 1 hour in seconds
  },
  
  // Email configuration
  email: {
    server: process.env.MAIL_SERVER,
    port: process.env.MAIL_PORT,
    useTls: process.env.MAIL_USE_TLS,
    username: process.env.MAIL_USERNAME,
    passwordSecretName: process.env.MAIL_PASSWORD_SECRET_NAME,
    defaultSender: process.env.MAIL_DEFAULT_SENDER
  }
};
