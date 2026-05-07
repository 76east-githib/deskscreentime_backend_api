import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options';
const METHOD_REGEX =
  /(?:export\s+const\s+|exports\.)(get|post|put|patch|del|options)\b/g;
const METHOD_ALIAS: Record<string, HttpMethod> = {
  get: 'get',
  post: 'post',
  put: 'put',
  patch: 'patch',
  del: 'delete',
  options: 'options',
};

const protectedRoutes = new Set<string>([
  '/api/admin/get-user-detail',
  '/api/admin/user-screen-shots',
  '/api/admin/get-projects',
  '/api/admin/delete-project',
  '/api/admin/get-project',
  '/api/admin/add-project',
  '/api/admin/get-project-detail',
  '/api/admin/get-project-report',
  '/api/admin/delete-user',
  '/api/admin/update-user-status',
  '/api/common/change-password',
  '/api/admin/get-user',
  '/api/admin/get-project-list-company',
  '/api/admin/add-user',
  '/api/superAdmin/get-companies',
  '/api/superAdmin/delete-company',
  '/api/superAdmin/update-company-status',
  '/api/task/get-project-userId',
  '/api/task/create-task',
  '/api/task/stop-timer',
  '/api/task/task-list',
  '/api/task/screen-shots',
  '/api/task/compare-screenshot',
  '/api/task/update-last-active-time',
  '/api/common/get-userData',
  '/api/common/update-profile',
  '/api/admin/add-task',
  '/api/admin/get-user-leaves',
  '/api/admin/add-holiday',
  '/api/admin/get-clients',
  '/api/admin/add-client',
  '/api/common/dashboard-data',
]);

function walkRouteFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkRouteFiles(full, acc);
    else if (
      entry.isFile() &&
      (entry.name === 'controller.ts' || entry.name === 'controller.js')
    )
      acc.push(full);
  }
  return acc;
}

function extractMethods(content: string): HttpMethod[] {
  const found = new Set<HttpMethod>();
  let m: RegExpExecArray | null;
  METHOD_REGEX.lastIndex = 0;
  while ((m = METHOD_REGEX.exec(content)) !== null) {
    const mapped = METHOD_ALIAS[m[1]];
    if (mapped) found.add(mapped);
  }
  return Array.from(found);
}

function buildOperation(pathname: string, method: HttpMethod) {
  const tag = pathname.split('/')[2] || 'misc';
  const isReadOnly = method === 'get' || method === 'delete';
  const isProtected = protectedRoutes.has(pathname);

  return {
    tags: [tag],
    summary: `${method.toUpperCase()} ${pathname}`,
    operationId: `${method}_${pathname.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`,
    requestBody: isReadOnly
      ? undefined
      : {
          required: false,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true },
            },
          },
        },
    responses: {
      200: { description: 'Success' },
      400: { description: 'Bad Request' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      500: { description: 'Internal Server Error' },
    },
    ...(isProtected ? { security: [{ bearerAuth: [] }] } : {}),
  };
}

export function buildOpenApiSpec() {
  const controllersRoot = path.resolve(__dirname, '..', 'controllers');
  const files = walkRouteFiles(controllersRoot);
  const paths: Record<string, Record<string, unknown>> = {};

  for (const file of files) {
    const rel = path.relative(controllersRoot, file).split(path.sep);
    const dirSegments = rel.slice(0, rel.length - 1);
    const apiPath = `${env.apiPrefix}/${dirSegments.join('/')}`;
    const content = fs.readFileSync(file, 'utf8');
    const methods = extractMethods(content);
    if (methods.length === 0) continue;
    paths[apiPath] = paths[apiPath] || {};
    for (const method of methods) {
      paths[apiPath][method] = buildOperation(apiPath, method);
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'DeskScreenTime Backend API',
      version: '1.0.0',
      description: 'Standalone Node.js + Express backend API documentation.',
    },
    servers: [{ url: `http://localhost:${env.port}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths,
  };
}
