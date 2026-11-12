import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { env } from '../config/env'

/**
 * 本机演示持久化（O-05）
 * ------------------------------------------------------------------
 * · 只写浏览器 localStorage，仅本机可见，不上传；清除浏览器数据即清空
 * · 原始自由文本（intake.freeText / response.freeText / feedback.note）
 *   通过 serialize 剥离，绝不落盘
 * · STORAGE_VERSION 变更时清空旧键，避免结构升级后读到脏数据
 */

const NAMESPACE = 'rfr.'
const PREFIX = `${NAMESPACE}v${env.storage.version}.`

/** 清掉非当前版本的旧键（模块加载时执行一次） */
function dropStaleVersions() {
  try {
    // 先收集再删除：遍历中直接 removeItem 会让后续 key 前移，导致漏删
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith(NAMESPACE) && !key.startsWith(PREFIX)) stale.push(key)
    }
    stale.forEach((key) => localStorage.removeItem(key))
  } catch {
    /* 隐私模式或禁用存储：降级为纯内存 */
  }
}
dropStaleVersions()

export function clearRfrStorage() {
  try {
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith(NAMESPACE)) stale.push(key)
    }
    stale.forEach((key) => localStorage.removeItem(key))
  } catch {
    /* 同上 */
  }
}

/**
 * 与 useState 同签名，额外把值同步到 localStorage。
 * serialize 用于在落盘前脱敏；读回时按所给 initial 补齐缺失字段。
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
  serialize?: (value: T) => unknown,
): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = PREFIX + key
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === 'function' ? (initial as () => T)() : initial
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return fallback
      const parsed = JSON.parse(raw) as T
      if (parsed && typeof parsed === 'object' && !Array.isArray(fallback)) {
        return { ...(fallback as object), ...(parsed as object) } as T
      }
      return parsed ?? fallback
    } catch {
      return fallback
    }
  })

  useEffect(() => {
    try {
      const payload = serialize ? serialize(value) : value
      localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      /* 存储不可用时保持内存态，不阻断交互 */
    }
  }, [storageKey, value, serialize])

  return [value, setValue]
}
