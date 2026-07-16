import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../modules/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly algorithm = 'aes-256-gcm';
  private readonly legacyAlgorithm = 'aes-256-cbc';
  private readonly masterKey: Buffer;
  private readonly logger = new Logger(EncryptionService.name);

  private deksCache = new Map<string, Buffer>();
  private activeDekId: string | null = null;
  private isInitialized = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secretKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!secretKey) {
      this.logger.fatal('ENCRYPTION_KEY environment variable is not set. Application cannot start without it.');
      throw new Error('ENCRYPTION_KEY is required. Generate one with: openssl rand -hex 32');
    }

    if (secretKey.length < 32) {
      this.logger.fatal(`ENCRYPTION_KEY must be at least 32 characters. Current length: ${secretKey.length}`);
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long.');
    }

    this.masterKey = Buffer.from(secretKey.substring(0, 32));
  }

  async onModuleInit() {
    await this.initializeVault();
  }

  private async initializeVault() {
    if (this.isInitialized) return;

    try {
      let historySetting = null;
      try {
        historySetting = await this.prisma.systemSetting.findUnique({
          where: { key: 'VAULT_DEKS_HISTORY' },
        });
      } catch (dbError) {
        this.logger.warn(`Database not ready yet. Vault is running in standalone KEK fallback mode: ${dbError.message}`);
        this.activeDekId = 'legacy_kek';
        this.deksCache.set('legacy_kek', this.masterKey);
        this.isInitialized = true;
        return;
      }

      let history: { activeKeyId: string; keys: Array<{ id: string; cipherText: string; createdAt: string }> };

      if (!historySetting) {
        this.logger.log('Initializing Vault: Generating initial Data Encryption Key (DEK)...');
        
        const initialDek = crypto.randomBytes(32);
        const dekId = 'dek_v1';
        const encryptedDek = this.encryptWithKek(initialDek.toString('hex'));
        
        history = {
          activeKeyId: dekId,
          keys: [
            {
              id: dekId,
              cipherText: encryptedDek,
              createdAt: new Date().toISOString(),
            },
          ],
        };

        await this.prisma.systemSetting.create({
          data: {
            key: 'VAULT_DEKS_HISTORY',
            value: history as any,
          },
        });
      } else {
        history = historySetting.value as any;
      }

      this.activeDekId = history.activeKeyId;
      
      for (const k of history.keys) {
        try {
          const decryptedDekHex = this.decryptWithKek(k.cipherText);
          this.deksCache.set(k.id, Buffer.from(decryptedDekHex, 'hex'));
        } catch (err) {
          this.logger.error(`Failed to decrypt DEK ${k.id} using Master KEK: ${err.message}`);
        }
      }

      this.isInitialized = true;
      this.logger.log(`Vault initialized successfully. Active DEK: ${this.activeDekId}. Total keys loaded: ${this.deksCache.size}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Vault: ${error.message}`);
    }
  }

  private encryptWithKek(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decryptWithKek(text: string): string {
    const textParts = text.split(':');

    // Try GCM format first: iv:authTag:ciphertext (3+ parts)
    if (textParts.length >= 3) {
      try {
        const iv = Buffer.from(textParts[0], 'hex');
        const authTag = Buffer.from(textParts[1], 'hex');
        const encryptedText = Buffer.from(textParts.slice(2).join(':'), 'hex');
        const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
      } catch {
        // Fall through to legacy CBC
      }
    }

    // Legacy CBC format: iv:ciphertext (2 parts)
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts.slice(1).join(':'), 'hex');
    const decipher = crypto.createDecipheriv(this.legacyAlgorithm, this.masterKey, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  encrypt(text: string): string {
    const dekId = this.activeDekId || 'legacy_kek';
    const key = this.deksCache.get(dekId) || this.masterKey;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    if (dekId === 'legacy_kek') {
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
    }

    return `yv1:${dekId}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(text: string): string {
    if (!text) {
      this.logger.warn('Attempted to decrypt empty/null text');
      return null;
    }

    // If doesn't look like encrypted data, return as plaintext (old records)
    if (!text.startsWith('yv1:') && !/^[0-9a-f]+:/i.test(text)) {
      return text;
    }

    try {
      if (text.startsWith('yv1:')) {
        const parts = text.split(':');
        if (parts.length < 5) {
          this.logger.warn('Invalid Vault encryption format: missing parts');
          return null;
        }
        
        const dekId = parts[1];
        const ivHex = parts[2];
        const authTagHex = parts[3];
        const cipherHex = parts[4];

        const key = this.deksCache.get(dekId);
        if (!key) {
          this.logger.error(`DEK ${dekId} not found in key history cache. Decryption impossible.`);
          return null;
        }

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encryptedText = Buffer.from(cipherHex, 'hex');
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
      }

      // Legacy format support: iv:authTag:ciphertext (GCM) or iv:ciphertext (CBC)
      if (typeof text !== 'string' || !text.includes(':')) {
        this.logger.warn(`Invalid encryption format: ${typeof text}`);
        return null;
      }
      
      const textParts = text.split(':');
      if (textParts.length < 2) {
        this.logger.warn('Invalid encryption format: missing parts');
        return null;
      }

      // Try GCM format first (iv:authTag:ciphertext)
      if (textParts.length >= 3) {
        try {
          const iv = Buffer.from(textParts[0], 'hex');
          const authTag = Buffer.from(textParts[1], 'hex');
          const encryptedText = Buffer.from(textParts.slice(2).join(':'), 'hex');
          const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
          decipher.setAuthTag(authTag);
          let decrypted = decipher.update(encryptedText);
          decrypted = Buffer.concat([decrypted, decipher.final()]);
          return decrypted.toString();
        } catch {
          // Fall through to legacy CBC
        }
      }

      // Legacy CBC format (iv:ciphertext)
      const iv = Buffer.from(textParts.shift()!, 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv(this.legacyAlgorithm, this.masterKey, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      return null;
    }
  }

  async getVaultStatus() {
    await this.initializeVault();
    const credentialsCount = await this.prisma.credential.count();
    return {
      initialized: this.isInitialized,
      activeDekId: this.activeDekId,
      totalKeysInHistory: this.deksCache.size,
      totalCredentials: credentialsCount,
      keyIds: Array.from(this.deksCache.keys()),
    };
  }

  async rotateKey() {
    await this.initializeVault();
    this.logger.log('Starting Vault Key Rotation process...');
    
    const newDek = crypto.randomBytes(32);
    const newDekId = `dek_${crypto.randomUUID()}`;
    const encryptedNewDek = this.encryptWithKek(newDek.toString('hex'));

    let historySetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'VAULT_DEKS_HISTORY' },
    });

    let history: { activeKeyId: string; keys: Array<{ id: string; cipherText: string; createdAt: string }> };
    if (historySetting) {
      history = historySetting.value as any;
    } else {
      history = {
        activeKeyId: 'legacy_kek',
        keys: [],
      };
    }

    history.activeKeyId = newDekId;
    history.keys.push({
      id: newDekId,
      cipherText: encryptedNewDek,
      createdAt: new Date().toISOString(),
    });

    await this.prisma.systemSetting.upsert({
      where: { key: 'VAULT_DEKS_HISTORY' },
      update: { value: history as any },
      create: { key: 'VAULT_DEKS_HISTORY', value: history as any },
    });

    this.deksCache.set(newDekId, newDek);
    const previousDekId = this.activeDekId;
    this.activeDekId = newDekId;

    this.logger.log(`New active DEK registered: ${newDekId}. Starting re-encryption of credentials...`);

    const credentials = await this.prisma.credential.findMany();
    let reEncryptedCount = 0;
    let failedCount = 0;

    for (const cred of credentials) {
      try {
        const plainPassword = this.decrypt(cred.password);

        const reEncryptedPassword = this.encrypt(plainPassword);

        await this.prisma.credential.update({
          where: { id: cred.id },
          data: { password: reEncryptedPassword },
        });

        reEncryptedCount++;
      } catch (err) {
        failedCount++;
        this.logger.error(`Failed to re-encrypt credential ${cred.id}: ${err.message}`);
      }
    }

    this.logger.log(`Vault Key Rotation finished. Re-encrypted: ${reEncryptedCount}, Failed: ${failedCount}`);

    return {
      success: true,
      previousDekId,
      newDekId,
      reEncryptedCount,
      failedCount,
    };
  }
}
