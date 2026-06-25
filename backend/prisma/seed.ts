import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'System Administrator',
      permissions: ['*'],
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {
      permissions: [
        'VIEW_DASHBOARD',
        'VIEW_SUPPORT_TICKETS',
        'VIEW_VM_INVENTORY',
        'VIEW_SERVICE_INVENTORY',
        'VIEW_CREDENTIALS',
        'VIEW_ASSETS',
        'VIEW_AUDIT_LOGS',
        'VIEW_TASKS',
        'MANAGE_TASKS',
        'VIEW_FILES',
        'MANAGE_FILES',
        'read:vms',
        'create:vm_request',
        'VIEW_COMMUNITY'
      ]
    },
    create: {
      name: 'USER',
      description: 'Standard User',
      permissions: [
        'VIEW_DASHBOARD',
        'VIEW_SUPPORT_TICKETS',
        'VIEW_VM_INVENTORY',
        'VIEW_SERVICE_INVENTORY',
        'VIEW_CREDENTIALS',
        'VIEW_ASSETS',
        'VIEW_AUDIT_LOGS',
        'VIEW_TASKS',
        'MANAGE_TASKS',
        'VIEW_FILES',
        'MANAGE_FILES',
        'read:vms',
        'create:vm_request',
        'VIEW_COMMUNITY'
      ],
    },
  });

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@yato.local' },
    update: {
      password: hashedPassword,
      failedLoginAttempts: 0,
      lockoutUntil: null,
    },
    create: {
      email: 'admin@yato.local',
      password: hashedPassword,
      fullName: 'YATO Admin',
      roles: {
        create: {
          roleId: adminRole.id,
        },
      },
  });

  // Seed Database Credential Catalog Item
  const existingDbCredential = await prisma.catalog.findFirst({
    where: {
      category: 'SERVICE_TYPE',
      name: 'Database Credential',
    },
  });

  const dbCredentialData = {
    category: 'SERVICE_TYPE',
    name: 'Database Credential',
    value: 'Database Credential',
    description: 'Database Credential type with custom fields',
    isActive: true,
    metadata: {
      customFields: [
        { name: 'IP Address', type: 'number', isRequired: true },
        { name: 'Port', type: 'number', isRequired: true },
        { name: 'User', type: 'text', isRequired: true },
        { name: 'Password', type: 'password', isRequired: true },
        { name: 'Database Name', type: 'text', isRequired: false },
        { name: 'Schema/Table Name', type: 'text', isRequired: false },
        { name: 'Extra Notes', type: 'text', isRequired: false }
      ]
    }
  };

  if (existingDbCredential) {
    await prisma.catalog.update({
      where: { id: existingDbCredential.id },
      data: dbCredentialData,
    });
    console.log('Updated existing Database Credential catalog item');
  } else {
    await prisma.catalog.create({
      data: dbCredentialData,
    });
    console.log('Created Database Credential catalog item');
  }

  console.log({ adminUser, adminRole, userRole });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
