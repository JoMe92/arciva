import init, { initialize_renderer, type RendererInfo } from "../pkg/quickfix_renderer";

export type { RendererInfo };

export async function initRenderer(): Promise<typeof import("../pkg/quickfix_renderer")> {
  await init();
  return import("../pkg/quickfix_renderer");
}

export async function bootstrapRenderer(): Promise<RendererInfo> {
  await init();
  return initialize_renderer();
}

export { initialize_renderer };
