export async function readJson<T = unknown>(req: Request): Promise<T> {
  return req.json() as Promise<T>;
}
