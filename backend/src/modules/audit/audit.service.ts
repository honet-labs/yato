import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContextService } from '../../common/context/audit-context.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private prisma: PrismaService,
    private auditContextService: AuditContextService,
  ) {}

  async log(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const context = this.auditContextService.getContext();
    const finalIp = ipAddress || context?.ipAddress || (metadata as any)?.ipAddress;
    const finalUA = userAgent || context?.userAgent || (metadata as any)?.userAgent;

    this.logger.log(`[Audit] User: ${userId || 'SYSTEM'} | Action: ${action} | Resource: ${resource} | ResourceId: ${resourceId || 'N/A'} | IP: ${finalIp || 'N/A'}`);

    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        metadata: metadata || {},
        ipAddress: finalIp,
        userAgent: finalUA,
      },
    });
  }

  async findAll(page: number = 1, limit: number = 20, startDate?: string, endDate?: string, search?: string) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ]
          }
        }
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
