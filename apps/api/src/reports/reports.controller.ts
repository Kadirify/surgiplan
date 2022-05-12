import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@surgiplan/shared';
import { RequirePermissions } from '../common/auth-user';
import { ReportsService } from './reports.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @RequirePermissions(Permission.ReportsRead)
  overview(@Query('from') from: string, @Query('to') to: string) {
    this.validate(from, to);
    return this.reports.overview(from, to);
  }

  @Get('utilization.csv')
  @RequirePermissions(Permission.ReportsRead)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="salon-dolulugu.csv"')
  async utilizationCsv(@Query('from') from: string, @Query('to') to: string) {
    this.validate(from, to);
    const { utilization } = await this.reports.overview(from, to);
    const rows = utilization.map((u) => [u.code, u.name, u.usedMinutes, u.availableMinutes, (u.rate * 100).toFixed(1)]);
    const lines = [['Salon', 'Ad', 'Kullanılan (dk)', 'Kullanılabilir (dk)', 'Doluluk (%)'], ...rows];
    return '﻿' + lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  }

  private validate(from: string, to: string) {
    if (!DATE.test(from ?? '') || !DATE.test(to ?? '') || from > to) {
      throw new BadRequestException('Geçerli bir tarih aralığı girin (YYYY-AA-GG).');
    }
  }
}
