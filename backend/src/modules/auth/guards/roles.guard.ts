import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { roles: { include: { role: true } } },
    });

    if (!userWithRoles) return false;

    const userRoles = userWithRoles.roles.map((ur) => ur.role.name.toUpperCase());
    
    // Expand required roles to support equivalent admin names case-insensitively
    const expandedRequiredRoles = requiredRoles.flatMap((role) => {
      const upperRole = role.toUpperCase();
      if (upperRole === 'ADMIN') {
        return ['ADMIN', 'SYSTEM ADMIN', 'SYSTEM_ADMIN', 'SUPERADMIN'];
      }
      return [upperRole];
    });

    return expandedRequiredRoles.some((role) => userRoles.includes(role));
  }
}
