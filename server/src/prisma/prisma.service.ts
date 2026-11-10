import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
    // Integridad referencial: SQLite solo respeta las claves foráneas con esta opción activa.
    await this.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
