import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { AnalysisService } from '../analysis/analysis.service';

export interface DatasetRecord {
  id: string;
  name: string;
  fileType: string;
  fileSize: number;
  rowCount: number;
  sheetCount: number;
  status: string;
  filePath: string;
  columns: { name: string; type: string }[];
  sheets: { id: string; name: string; rowCount: number; colCount: number }[];
  createdAt: string;
}

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const DATA_DIR = path.resolve(process.cwd(), 'data');

@Injectable()
export class DatasetService implements OnModuleInit {
  private readonly logger = new Logger(DatasetService.name);
  private db!: Database.Database;

  constructor(private readonly analysisService: AnalysisService) {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  onModuleInit() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.db = new Database(path.join(DATA_DIR, 'metadata.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        row_count INTEGER NOT NULL DEFAULT 0,
        sheet_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ready',
        file_path TEXT NOT NULL,
        columns TEXT NOT NULL DEFAULT '[]',
        sheets TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
    `);
    this.logger.log('DatasetService SQLite initialized');
  }

  async processUpload(file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    // Multer decodes Content-Disposition filename as latin1 by default,
    // which garbles non-ASCII names (e.g. Chinese). Re-decode as UTF-8.
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const id = uuidv4();
    const ext = originalName.split('.').pop()?.toLowerCase() || 'csv';
    const filePath = path.join(UPLOAD_DIR, `${id}.${ext}`);

    // Persist file to disk
    fs.writeFileSync(filePath, file.buffer);

    let columns: { name: string; type: string }[] = [];
    let rowCount = 0;
    let sheets: { id: string; name: string; rowCount: number; colCount: number }[] = [];

    try {
      if (ext === 'csv') {
        const result = this.parseCsv(file.buffer);
        columns = result.columns;
        rowCount = result.rowCount;
        sheets = [{ id: 'sheet_1', name: 'Sheet1', rowCount, colCount: columns.length }];
      } else if (ext === 'xlsx' || ext === 'xls') {
        const result = this.parseExcel(file.buffer);
        columns = result.columns;
        rowCount = result.rowCount;
        sheets = result.sheets;
      }
    } catch (err) {
      // Clean up file on parse failure
      fs.unlinkSync(filePath);
      throw new BadRequestException('Failed to parse file: ' + (err as Error).message);
    }

    const record: DatasetRecord = {
      id,
      name: originalName,
      fileType: ext,
      fileSize: file.size,
      rowCount,
      sheetCount: sheets.length,
      status: 'ready',
      filePath,
      columns,
      sheets,
      createdAt: new Date().toISOString(),
    };

    // Persist dataset metadata to SQLite (survives server restarts)
    this.db.prepare(
      `INSERT INTO datasets (id, name, file_type, file_size, row_count, sheet_count, status, file_path, columns, sheets, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.id,
      record.name,
      record.fileType,
      record.fileSize,
      record.rowCount,
      record.sheetCount,
      record.status,
      record.filePath,
      JSON.stringify(record.columns),
      JSON.stringify(record.sheets),
      record.createdAt,
    );

    // Import into DuckDB for SQL analysis (non-blocking)
    this.analysisService.importData(filePath, id).catch((err) => {
      this.logger.warn(`DuckDB import failed for dataset ${id}: ${(err as Error).message}`);
    });

    return {
      datasetId: id,
      name: record.name,
      fileType: record.fileType,
      fileSize: record.fileSize,
      rowCount: record.rowCount,
      sheetCount: record.sheetCount,
      status: record.status,
      columns: record.columns,
      sheets: record.sheets,
      createdAt: record.createdAt,
    };
  }

  async createEditableDataset(body: { name?: string; columns?: { name: string; type?: string }[]; rows?: unknown[][] }) {
    const id = uuidv4();
    const name = `${(body.name || '新建数据集').trim() || '新建数据集'}.csv`;
    const filePath = path.join(UPLOAD_DIR, `${id}.csv`);
    const columns = this.normalizeColumns(body.columns, body.rows);
    const rows = this.normalizeRows(body.rows ?? [], columns.length);

    this.writeCsvFile(filePath, columns.map((c) => c.name), rows);

    const inferredColumns = columns.map((c, idx) => ({
      name: c.name,
      type: c.type || this.inferColumnType(rows as string[][], idx),
    }));

    const record: DatasetRecord = {
      id,
      name,
      fileType: 'csv',
      fileSize: fs.statSync(filePath).size,
      rowCount: rows.length,
      sheetCount: 1,
      status: 'ready',
      filePath,
      columns: inferredColumns,
      sheets: [{ id: 'sheet_1', name: 'Sheet1', rowCount: rows.length, colCount: inferredColumns.length }],
      createdAt: new Date().toISOString(),
    };

    this.db.prepare(
      `INSERT INTO datasets (id, name, file_type, file_size, row_count, sheet_count, status, file_path, columns, sheets, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.id,
      record.name,
      record.fileType,
      record.fileSize,
      record.rowCount,
      record.sheetCount,
      record.status,
      record.filePath,
      JSON.stringify(record.columns),
      JSON.stringify(record.sheets),
      record.createdAt,
    );

    await this.analysisService.importData(filePath, id);
    return this.toResponse(record);
  }

  async updateEditableData(id: string, body: { columns: string[]; rows: unknown[][] }) {
    const dataset = await this.findOne(id);
    const columns = this.normalizeColumns(body.columns?.map((name) => ({ name })), body.rows);
    const rows = this.normalizeRows(body.rows ?? [], columns.length);

    this.writeCsvFile(dataset.filePath, columns.map((c) => c.name), rows);

    const inferredColumns = columns.map((c, idx) => ({
      name: c.name,
      type: this.inferColumnType(rows as string[][], idx),
    }));
    const sheets = [{ id: 'sheet_1', name: 'Sheet1', rowCount: rows.length, colCount: inferredColumns.length }];
    const fileSize = fs.statSync(dataset.filePath).size;

    this.db.prepare(
      `UPDATE datasets
       SET file_type = ?, file_size = ?, row_count = ?, sheet_count = ?, status = ?, columns = ?, sheets = ?
       WHERE id = ?`,
    ).run('csv', fileSize, rows.length, 1, 'ready', JSON.stringify(inferredColumns), JSON.stringify(sheets), id);

    await this.analysisService.importData(dataset.filePath, id);

    return this.toResponse({
      ...dataset,
      fileType: 'csv',
      fileSize,
      rowCount: rows.length,
      sheetCount: 1,
      status: 'ready',
      columns: inferredColumns,
      sheets,
    });
  }

  private parseCsv(buffer: Buffer) {
    const content = buffer.toString('utf-8');
    const records: string[][] = parse(content, {
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      throw new Error('CSV file is empty');
    }

    const headers = records[0];
    const dataRows = records.slice(1);
    const columns = headers.map((h, i) => ({
      name: h || `column_${i + 1}`,
      type: this.inferColumnType(dataRows, i),
    }));

    return { columns, rowCount: dataRows.length };
  }

  private parseExcel(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      throw new Error('Excel file has no sheets');
    }

    const sheets: { id: string; name: string; rowCount: number; colCount: number }[] = [];
    let columns: { name: string; type: string }[] = [];
    let totalRows = 0;

    for (let i = 0; i < sheetNames.length; i++) {
      const sheetName = sheetNames[i];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const dataRows = jsonData.length > 1 ? jsonData.slice(1) : [];
      const colCount = jsonData[0]?.length ?? 0;
      totalRows += dataRows.length;

      sheets.push({
        id: `sheet_${i + 1}`,
        name: sheetName,
        rowCount: dataRows.length,
        colCount,
      });

      // Use first sheet headers as primary columns
      // Array.from densifies sparse arrays (holes from empty/merged cells -> undefined)
      if (i === 0 && jsonData.length > 0) {
        columns = Array.from(jsonData[0] as any[]).map((h: any, idx: number) => ({
          name: String(h ?? `column_${idx + 1}`),
          type: this.inferColumnType(dataRows as string[][], idx),
        }));
      }
    }

    return { columns, rowCount: totalRows, sheets };
  }

  private inferColumnType(rows: string[][], colIndex: number): string {
    const sample = rows.slice(0, 100).map((r) => r[colIndex]).filter((v) => v !== '' && v != null);

    if (sample.length === 0) return 'string';

    const allNumeric = sample.every((v) => !isNaN(Number(v)));
    if (allNumeric) return 'number';

    const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/;
    const allDates = sample.every((v) => datePattern.test(String(v)));
    if (allDates) return 'date';

    const allBool = sample.every((v) => ['true', 'false', '0', '1'].includes(String(v).toLowerCase()));
    if (allBool) return 'boolean';

    return 'string';
  }

  private normalizeColumns(
    columns: { name?: string; type?: string }[] | undefined,
    rows: unknown[][] | undefined,
  ): { name: string; type?: string }[] {
    // Width is driven by the provided headers/rows. Only a brand-new dataset
    // with no columns at all falls back to a 3-column starter grid; padding an
    // EDITED dataset to a minimum width would inject ghost "column_N" headers.
    const dataCols = Math.max(
      columns?.length ?? 0,
      ...(rows ?? []).map((row) => Array.isArray(row) ? row.length : 0),
      0,
    );
    const maxCols = dataCols > 0 ? dataCols : 3;

    return Array.from({ length: maxCols }).map((_, idx) => {
      const rawName = columns?.[idx]?.name;
      return {
        name: String(rawName || `column_${idx + 1}`).trim() || `column_${idx + 1}`,
        type: columns?.[idx]?.type,
      };
    });
  }

  private normalizeRows(rows: unknown[][], colCount: number): string[][] {
    return rows
      .filter((row) => Array.isArray(row))
      .map((row) => Array.from({ length: colCount }).map((_, idx) => this.cellToString(row[idx])))
      .filter((row) => row.some((cell) => cell !== ''));
  }

  private cellToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      const cell = value as { v?: unknown; value?: unknown };
      const actual = cell.v ?? cell.value;
      return actual === null || actual === undefined ? '' : String(actual);
    }
    return String(value);
  }

  private writeCsvFile(filePath: string, columns: string[], rows: string[][]) {
    const escape = (value: string) => {
      const text = value ?? '';
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [columns.map(escape).join(','), ...rows.map((row) => columns.map((_, idx) => escape(row[idx] ?? '')).join(','))];
    fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf-8');
  }

  private toResponse(record: DatasetRecord) {
    return {
      datasetId: record.id,
      id: record.id,
      name: record.name,
      fileType: record.fileType,
      fileSize: record.fileSize,
      rowCount: record.rowCount,
      sheetCount: record.sheetCount,
      status: record.status,
      columns: record.columns,
      sheets: record.sheets,
      createdAt: record.createdAt,
    };
  }

  async findAll(): Promise<DatasetRecord[]> {
    const rows = this.db.prepare(
      'SELECT * FROM datasets ORDER BY created_at DESC',
    ).all() as any[];
    return rows.map((r) => this.toRecord(r));
  }

  async getSchema(id: string) {
    const dataset = await this.findOne(id);
    return dataset.columns;
  }

  async getPreview(id: string, page: number, pageSize: number) {
    const dataset = await this.findOne(id);

    try {
      const { columns, rows } = this.readDataRows(dataset, page, pageSize);
      return { columns, rows, total: dataset.rowCount, page, pageSize };
    } catch {
      return { columns: dataset.columns.map((c) => c.name), rows: [], total: 0, page, pageSize };
    }
  }

  /** Fetch a single dataset record by id, or throw if missing. */
  private async findOne(id: string): Promise<DatasetRecord> {
    const row = this.db.prepare('SELECT * FROM datasets WHERE id = ?').get(id) as any;
    if (!row) throw new NotFoundException('Dataset not found');
    return this.toRecord(row);
  }

  /** Map a raw SQLite row to a DatasetRecord (parse JSON columns). */
  private toRecord(row: any): DatasetRecord {
    return {
      id: row.id,
      name: row.name,
      fileType: row.file_type,
      fileSize: row.file_size,
      rowCount: row.row_count,
      sheetCount: row.sheet_count,
      status: row.status,
      filePath: row.file_path,
      columns: this.safeParse(row.columns, []),
      sheets: this.safeParse(row.sheets, []),
      createdAt: row.created_at,
    };
  }

  private safeParse<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private readDataRows(dataset: DatasetRecord, page: number, pageSize: number) {
    const start = (page - 1) * pageSize;

    if (dataset.fileType === 'csv') {
      const content = fs.readFileSync(dataset.filePath, 'utf-8');
      const records: string[][] = parse(content, { skip_empty_lines: true, trim: true });
      const headers = records[0];
      const dataRows = records.slice(1 + start, 1 + start + pageSize);
      return { columns: headers, rows: dataRows };
    }

    // Excel
    const buffer = fs.readFileSync(dataset.filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    // Array.from densifies sparse header arrays (holes -> undefined -> '')
    const headers = Array.from(jsonData[0] ?? []).map((h: any) => String(h ?? ''));
    const dataRows = jsonData.slice(1 + start, 1 + start + pageSize);
    return { columns: headers, rows: dataRows };
  }

  async remove(id: string) {
    const dataset = await this.findOne(id);

    if (fs.existsSync(dataset.filePath)) {
      fs.unlinkSync(dataset.filePath);
    }
    this.db.prepare('DELETE FROM datasets WHERE id = ?').run(id);
    return { success: true };
  }
}
