import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Admin has all permissions (case-insensitive check)
    const isAdmin = user.roles?.some(ur => {
      const name = ur.role?.name?.toUpperCase();
      return name === 'ADMIN' || name === 'SYSTEM ADMIN' || name === 'SYSTEM_ADMIN' || name === 'SUPERADMIN';
    });
    if (isAdmin) return true;

    const userPermissions = user.roles?.reduce((acc, ur) => {
      return [...acc, ...(ur.role.permissions || [])];
    }, [] as string[]);

    if (userPermissions.includes('*')) {
      return true;
    }

    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }
}
