const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const crypto = require('crypto');
const { getSyncedTime } = require('../utils/timeSync');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    passwordHash: DataTypes.STRING,
    name: DataTypes.STRING,
    isAdmin: { type: DataTypes.BOOLEAN, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    lastLogin: DataTypes.DATE,
    mfaSecret: DataTypes.STRING,
    mfaEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    hasAuthenticator: { type: DataTypes.BOOLEAN, defaultValue: false },
    isMfaSetupComplete: { type: DataTypes.BOOLEAN, defaultValue: false },
    emailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    emailVerificationToken: DataTypes.STRING,
    emailVerificationSentAt: DataTypes.DATE,
    backupCodesHash: DataTypes.JSON, // array of hashes
    preferredMfaMethod: { type: DataTypes.STRING, defaultValue: 'authenticator' },
    passwordResetToken: DataTypes.STRING,
    passwordResetSentAt: DataTypes.DATE,
    resetPasswordToken: DataTypes.STRING,
    resetPasswordExpires: DataTypes.DATE,
    subscriptionId: DataTypes.STRING
  });

  // Instance methods
  User.prototype.setPassword = async function(password) {
    this.passwordHash = await bcrypt.hash(password, 12);
  };

  User.prototype.checkPassword = async function(password) {
    return await bcrypt.compare(password, this.passwordHash || '');
  };

  User.prototype.verifyTotp = function(token) {
    if (!this.mfaSecret) return false;
    
    // Clean the token - remove spaces and ensure it's a string
    const cleanToken = token.toString().trim();
    
    // Get synchronized time in seconds (epoch)
    let epoch = getSyncedTime();
    
    // If for some reason that returns NaN, fallback to system time
    if (!Number.isInteger(epoch)) {
      console.warn('Bad epoch from NTP, falling back to system time');
      epoch = Math.floor(Date.now() / 1000);
    }
    
    // Following the DevOpser portal CICD approach:
    // 1. Use a window of 2 (±1 minute total) for verification
    // 2. Log the expected token for debugging
    
    // Generate the expected token for debugging
    const expectedToken = speakeasy.totp({
      secret: this.mfaSecret,
      encoding: 'base32',
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      time: epoch  // Use time parameter as in DevOpser portal
    });
    
    console.log(`Verifying TOTP at epoch=${epoch}`);
    console.log(`Expected TOTP: ${expectedToken}`);
    console.log(`Received token: ${cleanToken}`);
    
    // Verify with a window of 4 (±2 minutes) for 120 seconds expiration
    const verified = speakeasy.totp.verify({
      encoding: 'base32',
      secret: this.mfaSecret,
      token: cleanToken,
      window: 4,        // ±2 minutes tolerance (120 seconds expiration)
      time: epoch       // Use time parameter for consistent verification
    });
    
    console.log(`TOTP verification result: ${verified}`);
    
    return verified;
  };

  User.prototype.generateMfaSecret = function() {
    this.mfaSecret = speakeasy.generateSecret({ length: 20 }).base32;
    return this.mfaSecret;
  };

  User.prototype.generateBackupCodes = async function(count = 8) {
    const codes = Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex'));
    this.backupCodesHash = await Promise.all(codes.map(c => bcrypt.hash(c, 12)));
    return codes; // Plaintext codes to show user
  };

  User.prototype.verifyBackupCode = async function(code) {
    if (!Array.isArray(this.backupCodesHash)) return false;
    const idx = await Promise.all(this.backupCodesHash.map(h => bcrypt.compare(code, h)));
    const foundIdx = idx.findIndex(Boolean);
    if (foundIdx >= 0) {
      this.backupCodesHash.splice(foundIdx, 1);
      return true;
    }
    return false;
  };

  User.prototype.getMfaUri = function(issuer = 'Bedrock Express') {
    if (!this.mfaSecret) this.generateMfaSecret();
    
    // Generate a URI with all parameters explicitly specified
    // This ensures the authenticator app uses the exact same parameters
    // Create the otpauth URL manually to avoid automatic URL encoding
    const params = [
      `secret=${this.mfaSecret}`,
      `issuer=${issuer}`,
      'algorithm=SHA1',
      'digits=6',
      'period=30'
    ].join('&');
    
    return `otpauth://totp/${this.email}?${params}`;
  };

  return User;
};
