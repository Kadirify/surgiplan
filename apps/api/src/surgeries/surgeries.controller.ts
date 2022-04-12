import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@surgiplan/shared';
import { AuthUser, CurrentUser, RequirePermissions } from '../common/auth-user';
import {
  ChecklistUpdateDto,
  ConflictPreviewDto,
  CreateSurgeryDto,
  ListSurgeriesQuery,
  ScheduleDto,
  TransitionDto,
  UpdateSurgeryDto,
} from './surgeries.dto';
import { SurgeriesService } from './surgeries.service';

@ApiTags('surgeries')
@ApiBearerAuth()
@Controller('surgeries')
export class SurgeriesController {
  constructor(private readonly surgeries: SurgeriesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListSurgeriesQuery) {
    return this.surgeries.list(user, query);
  }

  @Get('estimate')
  estimate(@Query('procedureId', ParseUUIDPipe) procedureId: string, @Query('surgeonId') surgeonId?: string) {
    return this.surgeries.estimate(procedureId, surgeonId || undefined);
  }

  @Post('conflicts')
  @RequirePermissions(Permission.SurgeriesCreate)
  previewConflicts(@CurrentUser() user: AuthUser, @Body() dto: ConflictPreviewDto) {
    return this.surgeries.previewConflicts(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.surgeries.get(user, id);
  }

  @Post()
  @RequirePermissions(Permission.SurgeriesCreate)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSurgeryDto) {
    return this.surgeries.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SurgeriesCreate)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSurgeryDto) {
    return this.surgeries.update(user, id, dto);
  }

  @Post(':id/schedule')
  @RequirePermissions(Permission.SurgeriesSchedule)
  schedule(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ScheduleDto) {
    return this.surgeries.schedule(user, id, dto);
  }

  @Post(':id/transition')
  transition(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto) {
    return this.surgeries.transition(user, id, dto);
  }

  @Patch(':id/checklist/:key')
  @RequirePermissions(Permission.ChecklistUpdate)
  updateChecklist(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('key') key: string,
    @Body() dto: ChecklistUpdateDto,
  ) {
    return this.surgeries.updateChecklist(user, id, key, dto.checked);
  }
}
