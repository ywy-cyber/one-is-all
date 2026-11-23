# 身份分层与上下文

本 skill 只干一件事：**在技能内部把身份分开**。
继承什么、继承多少、用哪些工具 —— 交给 harness 判断，skill 不设前提。

---

## 1. 一条原则

> 身份由文档决定，不由 harness 的开关决定。

- 主控读 `LEADER.md`，里面写的是"调度者"的职责与禁区。
- 成员读 `WORKER.md`，里面写的是"执行者"的职责与禁区。
- 两份文档各自在第一屏做身份自检，走错了会被指回来。

因此本 skill **不要求**任何 `AGENTS.md` 的特定写法，**不依赖** `inheritProjectContext` / `inheritSkills` 之类的配置项。

---

## 2. 两条加载路径，同一份内容

| 路径 | 适用 | 做法 |
|---|---|---|
| **技能路由** | 成员能读到技能目录 | 派单写 `[ROLE member]` + 路径 `…/one-is-all/WORKER.md`，成员开工前自己读 |
| **派单注入** | 成员读不到技能 / 没有技能机制 | `bin/render-worker plain` 取正文，贴在任务最前 |

两条路都能走通，因为成员正文是自足的：身份、优先级、颗粒度、回执格式、卡住怎么报，全在里面。
**不要维护第二份工人提示词。**

---

## 3. 为什么是一个 skill 两个角色，而不是两个 skill

拆成 `team-leader-skill` + `team-member-skill` 也能跑，但代价是：

- **协议要复制**：状态机、九类消息、看板格式、`oia` 用法是双方共用的契约，拆开就得复制两份 —— 两套真相，迟早不一致。
- **跨目录引用**：让 member skill 去读 leader skill 下的 `protocol.md`，安装成符号链接后路径就断了。

单 skill + 两个角色文档，同样能做到"成员只读 member.md"，靠的是路由规则而不是物理隔离。
真要硬隔离，第二步再把 根目录 拆成两个目录、协议提升为第三个 skill —— 现在不做。

---

## 4. 成员怎么确认自己是成员

按顺序看，命中一条就停：

1. 任务里有 `[ROLE member]` / `[DISPATCH …]` / `[WORKER CONTEXT]`；
2. 任务开头写着"你是 one-is-all 的成员/工人"；
3. 你手上只有一张工单，没有用户的原始需求。

三条都不中，而你在跟用户直接对话 → 你是主控，改读 `LEADER.md`。
**还是判不出来**：主控问用户一句，成员问 leader 一句，不要自己挑一个身份开工。

---

## 5. 依赖边界（这几条是硬承诺）

| 承诺 | 含义 |
|---|---|
| 不读项目 `AGENTS.md` 的特定结构 | 成员只按"工单 > 成员文档 > 项目规范"的优先级行事，项目规范长什么样都能用 |
| 不设继承开关也能跑 | 正文自足；开关只影响"成员还能看到什么"，不影响协议 |
| 不假设工具名 | 文档写"派单原语 / 追问原语 / 查存活原语"，各家自行对应 |
| 不假设唤醒机制 | 主控用闹钟或事件唤醒都行，协议只规定"到期要做什么" |

---

## 6. 可选调优（建议，不是前提）

设了更省事，不设也能跑。**只影响成员能看到多少信息，不影响协议与回执格式。**

| 项 | Pi | Codex | DSH |
|---|---|---|---|
| 让成员看到技能目录 | `inheritSkills: true` 或 `skills: <列表>` | 默认继承 | 随 preset |
| 让成员看到项目规范 | `inheritProjectContext: true` | 自动 | 自动 |
| 避免继承"对用户"的人格 | `inheritGlobalContext: false` | 无开关，靠成员文档的优先级条款 | 无开关，靠优先级条款 |
| 并发上限 | `maxActiveAsyncRunsPerSession` | `[agents] max_concurrent_threads_per_session` | `maxActiveSubagents`（默认 8） |
| 禁止嵌套 | `tools` 里不给 `subagent` | 工具面由 Codex 管 | `maxDepth` 默认 1 |

注意 Pi 的一个坑：`inheritGlobalContext` 只在 `inheritProjectContext: true` 时才有意义；两个都关，成员就只剩 `member.md` 里的内容 —— 这仍然能跑，只是少了项目路径与禁区。

### 生成成员定义（可选）

```bash
bin/render-worker pi    > ~/.pi/agent/agents/one-is-all-member.md
bin/render-worker codex > ~/.codex/agents/one-is-all-member.toml
bin/render-worker plain                       # DSH / Claude Code，贴进派单
```

生成的 frontmatter 只声明工具集与提示词模式，**不含任何继承开关**：

```yaml
name: one-is-all-member
tools: read, grep, find, ls, bash, edit, write, contact_supervisor
systemPromptMode: replace
defaultContext: fresh
defaultProgress: false
acceptanceRole: writer
advertise: true
```

要加继承，自己按上表补，别改模板。

---

## 7. 验收：身份有没有串

派一个成员做三件事，看回执：

1. 问「你的工单范围是什么」→ 答工单里的，不是项目全局的；
2. 问「联网查资料用什么」→ 答 `free-web-search`（或明确说"技能不可用，需要 leader 提供"）；
3. 让它碰一个禁区路径 → 应发 `DECIDE`，不是直接改。

三条都对，说明身份没串、规范在、技能在。
若第 2 条答"我自己写 curl"，说明它的技能目录没继承 —— 这不是 skill 的错，是 harness 该补的调优项。
