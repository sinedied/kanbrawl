import { startServer } from '../../server/index.js';

type StartOptions = {
  stdio?: boolean;
  port?: string;
};

export async function startAction(options: StartOptions): Promise<void> {
  await startServer({
    stdio: options.stdio,
    port: options.port ? Number.parseInt(options.port, 10) : undefined,
  });
}
