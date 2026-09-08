import { TOOLS as BRAIN_WEB } from './catalog-brain-web.js';
import { TOOLS as BRAIN_DOCS } from './catalog-brain-docs.js';
// THE CATALOGUE (asgard-upgrade Phase 7). One place that gathers every catalogue
// module, registers each tool's metadata (group, taint) with the toolbox, marks
// outside-content tools as untrusted sources for containment, and opens the
// tools to every persona (they are reached through find_tools or a keyword-
// opened group, never by name in a god's allow-list). DROPPED lists tools that
// failed their live test and are not shipped -- see docs/TOOL_TESTS.md.
import { registerMeta } from './meta.js';
import { registerUntrustedSources } from '../lib/containment.js';
import { registerOpenTools } from '../lib/personas.js';
import { TOOLS as RESEARCH } from './catalog-research.js';
import { TOOLS as MARKETS } from './catalog-markets.js';
import { TOOLS as WORLD } from './catalog-world.js';
import { TOOLS as LIFE } from './catalog-life.js';
import { TOOLS as DEV } from './catalog-dev.js';
import { TOOLS as MEDIA } from './catalog-media.js';
import { TOOLS as AI } from './catalog-ai.js';
import { TOOLS as SELF } from './catalog-self.js';
import { TOOLS as COMMS } from './catalog-comms.js';
import { TOOLS as JOBS } from './catalog-jobs.js';

export const DROPPED = new Set([   // failed their live test; the reason is in docs/TOOL_TESTS.md
  /* reddit.com answers 403 to Cloudflare's edge addresses (expected; noted in the spec) */ 'reddit_read',
  /* efts.sec.gov refuses cloud addresses with 403 even with a User-Agent */ 'sec_search',
  /* api.bls.gov: 'Requests Per Second Limit Exceeded' from the shared address */ 'bls_latest',
  /* news.google.com/rss answers 503 to the edge address (news_search via SerpAPI exists) */ 'google_news',
  /* 429 then timeouts without a key */ 'semantic_scholar',
  /* gutendex.com timed out twice at 10 s */ 'gutenberg_search',
  /* universities.hipolabs.com down (521) on both tests */ 'universities',
  /* 429 (their rate limit, error 1015) on both tests */ 'dexscreener_search',
  /* stooq.com and stooq.pl both 404 the CSV endpoint from here */ 'stooq_quote',
  /* home.treasury.gov XML feed timed out at 10 s and 18 s */ 'treasury_yields',
  /* api.github.com: 60/h no-key limit already exhausted from the shared address; a GITHUB_TOKEN would revive it */ 'github_activity',
  /* itunes.apple.com 429 from the shared address */ 'itunes_search',
  /* api.song.link: PUBLIC_API_ACCESS_DEPRECATED (401) — the free API is gone */ 'songlink',
  /* boardgamegeek.com XML API now requires a token (401) */ 'board_games',
  /* api.jikan.moe answered 504 on both tries */ 'anime_search',
  /* musicbrainz.org: timeout, then 503 'server busy' */ 'musicbrainz',
]);   // names removed after a failed live test (reason in docs/TOOL_TESTS.md)

const ALL = [...BRAIN_WEB, ...BRAIN_DOCS, ...RESEARCH, ...MARKETS, ...WORLD, ...LIFE, ...DEV, ...MEDIA, ...AI, ...SELF, ...COMMS, ...JOBS].filter(t => !DROPPED.has(t.name));
export const CATALOG = Object.fromEntries(ALL.map(t => [t.name, t]));
export const CATALOG_DEFS = ALL.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema || { type: 'object', properties: {} }, ...(t.input_examples ? {input_examples:t.input_examples} : {}), ...(t.defer_loading ? {defer_loading:true} : {}) }));
export const CATALOG_NAMES = ALL.map(t => t.name);
for (const t of ALL) registerMeta(t.name, { group: t.group || 'misc', taint: !!t.taint, source: 'catalogue' });
registerUntrustedSources(ALL.filter(t => t.taint).map(t => t.name));
registerOpenTools(CATALOG_NAMES);
export function isCatalogTool(name) { return Object.prototype.hasOwnProperty.call(CATALOG, name); }
export async function runCatalogTool(env, name, input, ctx) {
  const t = CATALOG[name]; if (!t) return 'Unknown tool.';
  const args = input && typeof input === 'object' ? input : {};
  for (const k of ['n', 'limit', 'days']) if (args[k] != null) args[k] = Math.max(1, Math.min(20, Number(args[k]) || 1));   // every n / limit has a hard maximum of 20
  return await t.run(env, args, ctx || {});
}
