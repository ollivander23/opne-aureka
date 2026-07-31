import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { configuration } from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { DatasetModule } from './modules/dataset/dataset.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { AgentModule } from './modules/agent/agent.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { ReportModule } from './modules/report/report.module';
import { StorageModule } from './modules/storage/storage.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    DatasetModule,
    ConversationModule,
    AgentModule,
    AnalysisModule,
    ReportModule,
    StorageModule,
    SettingsModule,
  ],
})
export class AppModule {}
