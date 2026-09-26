import {callClaude, extractJson} from './claude.js';

// "Ask Out There": the app already filtered candidate events using what it
// knows (time window, interests, distance). Claude only picks the best few
// and writes one short, human sentence. The app falls back to its own
// ranking when no key is set or this takes too long.
const SYSTEM = `You are Out There, a calm social concierge inside a map app.
You get the user's request, what they like, and candidate events that are already filtered to fit.
Pick up to 3 events that best fit the request (people mentioned, time, budget, mood). Prefer events that friends attend or that match both people's interests.
Reply with ONE short sentence (max 14 words), warm and plain, no emojis, no questions, never say "AI", never say "we noticed" or "we tracked".
If people are mentioned, say it fits both / all of them.
Respond only with JSON: {"reply":"...","ids":["event-id", ...]}`;

export async function askConcierge(body, settings) {
  if (!settings.apiKey) throw Object.assign(new Error('No API key'), {status: 503, code: 'missing_key'});
  const events = Array.isArray(body.events) ? body.events.slice(0, 20) : [];
  if (!events.length) return {reply: 'Nothing fits that yet.', ids: []};
  const response = await callClaude({
    apiKey: settings.apiKey,
    model: settings.fastModel,
    maxTokens: 400,
    timeoutMs: 11000,
    system: SYSTEM,
    messages: [{role: 'user', content: JSON.stringify({
      request: String(body.text || '').slice(0, 300),
      now: body.now, window: body.window, people: body.people, likes: body.likes, usualBudget: body.budget,
      events,
    })}],
  });
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const parsed = extractJson(text);
  const known = new Set(events.map(e => e.id));
  return {
    reply: String(parsed.reply || '').slice(0, 160),
    ids: (Array.isArray(parsed.ids) ? parsed.ids : []).filter(id => known.has(id)).slice(0, 3),
  };
}
