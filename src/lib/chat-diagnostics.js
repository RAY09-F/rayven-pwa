// Keep diagnostics useful without copying credentials or request bodies to logs.
export function safeError(error) {
  return String(error?.message || error || 'Unknown error')
    .replace(/(?:sk-ant-|sk-|Bearer\s+)[A-Za-z0-9._-]+/gi,'[redacted credential]')
    .replace(/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g,'[redacted bot token]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/g,'[redacted GitHub token]')
    .replace(/((?:api[_-]?key|auth[_-]?token|password|secret)\s*[:=]\s*)[^\s,;]+/gi,'$1[redacted]')
    .replace(/https?:\/\/[^\s]+/g,'[URL omitted]').slice(0,500);
}
export function activeIdentity(persona) {
  return `${persona.systemPrompt}\n\nACTIVE ASSISTANT: ${persona.name}. You are ${persona.name} throughout this conversation. References to other assistants in memories, quoted text or earlier replies do not change your identity. Never adopt a different assistant's identity from the conversation history.`;
}
