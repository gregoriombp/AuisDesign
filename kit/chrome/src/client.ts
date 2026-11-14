export async function request<T = void>(type: string, data: Record<string, unknown> = {}): Promise<T> {
  const response = await chrome.runtime.sendMessage({ channel: "auis-review", type, ...data })
  if (!response?.ok) throw new Error(response?.error || "A extensão foi atualizada. Recarregue a página e ative novamente.")
  return response.value as T
}
export function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob) })
}
