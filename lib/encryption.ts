import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

let cachedKey: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey

  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }

  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be 32 bytes (64 hex characters). Got ${key.length} bytes. ` +
      `Generate a valid key with: openssl rand -hex 32`
    )
  }

  cachedKey = key
  return key
}

const ALGORITHM = 'aes-256-gcm'

export interface EncryptedData {
  encryptedData: string
  iv: string
  authTag: string
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param text - Plain text to encrypt (e.g., Stripe access token)
 * @returns Object containing encrypted data, IV, and auth tag
 */
export function encrypt(text: string): EncryptedData {
  try {
    const iv = randomBytes(16)
    const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    }
  } catch (error) {
    // ✅ Better error handling
    console.error('Encryption failed:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypts data encrypted with encrypt()
 * @param encryptedData - Encrypted string
 * @param iv - Initialization vector (hex string)
 * @param authTag - Authentication tag (hex string)
 * @returns Decrypted plain text
 */
export function decrypt(
  encryptedData: string,
  iv: string,
  authTag: string
): string {
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(iv, 'hex')
    )
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    // ✅ Better error handling for invalid auth tags
    console.error('Decryption failed:', error)
    throw new Error('Failed to decrypt data - data may be corrupted or key is invalid')
  }
}

/**
 * Utility to generate a new encryption key
 * Run this once and save to .env: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateKey(): string {
  return randomBytes(32).toString('hex')
}
