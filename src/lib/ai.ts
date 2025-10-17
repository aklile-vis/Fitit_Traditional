// Simple AI helper with feature flag + env var
// Note: Network calls require OPENAI_API_KEY and LLM_ENABLE=true

export async function aiSuggestLayerMapping(layers: string[]): Promise<{ layer: string; category: string; confidence: number }[]> {
  if (process.env.LLM_ENABLE !== 'true' || !process.env.OPENAI_API_KEY) {
    return layers.map(l => ({ layer: l, category: 'auto', confidence: 0 }))
  }
  const prompt = `Map these CAD layer names to canonical categories (wall, floor, ceiling, door, window, room, other). Return JSON array with {layer, category, confidence}.
Layers: ${layers.join(', ')}`
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.2 })
  })
  if (!res.ok) return layers.map(l => ({ layer: l, category: 'auto', confidence: 0 }))
  const js = await res.json()
  const text = js.choices?.[0]?.message?.content?.trim() || '[]'
  try { return JSON.parse(text) } catch { return [] }
}

