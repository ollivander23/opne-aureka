import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { AgentModule } from '../agent/agent.module';
import { ConversationModule } from '../conversation/conversation.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AgentModule, ConversationModule, SettingsModule],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
