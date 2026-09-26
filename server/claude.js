// Thin wrapper around the Claude Messages API (no SDK needed).
// Web search runs on Anthropic's side; long searches can return
// stop_reason "pause_turn", in which case we send the turn back to continue.
export async function callClaude({apiKey, model, system, messages, tools, maxTokens = 8000, timeoutMs = 180000}) {
  let conversation = [...messages];
  let response;
  for (let round = 0; round < 5; round++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${process.env.CLAUDE_API_BASE || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({model, max_tokens: maxTokens, system, messages: conversation, ...(tools ? {tools} : {})}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = body?.error?.message || `HTTP ${res.status}`;
        throw Object.assign(new Error(`Claude API: ${message}`), {status: res.status});
      }
      response = body;
    } finally {
      clearTimeout(timer);
    }
    if (response.stop_reason !== 'pause_turn') break;
    conversation = [...messages, {role: 'assistant', content: response.content}];
  }
  return response;
}

// Text that follows the last search result is the model's final answer.
export function finalText(response) {
  const content = response?.content || [];
  let lastTool = -1;
  content.forEach((block, i) => { if (block.type !== 'text') lastTool = i; });
  const tail = content.slice(lastTool + 1).filter(b => b.type === 'text').map(b => b.text).join('');
  return tail || content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}

// Accepts plain JSON, fenced ```json blocks or JSON surrounded by prose.
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start < 0) throw new Error('No JSON found in AI answer');
  const open = candidate[start], close = open === '{' ? '}' : ']';
  const end = candidate.lastIndexOf(close);
  return JSON.parse(candidate.slice(start, end + 1));
}
