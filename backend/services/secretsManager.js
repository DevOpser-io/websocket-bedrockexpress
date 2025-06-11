// AWS Secrets Manager integration using AWS SDK v2
const AWS = require('aws-sdk');
const config = require('../config');

/**
 * Retrieve a secret from AWS Secrets Manager
 * 
 * @param {string} secretName - Name/ARN of the secret
 * @param {string} region - AWS region name
 * @param {string} secretType - Type of secret - 'plain_text' or 'json'
 * @returns {Promise<string|object>} - The secret value as either a string or object
 */
async function getSecret(secretName, region = config.aws.region, secretType = 'plain_text') {
  console.log(`Attempting to retrieve secret: ${secretName} from region: ${region}`);
  
  // Check if this is an email-related secret
  const isEmailSecret = secretName.includes('mail') || secretName.includes('smtp');
  
  try {
    // Create AWS Secrets Manager client with appropriate credentials
    let clientOptions = { region };
    
    // Only use cross-account role for non-email secrets if specified
    if (!isEmailSecret && process.env.CUSTOMER_CROSS_ACCOUNT_ROLE_ARN) {
      console.log(`Using cross-account role: ${process.env.CUSTOMER_CROSS_ACCOUNT_ROLE_ARN}`);
      clientOptions.credentials = new AWS.ChainableTemporaryCredentials({
        params: {
          RoleArn: process.env.CUSTOMER_CROSS_ACCOUNT_ROLE_ARN
        }
      });
    } else {
      console.log('Using default credentials chain');
    }
    
    const client = new AWS.SecretsManager(clientOptions);

    console.log('AWS Secrets Manager client created, retrieving secret...');
    const response = await client.getSecretValue({ SecretId: secretName }).promise();
    console.log(`Successfully retrieved secret: ${secretName}`);
    
    if (!response.SecretString) {
      throw new Error(`Secret ${secretName} has no value`);
    }
    
    const secret = response.SecretString;
    
    if (secretType.toLowerCase() === 'json') {
      try {
        return JSON.parse(secret);
      } catch (e) {
        console.error(`Failed to parse secret as JSON: ${e}`);
        throw e;
      }
    }
    
    return secret;
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}: ${error.message}`);
    
    // Provide fallback values for email-related secrets
    if (isEmailSecret) {
      const fallbacks = {
        'bedrockflask-mail-server-13jwl6gq': 'smtp.gmail.com',
        'bedrockflask-mail-port-13jwl6gq': '587',
        'bedrockflask-mail-tls-13jwl6gq': 'true',
        'bedrockflask-mail-sender-13jwl6gq': 'bedrock.express.ai@gmail.com',
        'bedrockflask-mail-password-13jwl6gq': 'app-password-here' // Replace with actual app password if available
      };
      
      if (fallbacks[secretName]) {
        console.log(`Using fallback value for email secret: ${secretName}`);
        return fallbacks[secretName];
      }
    }
    
    throw error;
  }
}

module.exports = {
  getSecret
};
