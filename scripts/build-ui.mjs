import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function buildUI() {
  console.log('Building UI assets...');

  // Build TS and CSS
  const result = await esbuild.build({
    entryPoints: [path.join(rootDir, 'src/audit/frontend/ui.ts')],
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    outdir: 'out', // Needed for write: false to return multiple files if needed
  });

  const jsFile = result.outputFiles.find(f => f.path.endsWith('.js'));
  if (!jsFile) {
    throw new Error('No JS output from esbuild');
  }
  const jsContent = jsFile.text;

  // We read the CSS directly and minify it using esbuild since it's just one file
  const cssRaw = fs.readFileSync(path.join(rootDir, 'src/audit/frontend/ui.css'), 'utf8');
  const cssResult = await esbuild.transform(cssRaw, {
    loader: 'css',
    minify: true,
  });
  const cssContent = cssResult.code;

  // Read HTML template
  const htmlTemplatePath = path.join(rootDir, 'src/audit/ui.html');
  const htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf8');

  // Inject CSS and JS
  const finalHtml = htmlTemplate
    .replace('/* CSS_INJECT */', cssContent)
    .replace('/* JS_INJECT */', jsContent);

  // Write out to uiHtml.ts
  const tsOutputPath = path.join(rootDir, 'src/audit/uiHtml.ts');
  const tsContent = `// Auto-generated fallback HTML string for dashboard UI
// DO NOT EDIT DIRECTLY. Edit src/audit/frontend files and run npm run build:ui
export const defaultDashboardHtml: string = ${JSON.stringify(finalHtml)};
`;

  fs.writeFileSync(tsOutputPath, tsContent);
  console.log('UI build complete. Wrote to src/audit/uiHtml.ts');
}

buildUI().catch((err) => {
  console.error(err);
  process.exit(1);
});
