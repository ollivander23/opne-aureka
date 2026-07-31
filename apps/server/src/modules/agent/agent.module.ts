import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { LlmService } from './llm.service';
import { AnalysisModule } from '../analysis/analysis.module';
import { DatasetModule } from '../dataset/dataset.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AnalysisModule, DatasetModule, SettingsModule],
  providers: [AgentService, LlmService],
  exports: [AgentService, LlmService],
})
export class AgentModule {}
