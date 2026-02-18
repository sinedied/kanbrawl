import { startServer } from '../../server/index.js';

type StartOptions = {
  stdio?: boolean;
};

export async function startAction(options: StartOptions): Promise<void> {
  await startServer({ stdio: options.stdio });
}
