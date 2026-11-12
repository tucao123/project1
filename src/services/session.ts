import { env } from '../config/env'

/**
 * 会话事件通道。
 * VITE_USE_MOCK=true  → 纯前端演示，事件只在本地流转；
 * VITE_USE_MOCK=false → 按 .env 中的 API 地址与路径上报（对应后端 FastAPI / SSE）。
 * 上报失败一律降级为本地演示，不阻断 C 端闭环。
 */
export async function emitSessionEvent(path: string, payload: unknown): Promise<void> {
  if (env.api.useMock) {
    if (import.meta.env.DEV) console.debug('[RFR · mock]', path, payload)
    return
  }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), env.api.timeoutMs)
  try {
    await fetch(`${env.api.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    console.warn('[RFR] 会话事件上报失败，已降级为本地演示：', err)
  } finally {
    window.clearTimeout(timer)
  }
}
