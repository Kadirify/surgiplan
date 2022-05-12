import { Module } from '@nestjs/common';
import { BoardController } from '../board/board.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController, BoardController],
  providers: [ReportsService],
})
export class ReportsModule {}
