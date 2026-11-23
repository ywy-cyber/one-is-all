# 各家 harness 适配

同一份 skill，三家能力不同。**能用多少，取决于宿主有没有"派单 / 追问 / 求援 / 唤醒"这四件原语。**

| | 派单 | 追问 | 子 agent 求援 | 完成唤醒 |
|---|---|---|---|---|
| **Pi** | ✅ `subagent` | ✅ `steer` | ✅ `contact_supervisor` | ✅ 异步完成起新轮 |
| **Codex** | ✅ 多 agent 工具 | ⚠️ 只能让 Codex 转达 | ❌ | ❌ |
| **DSH** | ✅ `subagent` | ⚠️ `send_message`（只对活着的） | ❌ | ✅ 完成通知 |

---

## Pi（默认 leader，扩展强制）

装了什么：

| 项 | 路径 |
|---|---|
| 技能 | `~/.pi/agent/settings.json` 的 `skills` 数组（**绝对路径**） |
| 成员定义 | `~/.pi/agent/agents/one-is-all-member.md` |
| 并发上限 | `~/.pi/agent/extensions/subagent/config.json` → `maxActiveAsyncRunsPerSession: 5` |
| 强制扩展 | `~/.pi/agent/extensions/one-is-all-leader.ts` |
| 行为条款 | `~/.pi/agent/AGENTS.md` §4.8 + `LEADER.md` |

**为什么不用 `~/.agents/skills`**：那个目录是 Pi 与 DSH 共用的，软链进去两边都会看到。要只装 Pi，就走 `settings.json` 的 `skills`。

**坑**：`settings.json` 的 `skills` 里写 `~/…` **不生效**，必须写绝对路径（2026-11-18 在 pi 1.5.2 实测）。写成相对路径会静默失败，不报错。

### 触发式怎么工作

`AGENTS.md` 只写触发条件，不强制每个会话当主控：

- 触发：用户说「托管 / 这些事交给你 / 帮我盯」，或明显 ≥2 条并行任务；
- 进入：读 `/skill:one-is-all`，按 `LEADER.md` 做；
- 不触发：普通会话照常干活。

### 原语对照

| 协议 | Pi |
|---|---|
| `DISPATCH` | `subagent({agent:"one-is-all-member", task, async:true})` |
| `QUERY` / `ADJUST` / `APPROVE` | `subagent({action:"steer", id:"<run-id>", message:"[QUERY T03]…"})` |
| `STOP` | `subagent({action:"stop", id})` |
| `DONE` / `STATUS` | 异步完成通知（自动唤醒主控） |
| `BLOCKED` / `DECIDE` | 成员调 `contact_supervisor({reason:"need_decision"})` |
| 巡检闹钟 | `bg_run` 跑 `oia watch`，`triggerOnCompletion` 默认开 |

### 已知边界

1. **超时删不掉，只能推长**：`timeoutMs` 必须是正整数，上限 2147483647 ms（约 24.8 天），写 0 或超范围会被忽略、回落到 30 分钟。成员定义里已设 24 小时作安全绳；真正停不停由主控按预算决定（见 `LEADER.md` 第十节）。
   - 提醒：`pi -p` 非交互模式下，这个值同时决定轮次结束后等后台子任务的时间；设成 24h 会让脚本挂住。
   - 已知快工具（`read`/`grep`/`find`/`ls`/`edit`/`write`）有 5 分钟硬超时；`bash` 没有硬默认，只受运行截止时间约束。
2. 父会话必须开着，关掉 TUI 收不到唤醒。
3. 成员默认不继承技能目录（Pi 自定义 agent 的默认）；要让它用 `free-web-search` 这类工具，在成员定义里加 `inheritSkills: true` 或 `skills: <列表>`。**不加也能跑**，成员会在回执里说"技能不可用，请 leader 提供"。

---

## Codex（能用一半）

能用的：

- `multi_agent` 默认开启，能派子 agent 并行跑；
- 自定义 agent：`~/.codex/agents/one-is-all-member.toml`（`bin/render-worker codex` 生成）；
- 技能：`~/.codex/skills`（**这个目录只属于 Codex**，可以软链）；
- 触发：`~/.codex/AGENTS.md` 里写触发条款。

缺的：

- **没有完成唤醒**：`wake_on_agent_messages` 还是 under development、默认关。子 agent 干完，主控不会自动起一轮。
- **没有 API 化追问**：只能对 Codex 说"去告诉某个子 agent…"，让它转达。
- **没有子 agent 求援通道**：成员只能交最终文本。

所以 Codex 上的巡检只能外挂：

```bash
codex queue --thread <leader-session-uuid> --message "巡检：读 board，处理到期任务" --resume
```

**结论**：Codex 适合「一批任务派下去、收结果、验收」，不适合「每任务 30/60/300s 动态节拍」。

---

## DSH（能用一半）

能用的：

- 技能自动发现 `~/.agents/skills`（**与 Pi 共用**，装这里两边都看得见）；
- `subagent` 派单 + 完成通知；
- `send_message` 对活着的子 agent 追问。

缺的：

- **没有 `contact_supervisor`**：子 agent 中途停下就结束了，只能交最终文本；
- **默认开启要改 harness**：得做一个 preset bundle（`dsh-agent-preset` + `dsh-persona` 的 `prefix`），只有 Full access 能装；
- 定时巡检：后台 bash 作业，或 `schedule_create`（最快 60s）。

**结论**：DSH 能跑「派单 + 收结果 + 定时巡检」，跑不了「成员中途求援」。

---

## 一句话选型

- 要**成员随时能停下来问**：只能在 Pi。
- 要**批量派单收结果**：Codex 够用。
- 要**和现有 DSH 工作区共用技能**：DSH 可以，但别指望求援通道。
