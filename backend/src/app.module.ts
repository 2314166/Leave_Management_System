import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AdminController, AuthController, AuthGuard, LeavesController } from './app.controllers';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'leave-secret-2026',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController, LeavesController, AdminController],
  providers: [PrismaService, AuthGuard],
})
export class AppModule {}