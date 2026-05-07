/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const SRC = 'D:/76east/prototype-screenShotApp/dexscreen-backend/src';
const DEST = 'D:/76east/deskscreentime_backend_api/src';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content.replace(/\r\n/g, '\n'), 'utf8');
}
function listFiles(dir, predicate, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, predicate, acc);
    else if (predicate(full)) acc.push(full);
  }
  return acc;
}

/**
 * Rewrite imports from Next.js / @dexscreen/backend to local path aliases.
 */
function rewriteImports(content) {
  return content
    .replace(/@dexscreen\/backend\/models\//g, '@models/')
    .replace(/@dexscreen\/backend\/database\/connect-db/g, '@database/connect-db')
    .replace(/@dexscreen\/backend\/helpers\//g, '@helpers/')
    .replace(/@dexscreen\/backend\/utils\/dateUtils/g, '@utils/dateUtils')
    .replace(/@dexscreen\/backend\/auth\/jwt/g, '@auth/jwt')
    .replace(/@dexscreen\/backend\/auth\/types/g, '@auth/types')
    .replace(/@dexscreen\/backend\//g, '@/');
}

/**
 * Migrate static foundations (models, helpers, utils, validation).
 */
function migrateFoundations() {
  // Models
  const modelDir = path.join(SRC, 'models');
  for (const file of fs.readdirSync(modelDir).filter((f) => f.endsWith('.ts'))) {
    const content = rewriteImports(read(path.join(modelDir, file)));
    write(path.join(DEST, 'models', file), content);
  }

  // Helpers (skip helpers.tsx duplicate; keep helpers.ts)
  const helperDir = path.join(SRC, 'helpers');
  for (const file of fs.readdirSync(helperDir).filter((f) => f.endsWith('.ts'))) {
    const content = rewriteImports(read(path.join(helperDir, file)));
    write(path.join(DEST, 'helpers', file), content);
  }

  // Utils
  const utilsDir = path.join(SRC, 'utils');
  for (const file of fs.readdirSync(utilsDir).filter((f) => f.endsWith('.ts'))) {
    const content = rewriteImports(read(path.join(utilsDir, file)));
    write(path.join(DEST, 'utils', file), content);
  }

  // Validation
  write(
    path.join(DEST, 'validation', 'index.ts'),
    rewriteImports(read(path.join(SRC, 'validation', 'index.ts')))
  );
}

/**
 * Find matching closing brace for a `{` at openIndex.
 */
function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let inString = null;
  let inTemplate = false;
  let inSingleComment = false;
  let inMultiComment = false;

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    const prev = source[i - 1];

    if (inSingleComment) {
      if (ch === '\n') inSingleComment = false;
      continue;
    }
    if (inMultiComment) {
      if (ch === '*' && next === '/') {
        inMultiComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '`') inTemplate = false;
      continue;
    }

    if (ch === '/' && next === '/') {
      inSingleComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inMultiComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Convert NextResponse.json(...) calls inside a body string to Express res calls.
 * Handles both `return NextResponse.json(...)` and bare `NextResponse.json(...)`.
 */
function convertNextResponseCalls(body) {
  let out = '';
  let i = 0;
  const len = body.length;

  const matchAt = (idx, str) => body.startsWith(str, idx);

  while (i < len) {
    const startIdx = body.indexOf('NextResponse.json(', i);
    if (startIdx === -1) {
      out += body.slice(i);
      break;
    }

    // Determine if preceded by `return ` (with optional whitespace).
    let returnStart = -1;
    let r = startIdx - 1;
    while (r >= 0 && /\s/.test(body[r])) r--;
    if (r >= 5 && body.slice(r - 5, r + 1) === 'return') {
      returnStart = r - 5;
    }

    const segmentEnd = returnStart >= 0 ? returnStart : startIdx;
    out += body.slice(i, segmentEnd);

    // Walk parens to find matching close
    const openParen = startIdx + 'NextResponse.json'.length;
    let depth = 0;
    let inString = null;
    let inTemplate = false;
    let argEnd = -1;
    for (let k = openParen; k < len; k++) {
      const ch = body[k];
      const nxt = body[k + 1];
      if (inString) {
        if (ch === '\\') {
          k++;
          continue;
        }
        if (ch === inString) inString = null;
        continue;
      }
      if (inTemplate) {
        if (ch === '\\') {
          k++;
          continue;
        }
        if (ch === '`') inTemplate = false;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = ch;
        continue;
      }
      if (ch === '`') {
        inTemplate = true;
        continue;
      }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          argEnd = k;
          break;
        }
      }
    }
    if (argEnd === -1) {
      out += body.slice(segmentEnd);
      break;
    }

    const argsRaw = body.slice(openParen + 1, argEnd).trim();

    // Split args at top-level comma (depth 0)
    let payloadArg = argsRaw;
    let optionsArg = '';
    {
      let depthSplit = 0;
      let inStr = null;
      let inTpl = false;
      let inB = 0;
      let splitIdx = -1;
      for (let k = 0; k < argsRaw.length; k++) {
        const ch = argsRaw[k];
        if (inStr) {
          if (ch === '\\') {
            k++;
            continue;
          }
          if (ch === inStr) inStr = null;
          continue;
        }
        if (inTpl) {
          if (ch === '\\') {
            k++;
            continue;
          }
          if (ch === '`') inTpl = false;
          continue;
        }
        if (ch === '"' || ch === "'") {
          inStr = ch;
          continue;
        }
        if (ch === '`') {
          inTpl = true;
          continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') depthSplit++;
        else if (ch === ')' || ch === ']' || ch === '}') depthSplit--;
        if (ch === ',' && depthSplit === 0) {
          splitIdx = k;
          break;
        }
      }
      if (splitIdx !== -1) {
        payloadArg = argsRaw.slice(0, splitIdx).trim();
        optionsArg = argsRaw.slice(splitIdx + 1).trim();
      }
    }

    let statusExpr = '200';
    if (optionsArg) {
      const m = optionsArg.match(/status\s*:\s*([^,}\s][^,}]*)/);
      if (m) statusExpr = m[1].trim();
    }

    const hasReturn = returnStart >= 0;
    const replacement = `${hasReturn ? 'return ' : ''}res.status(${statusExpr}).json(${payloadArg})`;
    out += replacement;
    i = argEnd + 1;
  }

  return out;
}

/**
 * Convert a single Next.js style controller into an Express controller.
 */
function convertController(source) {
  let content = rewriteImports(source);

  // Drop Next/NextAuth imports (any form on a single line).
  content = content
    .replace(/^\s*import[^\n]*from\s+['"]next\/server['"];?\s*\n/gm, '')
    .replace(/^\s*import[^\n]*from\s+['"]next-auth\/jwt['"];?\s*\n/gm, '')
    .replace(/^\s*import[^\n]*from\s+['"]next-auth\/react['"];?\s*\n/gm, '');

  // Drop Next.js-only route segment exports.
  content = content
    .replace(/^\s*export\s+const\s+dynamic\s*=\s*['"][^'"]+['"];?\s*\n/gm, '')
    .replace(/^\s*export\s+const\s+revalidate\s*=\s*[^;\n]+;?\s*\n/gm, '')
    .replace(/^\s*export\s+const\s+runtime\s*=\s*['"][^'"]+['"];?\s*\n/gm, '');

  // Replace NextRequest type usages.
  content = content.replace(/NextRequest/g, 'Request');

  // Replace request body and headers patterns.
  content = content.replace(/await\s+req\.json\(\)/g, 'req.body');
  content = content.replace(
    /new\s+URL\s*\(\s*req\.url\s*\)\.searchParams\.get\(\s*(['"][^'"\\]+['"])\s*\)/g,
    '(req.query[$1] as string | undefined)'
  );
  // Fallback for `const url = new URL(req.url)` / `const { searchParams } = new URL(req.url)`.
  content = content.replace(
    /new\s+URL\s*\(\s*req\.url\s*\)/g,
    "new URL(req.originalUrl, `http://${req.get('host') || 'localhost'}`)"
  );
  content = content.replace(
    /req\.nextUrl\.searchParams\.get\(\s*(['"][^'"\\]+['"])\s*\)/g,
    '(req.query[$1] as string | undefined)'
  );
  content = content.replace(
    /req\.headers\.get\(\s*(['"][^'"\\]+['"])\s*\)/g,
    '(req.get($1) || null)'
  );

  // Replace NextAuth getToken / getSession with our auth-middleware-set req.user.
  content = content.replace(
    /await\s+getToken\s*\(\s*\{\s*req\s*\}\s*\)/g,
    '({ user: (req as any).user })'
  );
  content = content.replace(/await\s+getSession\s*\(\s*\)/g, '({ user: (req as any).user })');

  // Find each exported HTTP handler and wrap with asyncHandler.
  const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)\s*\(([^)]*)\)\s*(:\s*Promise<[^>]+>)?\s*\{/g;
  const matches = [];
  let m;
  while ((m = methodRegex.exec(content)) !== null) {
    matches.push({
      method: m[1],
      args: m[2],
      start: m.index,
      bodyStart: m.index + m[0].length - 1, // index of '{'
      headerEnd: m.index + m[0].length,
    });
  }

  // Process from last to first so indexes stay valid.
  for (let idx = matches.length - 1; idx >= 0; idx--) {
    const match = matches[idx];
    const closeIdx = findMatchingBrace(content, match.bodyStart);
    if (closeIdx === -1) continue;

    let bodyInner = content.slice(match.headerEnd, closeIdx);
    // `NextResponse.error()` -> res.status(500).json(...)
    bodyInner = bodyInner.replace(
      /(return\s+)?NextResponse\.error\s*\(\s*\)/g,
      (_full, ret) =>
        `${ret ? 'return ' : ''}res.status(500).json({ success: false, message: 'Internal Server Error' })`
    );
    const convertedBody = convertNextResponseCalls(bodyInner);
    // `delete` is a reserved word; export as `del` and map back in route gen.
    const exportName = match.method === 'DELETE' ? 'del' : match.method.toLowerCase();

    const replacement = `export const ${exportName} = asyncHandler(async (req: Request, res: Response) => {${convertedBody}});`;
    content = content.slice(0, match.start) + replacement + content.slice(closeIdx + 1);
  }

  // Inject Express + asyncHandler imports at top (after first import block).
  const expressImports = `import type { Request, Response } from 'express';\nimport { asyncHandler } from '@middleware/async-handler';\n`;
  content = expressImports + content;

  return content;
}

// Files that have been manually fixed and should NOT be regenerated by the script.
const MANUAL_FIX_FILES = new Set([
  'task/screen-shot/controller.ts',
  'common/send-client-excel/controller.ts',
  'task/create-task/controller.ts',
  'task/electron-create-task/controller.ts',
  'task/close-inactive-sessions/controller.ts',
  'admin/update-user-status/controller.ts',
  'superAdmin/update-company-status/controller.ts',
  'admin/delete-leave/controller.ts',
  'admin/get-project-detail/controller.ts',
]);

function migrateControllers() {
  const root = path.join(SRC, 'controllers', 'http');
  const files = listFiles(root, (f) => path.basename(f) === 'controller.ts');
  let skipped = 0;
  for (const file of files) {
    const relDir = path.relative(root, path.dirname(file)).split(path.sep).join('/');
    const relKey = `${relDir}/controller.ts`;
    const destFile = path.join(DEST, 'controllers', relDir, 'controller.ts');
    if (MANUAL_FIX_FILES.has(relKey) && fs.existsSync(destFile)) {
      skipped++;
      continue;
    }
    const converted = convertController(read(file));
    write(destFile, converted);
  }
  console.log(`Converted ${files.length - skipped} controllers (skipped ${skipped} manual-fix files)`);
}

function generateRoutes() {
  const controllersRoot = path.join(DEST, 'controllers');
  const files = listFiles(controllersRoot, (f) => path.basename(f) === 'controller.ts');
  const domainMap = {};

  for (const file of files) {
    const rel = path.relative(controllersRoot, file).split(path.sep);
    const domain = rel[0];
    const sub = rel.slice(1, rel.length - 1).join('/');
    const content = read(file);
    const methods = [];
    const re = /export\s+const\s+(get|post|put|patch|del|options)\b/g;
    let m;
    while ((m = re.exec(content)) !== null) methods.push(m[1]);
    if (!domainMap[domain]) domainMap[domain] = [];
    domainMap[domain].push({ sub, methods, file });
  }

  // Routes that actually receive a multipart file upload. Map: `${domain}/${sub}` -> { type, field }
  const uploadRoutes = {
    'task/screen-shot': { type: 'single', field: 'image' },
    'common/send-client-excel': { type: 'single', field: 'file' },
  };

  const allDomains = [];
  for (const [domain, entries] of Object.entries(domainMap)) {
    const lines = [];
    lines.push(`import { Router } from 'express';`);
    let needsUpload = false;
    entries.forEach((entry, idx) => {
      const importPath = `@controllers/${domain}/${entry.sub}/controller`;
      const alias = `c${idx}`;
      lines.push(`import * as ${alias} from '${importPath}';`);
      const key = `${domain}/${entry.sub}`;
      if (uploadRoutes[key]) needsUpload = true;
    });
    if (needsUpload) {
      lines.push(`import { memoryUpload } from '@middleware/upload';`);
    }
    lines.push('');
    lines.push(`const router = Router();`);
    lines.push('');
    entries.forEach((entry, idx) => {
      const alias = `c${idx}`;
      const routePath = `/${entry.sub}`;
      const key = `${domain}/${entry.sub}`;
      for (const method of entry.methods) {
        const httpMethod = method === 'del' ? 'delete' : method;
        const upload = uploadRoutes[key];
        if (upload && method === 'post') {
          lines.push(
            `router.${httpMethod}('${routePath}', memoryUpload.${upload.type}('${upload.field}'), ${alias}.${method});`
          );
        } else {
          lines.push(`router.${httpMethod}('${routePath}', ${alias}.${method});`);
        }
      }
    });
    lines.push('');
    lines.push(`export default router;`);
    write(path.join(DEST, 'routes', `${domain}.routes.ts`), lines.join('\n') + '\n');
    allDomains.push(domain);
  }

  // Index aggregator
  const indexLines = [];
  indexLines.push(`import { Router } from 'express';`);
  for (const d of allDomains) {
    indexLines.push(`import ${d}Routes from './${d}.routes';`);
  }
  indexLines.push('');
  indexLines.push(`const router = Router();`);
  for (const d of allDomains) {
    indexLines.push(`router.use('/${d}', ${d}Routes);`);
  }
  indexLines.push('');
  indexLines.push(`export default router;`);
  write(path.join(DEST, 'routes', 'index.ts'), indexLines.join('\n') + '\n');

  console.log(`Generated routes for domains: ${allDomains.join(', ')}`);
}

function main() {
  migrateFoundations();
  migrateControllers();
  generateRoutes();
}

main();
