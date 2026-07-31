import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DatasetService } from './dataset.service';

@Controller('datasets')
export class DatasetController {
  constructor(private readonly datasetService: DatasetService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.datasetService.processUpload(file);
  }

  @Post('blank')
  async createBlank(@Body() body: { name?: string; columns?: { name: string; type?: string }[]; rows?: unknown[][] }) {
    return this.datasetService.createEditableDataset(body);
  }

  @Put(':id/data')
  async updateData(@Param('id') id: string, @Body() body: { columns: string[]; rows: unknown[][] }) {
    return this.datasetService.updateEditableData(id, body);
  }

  @Get()
  async findAll() {
    return this.datasetService.findAll();
  }

  @Get(':id/schema')
  async getSchema(@Param('id') id: string) {
    return this.datasetService.getSchema(id);
  }

  @Get(':id/preview')
  async getPreview(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    return this.datasetService.getPreview(id, +page, +pageSize);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.datasetService.remove(id);
  }
}
