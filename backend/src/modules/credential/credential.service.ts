import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../../common/utils/encryption.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CredentialService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private auditService: AuditService,
  ) {}

  async create(data: any, userId: string) {
    const encryptedPassword = data.password ? this.encryptionService.encrypt(data.password) : null;
    const credential = await this.prisma.credential.create({
      data: {
        ...data,
        userId,
        password: encryptedPassword,
      },
    });

    await this.auditService.log(userId, 'CREATE_CREDENTIAL', 'Credential', credential.id);
    return this.maskCredential(credential);
  }

  async dbDebug() {
    return this.prisma.credential.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });
  }

  async findAll(userId: string, hasAccessToAll: boolean) {
    const where = hasAccessToAll ? {} : { userId };
    const credentials = await this.prisma.credential.findMany({ where });
    return credentials.map((c) => this.maskCredential(c));
  }

  async findAllTags() {
    const credentials = await this.prisma.credential.findMany({
      select: { tags: true },
    });
    const allTags = credentials.flatMap(c => c.tags);
    return [...new Set(allTags)]; // Return unique tags
  }

  async findOne(id: string, userId: string) {
    try {
      const credential = await this.prisma.credential.findUnique({ where: { id } });
      if (!credential) throw new NotFoundException('Credential not found');

      try {
        await this.auditService.log(userId, 'ACCESS_CREDENTIAL', 'Credential', id);
      } catch (auditError) {
        console.error('Failed to log audit:', auditError.message);
        // Continue even if audit fails to not block user access
      }

      return {
        ...credential,
        password: credential.password ? '••••••••••••••••••••••••' : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error(`Error in findOne for credential ${id}:`, error.message);
      throw error;
    }
  }

  async revealSecret(id: string, userId: string) {
    const credential = await this.prisma.credential.findUnique({ where: { id } });
    if (!credential) throw new NotFoundException('Credential not found');

    // Ownership check
    if (credential.userId !== userId) {
      throw new NotFoundException('Credential not found');
    }

    try {
      await this.auditService.log(userId, 'REVEAL_CREDENTIAL_SECRET', 'Credential', id);
    } catch (auditError) {
      console.error('Failed to log audit:', auditError.message);
    }

    return {
      ...credential,
      password: credential.password ? this.encryptionService.decrypt(credential.password) : null,
    };
  }

  async update(id: string, data: any, userId: string) {
    const existing = await this.prisma.credential.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Credential not found');

    const updateData = { ...data };
    if (data.password && data.password !== '****************') {
      updateData.password = this.encryptionService.encrypt(data.password);
    } else {
      delete updateData.password;
    }

    const credential = await this.prisma.credential.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log(userId, 'UPDATE_CREDENTIAL', 'Credential', id);
    return this.maskCredential(credential);
  }

  async delete(id: string, userId: string) {
    await this.prisma.credential.delete({ where: { id } });
    await this.auditService.log(userId, 'DELETE_CREDENTIAL', 'Credential', id);
    return { success: true };
  }

  private maskCredential(credential: any) {
    return {
      ...credential,
      password: credential.password ? '****************' : null,
    };
  }
}
