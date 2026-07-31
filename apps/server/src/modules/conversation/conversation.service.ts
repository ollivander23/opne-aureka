import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { AgentService } from '../agent/agent.service';

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments: string; // JSON serialized
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');

@Injectable()
export class ConversationService implements OnModuleInit {
  private readonly logger = new Logger(ConversationService.name);
  private db!: Database.Database;

  constructor(private readonly agentService: AgentService) {}

  onModuleInit() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.db = new Database(path.join(DATA_DIR, 'metadata.db'));
    this.db.pragma('journal_mode = WAL');
    this.initTables();
    this.logger.log('ConversationService SQLite initialized');
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Conversation',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        attachments TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    `);
  }

  async create() {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).run(id, 'New Conversation', now, now);
    return { id, title: 'New Conversation', createdAt: now };
  }

  async findAll() {
    return this.db.prepare(
      `SELECT c.id, c.title, c.created_at as createdAt, c.updated_at as updatedAt,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as messageCount
       FROM conversations c
       WHERE EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
       ORDER BY c.updated_at DESC`,
    ).all();
  }

  async getMessages(conversationId: string): Promise<StoredMessage[]> {
    const rows = this.db.prepare(
      'SELECT id, conversation_id as conversationId, role, content, attachments, created_at as createdAt FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    ).all(conversationId) as StoredMessage[];

    return rows.map((r) => ({
      ...r,
      attachments: r.attachments || '[]',
    }));
  }

  /** Save a message to the database. */
  saveMessage(msg: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    attachments?: unknown[];
  }): string {
    const id = uuidv4();
    const now = new Date().toISOString();

    // Derive a readable title from the first user question
    const deriveTitle = (text: string) => {
      const clean = text.trim().replace(/\s+/g, ' ');
      return clean.length > 30 ? `${clean.slice(0, 30)}…` : clean || 'New Conversation';
    };

    // Ensure conversation exists
    const existing = this.db.prepare('SELECT id, title FROM conversations WHERE id = ?').get(msg.conversationId) as
      | { id: string; title: string }
      | undefined;

    if (!existing) {
      const title = msg.role === 'user' ? deriveTitle(msg.content) : 'New Conversation';
      this.db.prepare(
        'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      ).run(msg.conversationId, title, now, now);
    } else if (msg.role === 'user' && existing.title === 'New Conversation') {
      // Upgrade the placeholder title once the first question arrives
      this.db.prepare('UPDATE conversations SET title = ? WHERE id = ?')
        .run(deriveTitle(msg.content), msg.conversationId);
    }

    this.db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, msg.conversationId, msg.role, msg.content, JSON.stringify(msg.attachments ?? []), now);

    // Update conversation timestamp
    this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, msg.conversationId);

    return id;
  }

  streamChat(sessionId: string, question: string): Observable<MessageEvent> {
    // Persist user message
    this.saveMessage({ conversationId: sessionId, role: 'user', content: question });

    // Run agent pipeline and collect assistant response
    const agent$ = this.agentService.run(question, sessionId);

    // Collect full response for persistence
    let fullContent = '';
    const attachments: unknown[] = [];

    return new Observable((subscriber) => {
      agent$.subscribe({
        next: (event) => {
          // Collect content for persistence
          if (event.type === 'token') {
            try {
              const data = JSON.parse(event.data);
              fullContent += data.content || '';
            } catch { /* ignore */ }
          } else if (event.type === 'sql' || event.type === 'table' || event.type === 'chart') {
            try {
              attachments.push({ type: event.type, data: JSON.parse(event.data) });
            } catch { /* ignore */ }
          }
          subscriber.next(event);
        },
        complete: () => {
          // Persist assistant response
          if (fullContent) {
            this.saveMessage({
              conversationId: sessionId,
              role: 'assistant',
              content: fullContent,
              attachments,
            });
          }
          subscriber.complete();
        },
        error: (err) => subscriber.error(err),
      });
    });
  }
}

interface MessageEvent {
  data: string;
  type?: string;
}
