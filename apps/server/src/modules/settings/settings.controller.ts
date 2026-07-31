import { Body, Controller, Get, Put } from '@nestjs/common';
import { SettingsService, LlmSettings } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Put()
  updateSettings(@Body('llm') llm: Partial<LlmSettings>) {
    return this.settingsService.updateLlmSettings(llm ?? {});
  }
}
