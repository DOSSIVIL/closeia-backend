import { Controller, Get, StreamableFile } from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';

const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('dashboard')
@Permissions('dashboard.read')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getSummary(@CurrentUser() actor: AuthenticatedUser) {
    return this.dashboard.getSummary(actor);
  }

  @Get('export')
  async export(@CurrentUser() actor: AuthenticatedUser): Promise<StreamableFile> {
    const workbook = await this.dashboard.exportExcel(actor);
    return new StreamableFile(workbook, {
      type: EXCEL_CONTENT_TYPE,
      disposition: 'attachment; filename="tableau-de-bord-closeia.xlsx"',
    });
  }
}
