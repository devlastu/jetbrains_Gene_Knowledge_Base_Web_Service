# Gene Knowledge Base Web Service — Claude Code Instructions

## graphify knowledge graph

This project has a pre-built knowledge graph. Use it as your primary context source before answering questions about the codebase.

**Entry points:**
- `graphify-out/wiki/index.md` — agent-crawlable wiki (start here for any codebase question)
- `graphify-out/GRAPH_REPORT.md` — god nodes, communities, surprising connections
- `graphify-out/graph.json` — raw graph for `/graphify query` traversal
- `graphify-out/obsidian/` — Obsidian vault (316 notes + graph.canvas)

**How to use:**
1. Before answering any architecture or "how does X work" question, read `graphify-out/wiki/index.md` first.
2. Use `/graphify query "<question>"` to traverse the graph for specific questions.
3. After any significant code change, run `/graphify . --update` to keep the graph current.

**Key god nodes** (most connected — touch these carefully):
- `launchBall()` — 20 edges
- `animatedNodeTransition()` — 18 edges
- `init()` — 17 edges
- `cancelActiveOperations()` — 10 edges
