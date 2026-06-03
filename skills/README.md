# SQL 治理 Agent Skills

本目录下的技能遵循 [Anthropic Agent Skills](https://www.anthropic.com/news/agent-skills) 规范
（每个技能是一个独立文件夹，含 `SKILL.md` + YAML frontmatter + 可选 bundled 脚本），
使本项目的 SQL 调优 / 安全审计 / 反模式审查 / 多智能体治理能力可被任意支持 Skills 的
AI Agent（Claude、Cursor、Cline 等）发现并调用。

技能通过两种方式落地本项目能力：
1. **HTTP API**（推荐）：技能脚本调用正在运行的后端 `http://localhost:8090`。
2. **MCP**：通过 `src/app/services/enterprise_tuning_service/mcp_app.py` 暴露的标准 MCP 工具
   （见仓库根 README 的 MCP 章节）。

| 技能 | 作用 | 对应 API |
|------|------|----------|
| `sql-governance-review` | 多智能体会审，出统一裁决 | `POST /api/text2sql_lg_code/enterprise/agents/review` |
| `sql-tuning` | 单条 SQL 性能调优重写 + 索引 | `POST /api/text2sql_lg_code/enterprise/tuning/optimize` |
| `sql-privacy-audit` | PII 泄露 / GDPR 合规审计 | `POST /api/text2sql_lg_code/enterprise/tuning/optimize` (privacy_report) |
| `sql-anti-pattern-audit` | 静态+AI 反模式审查 | `POST /api/text2sql_lg_code/enterprise/tuning/anti-patterns` |

所有脚本支持环境变量 `SQL_API_BASE`（默认 `http://localhost:8090`）。
