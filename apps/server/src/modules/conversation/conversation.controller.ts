import { Controller, Get, Post, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConversationService } from './conversation.service';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  async create() {
    return this.conversationService.create();
  }

  @Get()
  async findAll() {
    return this.conversationService.findAll();
  }

  @Get(':id/messages')
  async getMessages(@Param('id') id: string) {
    return this.conversationService.getMessages(id);
  }

  /**
   * SSE chat endpoint with manual response control.
   * We bypass NestJS's @Sse() decorator to guarantee each event is flushed
   * to the client immediately (no buffering), enabling true token-by-token
   * streaming in the browser.
   */
  @Get(':id/chat')
  chat(@Param('id') id: string, @Query('q') question: string, @Res() res: Response) {
    // SSE headers + disable all intermediate buffering
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    // Disable Nagle's algorithm so tiny token packets are sent immediately
    res.socket?.setNoDelay(true);
    res.socket?.setTimeout(0);

    // Initial comment to establish the stream
    res.write(':ok\n\n');

    const observable$ = this.conversationService.streamChat(id, question);

    const subscription = observable$.subscribe({
      next: (event) => {
        const type = (event as any).type ?? 'message';
        res.write(`event: ${type}\ndata: ${event.data}\n\n`);
        // Force-flush through any compression/proxy layers
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      },
      complete: () => {
        res.end();
      },
      error: () => {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Internal stream error' })}\n\n`);
        res.end();
      },
    });

    // Abort gracefully if the client disconnects mid-stream
    res.on('close', () => {
      subscription.unsubscribe();
    });
  }
}
