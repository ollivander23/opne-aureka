import { Module } from '@nestjs/common';
import { DatasetController } from './dataset.controller';
import { DatasetService } from './dataset.service';
import { StorageModule } from '../storage/storage.module';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [StorageModule, AnalysisModule],
  controllers: [DatasetController],
  providers: [DatasetService],
  exports: [DatasetService],
})
export class DatasetModule {}
