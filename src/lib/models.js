// ONE place for every model id the Worker sends anywhere. Verified against
// platform.claude.com/docs/en/models/overview on 2026-09-04:
//   claude-sonnet-5            $2 / $10 per Mtok, 1M context, cutoff Jan 2026 (current)
//   claude-haiku-4-5-20251001  $1 / $5 per Mtok, 200K context (current Haiku)
//   claude-sonnet-4-6          legacy, $3 / $15 — dearer and older; not used
// Workers AI ids come from the Cloudflare models catalogue.
// Rule: never write a model id string anywhere else. Import from here.
export const MODELS = {
  sonnet: 'claude-sonnet-5',                    // the gods (chat, briefings, reports)
  haiku: 'claude-haiku-4-5-20251001',           // the councils' "cheap" tier
  workersAiFree: '@cf/meta/llama-3.2-3b-instruct', // the councils' "free" tier (triage, yes/no)
  embedding: '@cf/baai/bge-base-en-v1.5',
  reranker: '@cf/baai/bge-reranker-base'
};
