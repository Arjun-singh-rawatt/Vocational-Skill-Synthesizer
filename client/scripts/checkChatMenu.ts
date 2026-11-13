import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateMenu } from '../src/lib/chatMenu';

async function main() {
  const path = resolve(process.cwd(), 'src/data/chatMenu.json');
  const menu = JSON.parse(await readFile(path, 'utf8'));
  const result = validateMenu(menu);
  if (result.errors.length) {
    for (const error of result.errors) {
      const option = error.optionId ? ` option "${error.optionId}"` : '';
      process.stderr.write(`${error.menuId}${option}: ${error.message}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`chatMenu.json OK (${result.questionCount} questions)\n`);
}

main().catch((error) => {
  process.stderr.write(`chatMenu.json: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
