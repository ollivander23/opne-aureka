import { Controller, Post, Get, Param, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('generate')
  async generate(@Body() body: { conversationId: string; title?: string }) {
    return this.reportService.generate(body.conversationId, body.title);
  }

  @Get()
  async findAll() {
    return this.reportService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.reportService.findOne(id);
  }

  @Get(':id/export')
  async export(@Param('id') id: string, @Res() res: Response) {
    const { filename, content } = await this.reportService.export(id);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(content);
  }
}
