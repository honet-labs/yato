import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  async getStats(userId?: string) {
    const filter = userId ? { requestedBy: userId } : {};
    const inventoryFilter = userId ? { request: { requestedBy: userId } } : {};

    const [
      vmTotal, vmApproved, vmRejected, vmPending,
      svcTotal, svcApproved, svcRejected, svcPending,
      supportTotal,
      activeInstances, totalAssets
    ] = await Promise.all([
      this.prisma.vMRequest.count({ where: filter }),
      this.prisma.vMRequest.count({ where: { ...filter, status: 'APPROVED' } }),
      this.prisma.vMRequest.count({ where: { ...filter, status: 'REJECTED' } }),
      this.prisma.vMRequest.count({ where: { ...filter, status: 'PENDING' } }),
      this.prisma.serviceRequest.count({ where: filter }),
      this.prisma.serviceRequest.count({ where: { ...filter, status: 'APPROVED' } }),
      this.prisma.serviceRequest.count({ where: { ...filter, status: 'REJECTED' } }),
      this.prisma.serviceRequest.count({ where: { ...filter, status: 'PENDING' } }),
      this.prisma.supportTicket.count({ where: filter }),
      this.prisma.vMInventory.count({ where: inventoryFilter }),
      this.prisma.vMInventory.count({ where: inventoryFilter })
    ]);

    const activeServiceCount = await this.prisma.serviceInventory.count({ where: inventoryFilter });

    return {
      tickets: {
        total: vmTotal + svcTotal + supportTotal,
        approved: vmApproved + svcApproved,
        rejected: vmRejected + svcRejected,
        pending: vmPending + svcPending,
      },
      inventory: {
        activeInstances,
        totalAssets: activeInstances + activeServiceCount,
      }
    };
  }
}
