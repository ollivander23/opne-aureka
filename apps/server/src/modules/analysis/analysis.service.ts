import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as duckdb from 'duckdb-async';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
  executionTime: number;
}

/** SQL keywords that indicate write/destructive operations. */
const FORBIDDEN_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|ATTACH|DETACH|COPY|EXPORT|IMPORT|INSTALL|LOAD)\b/i;

const DATA_DIR = path.resolve(process.cwd(), 'data');

@Injectable()
export class AnalysisService implements OnModuleInit {
  private readonly logger = new Logger(AnalysisService.name);
  private db: duckdb.Database | null = null;

  async onModuleInit() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const dbPath = path.join(DATA_DIR, 'analysis.duckdb');
    this.db = await duckdb.Database.create(dbPath);
    this.logger.log(`DuckDB initialized at ${dbPath}`);
  }

  /**
   * Import a CSV or Excel file into DuckDB as a table.
   * Table name is sanitized from the dataset id.
   */
  async importData(filePath: string, tableName: string): Promise<void> {
    if (!this.db) throw new Error('DuckDB not initialized');

    const safeTable = this.sanitizeTableName(tableName);
    const ext = filePath.split('.').pop()?.toLowerCase();

    try {
      // Drop existing table if re-importing
      await this.db.exec(`DROP TABLE IF EXISTS "${safeTable}"`);

      if (ext === 'csv') {
        await this.importCsv(filePath, safeTable);
      } else if (ext === 'xlsx' || ext === 'xls') {
        await this.importExcel(filePath, safeTable);
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      const countResult = await this.db.all(`SELECT COUNT(*) as cnt FROM "${safeTable}"`);
      const rowCount = countResult[0]?.cnt ?? 0;
      this.logger.log(`Imported ${rowCount} rows into table "${safeTable}"`);
    } catch (err) {
      this.logger.error(`Failed to import data: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Execute a read-only SQL query against DuckDB.
   * Only SELECT statements are allowed.
   */
  async executeQuery(sql: string, datasetId: string): Promise<QueryResult> {
    if (!this.db) throw new Error('DuckDB not initialized');

    // Security: only allow SELECT queries
    const trimmed = sql.trim();
    if (!/^SELECT/i.test(trimmed)) {
      throw new BadRequestException('Only SELECT queries are allowed');
    }
    if (FORBIDDEN_SQL.test(trimmed.replace(/^SELECT/i, ''))) {
      throw new BadRequestException('Query contains forbidden operations');
    }

    const start = Date.now();
    try {
      const results = await this.db.all(trimmed);
      const executionTime = Date.now() - start;

      if (!results || results.length === 0) {
        return { columns: [], rows: [], executionTime };
      }

      const columns = Object.keys(results[0]);
      const rows = results.map((row: Record<string, unknown>) =>
        columns.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return null;
          if (typeof val === 'number') return val;
          return String(val);
        }),
      );

      return { columns, rows, executionTime };
    } catch (err) {
      const executionTime = Date.now() - start;
      this.logger.error(`SQL execution failed (${executionTime}ms): ${(err as Error).message}`);
      throw new BadRequestException(`SQL error: ${(err as Error).message}`);
    }
  }

  /**
   * Get the schema (column names + types) of an imported table.
   */
  async getTableSchema(tableName: string): Promise<{ name: string; type: string }[]> {
    if (!this.db) return [];
    const safeTable = this.sanitizeTableName(tableName);

    try {
      const info = await this.db.all(`DESCRIBE "${safeTable}"`);
      return info.map((row: Record<string, unknown>) => ({
        name: String(row.column_name),
        type: String(row.column_type),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get sample rows from a table for context building.
   */
  async getSampleRows(tableName: string, limit = 5): Promise<{ columns: string[]; rows: (string | number | null)[][] }> {
    if (!this.db) return { columns: [], rows: [] };
    const safeTable = this.sanitizeTableName(tableName);

    try {
      const results = await this.db.all(`SELECT * FROM "${safeTable}" LIMIT ${limit}`);
      if (!results || results.length === 0) return { columns: [], rows: [] };

      const columns = Object.keys(results[0]);
      const rows = results.map((row: Record<string, unknown>) =>
        columns.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return null;
          if (typeof val === 'number') return val;
          return String(val);
        }),
      );
      return { columns, rows };
    } catch {
      return { columns: [], rows: [] };
    }
  }

  /** List all tables currently in DuckDB. */
  async listTables(): Promise<string[]> {
    if (!this.db) return [];
    try {
      const results = await this.db.all(`SHOW TABLES`);
      return results.map((r: Record<string, unknown>) => String(r.name));
    } catch {
      return [];
    }
  }

  // ---- Private helpers ----

  private async importCsv(filePath: string, tableName: string): Promise<void> {
    if (!this.db) return;
    // Use DuckDB's native CSV reader for best performance
    const escapedPath = filePath.replace(/'/g, "''");
    await this.db.exec(
      `CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${escapedPath}', header=true, sample_size=-1)`,
    );
  }

  private async importExcel(filePath: string, tableName: string): Promise<void> {
    if (!this.db) return;

    // Parse Excel with xlsx lib, then insert via DuckDB VALUES
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (jsonData.length < 2) {
      throw new Error('Excel sheet has no data rows');
    }

    const headers = Array.from(jsonData[0] as any[]).map((h: any, i: number) =>
      this.sanitizeColumnName(String(h ?? `column_${i + 1}`)),
    );
    const dataRows = jsonData.slice(1);

    // Infer column types from first 100 rows
    const colTypes = headers.map((_, colIdx) => {
      const sample = dataRows.slice(0, 100).map((r) => r[colIdx]).filter((v) => v !== undefined && v !== null && v !== '');
      if (sample.length === 0) return 'VARCHAR';
      const allNumeric = sample.every((v) => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))));
      return allNumeric ? 'DOUBLE' : 'VARCHAR';
    });

    // Create table
    const colDefs = headers.map((h, i) => `"${h}" ${colTypes[i]}`).join(', ');
    await this.db.exec(`CREATE TABLE "${tableName}" (${colDefs})`);

    // Batch insert rows (1000 at a time)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const values = batch
        .map((row) => {
          const cells = headers.map((_, colIdx) => {
            const val = row[colIdx];
            if (val === undefined || val === null || val === '') return 'NULL';
            if (typeof val === 'number') return String(val);
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          return `(${cells.join(', ')})`;
        })
        .join(', ');

      await this.db.exec(`INSERT INTO "${tableName}" VALUES ${values}`);
    }
  }

  private sanitizeTableName(name: string): string {
    // Replace hyphens and special chars with underscores for safe SQL identifiers
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private sanitizeColumnName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_').replace(/^(\d)/, '_$1');
  }
}
