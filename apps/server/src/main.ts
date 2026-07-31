import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as net from 'net';
import { execSync } from 'child_process';
import { AppModule } from './app.module';

/**
 * Check whether a TCP port is free. If it is occupied, try to identify
 * the conflicting process so the developer gets an actionable message
 * instead of a silent crash (which otherwise surfaces as mysterious
 * 500 errors when a proxy forwards requests to the wrong server).
 */
function ensurePortAvailable(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once('error', (err: NodeJS.ErrnoException) => {
      tester.close();
      if (err.code === 'EADDRINUSE') {
        let hint = '';
        try {
          const pid = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim().split('\n')[0];
          if (pid) {
            const cmd = execSync(`ps -p ${pid} -o command=`, { encoding: 'utf8' }).trim();
            hint = `\n  → Port ${port} is used by PID ${pid}: ${cmd}`;
          }
        } catch {
          /* lsof/ps unavailable; skip process identification */
        }
        reject(new Error(
          `\n\n  ✖ Port ${port} is already in use.${hint}\n` +
          `  The server cannot start. Fix it by either:\n` +
          `    1) Stop the other process (e.g. kill ${'`PID`'}), or\n` +
          `    2) Use a different port: PORT=3100 pnpm dev\n` +
          `  (Remember to keep apps/web/vite.config.ts proxy target in sync.)\n`,
        ));
      } else {
        reject(err);
      }
    });
    tester.once('listening', () => {
      tester.close(() => resolve());
    });
    tester.listen(port);
  });
}

async function bootstrap() {
  const port = parseInt(process.env.PORT || '3000', 10);

  // Fail fast with a clear message if the port is taken
  await ensurePortAvailable(port);

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
  console.log(`Aureka server running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
