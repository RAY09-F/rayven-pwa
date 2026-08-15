// Web search / research providers: SerpAPI (quick search + YouTube), Tavily
// (deeper research, page extraction, crawling). Ported unchanged from worker.js.
// Reused directly by Phase 2 (web monitoring) for change/news detection.
import { enqueueBrowserCommand } from './browser.js';

export async function runWebSearch(env, query) {
  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${env.SERPAPI_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    let summary = '';
    if (data.answer_box) {
      if (data.answer_box.answer) summary += `Direct answer: ${data.answer_box.answer}\n`;
      if (data.answer_box.snippet) summary += `${data.answer_box.snippet}\n`;
    }
    if (Array.isArray(data.organic_results)) {
      data.organic_results.slice(0, 3).forEach((r, i) => {
        summary += `\n[${i + 1}] ${r.title}\n${r.snippet || ''}\nSource: ${r.link}\n`;
      });
    }
    if (!summary) summary = 'No useful search results were found for this query.';
    return summary;
  } catch (err) {
    return `Search failed: ${err.message}`;
  }
}

export async function tavilySearch(env, query) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query: query,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 5
      })
    });
    const data = await res.json();
    if (!res.ok) return `Tavily search error: ${JSON.stringify(data)}`;
    let summary = '';
    if (data.answer) summary += `Direct answer: ${data.answer}\n`;
    if (Array.isArray(data.results)) {
      data.results.forEach((r, i) => {
        summary += `\n[${i + 1}] ${r.title}\n${r.content ? r.content.slice(0, 400) : ''}\nSource: ${r.url}\n`;
      });
    }
    if (!summary) summary = 'No results found.';
    return summary;
  } catch (err) {
    return `Tavily search failed: ${err.message}`;
  }
}

export async function tavilyExtract(env, url) {
  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: env.TAVILY_API_KEY, urls: [url] })
    });
    const data = await res.json();
    if (!res.ok) return `Tavily extract error: ${JSON.stringify(data)}`;
    const result = data.results && data.results[0];
    if (!result || !result.raw_content) return `Could not extract content from ${url}.`;
    return result.raw_content.slice(0, 3000);
  } catch (err) {
    return `Tavily extract failed: ${err.message}`;
  }
}

// Structured variant of tavilyExtract for callers that need to distinguish
// success from failure programmatically (monitoring's page-change detection) —
// tavilyExtract above returns everything as a display string, which a human can
// read but code can't reliably branch on.
export async function tavilyExtractRaw(env, url, maxChars) {
  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: env.TAVILY_API_KEY, urls: [url] })
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: `Tavily extract error: ${JSON.stringify(data)}` };
    const result = data.results && data.results[0];
    if (!result || !result.raw_content) return { ok: false, error: `Could not extract content from ${url}.` };
    return { ok: true, content: result.raw_content.slice(0, maxChars || 6000) };
  } catch (err) {
    return { ok: false, error: `Tavily extract failed: ${err.message}` };
  }
}

// Structured variant of tavilySearch — returns raw results with URLs so
// monitoring can diff "which URLs are new since last check" instead of a
// pre-formatted display string.
export async function tavilySearchRaw(env, query) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query: query,
        search_depth: 'advanced',
        include_answer: false,
        max_results: 8
      })
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: `Tavily search error: ${JSON.stringify(data)}` };
    const results = Array.isArray(data.results) ? data.results.map(r => ({ title: r.title, url: r.url, content: (r.content || '').slice(0, 300) })) : [];
    return { ok: true, results };
  } catch (err) {
    return { ok: false, error: `Tavily search failed: ${err.message}` };
  }
}

export async function tavilyCrawl(env, url, instructions) {
  try {
    const res = await fetch('https://api.tavily.com/crawl', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        url: url,
        max_depth: 1,
        max_breadth: 8,
        instructions: instructions || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) return `Tavily crawl error: ${JSON.stringify(data)}`;
    let summary = '';
    const pages = data.results || [];
    pages.slice(0, 6).forEach((p, i) => {
      summary += `\n[${i + 1}] ${p.url}\n${(p.raw_content || '').slice(0, 300)}\n`;
    });
    if (!summary) summary = `No pages found crawling ${url}.`;
    return summary;
  } catch (err) {
    return `Tavily crawl failed: ${err.message}`;
  }
}

export async function youtubeFindAndOpen(env, query) {
  try {
    const searchQuery = `${query} latest video`;
    const res = await fetch(`https://serpapi.com/search.json?engine=youtube&search_query=${encodeURIComponent(searchQuery)}&api_key=${env.SERPAPI_KEY}`);
    const data = await res.json();
    const video = data.video_results && data.video_results[0];
    if (!video || !video.link) return `Couldn't find a video for "${query}".`;
    await enqueueBrowserCommand(env, 'navigate', { url: video.link });
    const channelName = video.channel && video.channel.name ? ` from ${video.channel.name}` : '';
    return `Opened "${video.title}" on YouTube${channelName}.`;
  } catch (err) {
    return `YouTube search failed: ${err.message}`;
  }
}
