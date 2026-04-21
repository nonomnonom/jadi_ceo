# Juragan — Project Task Tracker

## Phase 1 — Plugin Architecture (M1) ✅
- [x] PluginManager singleton with discover/load/unload
- [x] Plugin manifest schema (juragan-plugin.json)
- [x] Tool registration via api.registerTool()
- [x] Channel plugin pattern (whatsapp-channel plugin)
- [x] Skill auto-discovery from skills/ directory

## Phase 2 — ACP Supervisor (M1.5) ✅
- [x] AcpSessionManager with SessionActorQueue + RuntimeCache
- [x] spawnAcpDirect() — spawn sub-agent sessions
- [x] startAcpSpawnParentStreamRelay() with stall detection + delta routing
- [x] runTurnWithTranscript() — session turns with transcript persistence
- [x] Session persistence: acp_sessions + acp_transcripts tables in LibSQL
- [x] initAcpSchema() + AcpSessionManager.setDb() wired at bootstrap
- [x] AgentConfig schema (agent.yaml) + workspace path resolution
- [x] listSessions() / getCachedSession() / getRunningTaskCount()
- [x] completeTaskRun() / failTaskRun() — task lifecycle management
- [x] ACP HTTP routes: /acp/health, /acp/sessions, /acp/tasks, /acp/sessions/:key/close
- [x] ACP agent tools: spawn-sub-agent, list-acp-sessions, complete-task, fail-task

## Phase 3 — Channel Architecture (M1.5)
- [ ] Deprecate direct channels/whatsapp.ts import → plugin pattern
- [ ] Telegram plugin (if not using @chat-adapter/telegram directly)

## Phase 4 — Tool & Action System (M2)
- [ ] Tool confirmation workflow
- [ ] Tool approval queue (admin panel)

## Phase 5 — Workflow 2.0 (M2)
- [ ] Reminder workflow: multi-step with approval gates
- [ ] Restock workflow: supplier order + payment
- [ ] Customer followup: automated sequence

## Phase 6 — Dashboard (M2)
- [ ] Admin UI for approvals
- [ ] Session/session transcript viewer

## Phase 7 — Self-Hosting (M2)
- [ ] Docker compose for Redis + LibSQL
- [ ] Environment variable config

## Phase 8 — CI/CD (M2)
- [ ] GitHub Actions: test + lint + check-types

## Phase 9 — Docs & Community (M2)
- [ ] README in Bahasa Indonesia
- [ ] Contributor guide