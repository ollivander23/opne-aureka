import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = this.config.get('storage.uploadDir') || './uploads';
    this.ensureDir(this.uploadDir);
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async saveFile(buffer: Buffer, fileName: string): Promise<string> {
    const filePath = path.join(this.uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  async deleteFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  getFilePath(fileName: string): string {
    return path.join(this.uploadDir, fileName);
  }
}
