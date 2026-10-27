import { migrate } from './database-tasks.js';
import { runTask } from './run-task.js';
await runTask(migrate);
