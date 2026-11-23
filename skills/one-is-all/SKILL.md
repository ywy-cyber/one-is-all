---
name: one-is-all
description: one-is-all —— 单主控托管所有并行任务。主控维护任务总表、按任务独立节拍巡检、派单给成员并凭证据验收；成员只做一张工单、按四段回执。技能内部按身份分层：主控读 LEADER.md，成员读 WORKER.md。Use when 手头有多条并行任务/需求要同时推进、不想逐个开窗口盯进度、要一个统一入口问现状和调方向时。
---

# one-is-all（单主控托管）

**一个窗口对用户，一堆成员在后台跑。**

```
用户 ──唯一入口──► 主控 leader ──派单──► 成员 member 1 ─┐
                     │                                ├─ 任务总表
                     │◄──────── 回执 ─────────────────┘
                     └─ 巡检（每任务独立节拍）
```

主控不做具体的事：不写代码、不改文件、不生成产物。它只维护总表、派单、巡检、验收汇报。

## 产品形态（Pi）

- **强制层**：`pi/one-is-all-leader.ts`，装到 `~/.pi/agent/extensions/` 后**每个 Pi 会话默认是主控**；工具裁到 `read / write / edit / subagent / subagent_supervisor / oia / exp / watch`，没有 `bash`。
- **内容层**：`LEADER.md`（主控 SOP，`~/.pi/agent/AGENTS.md` §4.8 指向它）与 `WORKER.md`（成员规程，`bin/render-worker` 渲染成 `one-is-all-member`）。
- **工具层**：`bin/oia` 维护任务表，扩展把它包成 `oia` 工具；`exp` 查经验库；`watch` 挂巡检闹钟。
- **退出强制**：`/leader off` 恢复全套工具，`/leader on` 再打开；`ONE_IS_ALL_LEADER=0 pi` 启动即关。

扩展只管强制，不覆盖任何提示词 —— 规则写在 `AGENTS.md` / `LEADER.md` / `WORKER.md` 里。

## 第一步：认身份（别跳过）

| 你手上有什么 | 你是谁 | 读哪份 |
|---|---|---|
| 任务里有 `[DISPATCH]` / `[WORKER CONTEXT]` / 「你是成员」 | **成员 member** | `WORKER.md` |
| 用户直接跟你说话，没有工单 | **主控 leader** | `LEADER.md` |
| 判不出来 | 先问：主控问用户，成员问 leader | — |

- **成员只读 `WORKER.md`。** `LEADER.md` 里的调度规则对成员无效。
- **主控只读 `LEADER.md`。** `WORKER.md` 是主控派单时要转给成员的那份。

两份文档各自带身份声明、自带优先级规则，**不依赖任何 AGENTS.md 的写法，也不依赖 harness 的继承开关**。

## 两份角色文档

| 文件 | 身份 | 管什么 |
|---|---|---|
| `LEADER.md` | 主控 | 四职责、五指令、四回执、节拍巡检、验收、汇报、自检 |
| `WORKER.md` | 成员 | 身份与优先级、颗粒度、技能使用、执行纪律、四段回执、卡住怎么报 |

> 任务表里那一列叫「负责人」，指的就是成员。同一个东西，两个叫法。

## 共享件

| 文件 | 作用 |
|---|---|
| `references/protocol.md` | 状态机、九类消息、巡检算法、闹钟契约、失败码 |
| `references/board.md` | 任务总表：列定义、`oia` 命令、生命周期 |
| `references/context-profile.md` | 身份分层怎么落地；各家 harness 的可选项 |
| `references/adapters.md` | Pi / Codex / DSH 各能用到什么程度、怎么装、缺什么 |
| `bin/oia` | 表的维护 + 巡检闹钟（Python 标准库） |
| `bin/oia-web` | 任务板看板：分层看板 + 任务/疑问详情 + 批准/驳回/提问题 |
| `bin/render-worker` | 把 `WORKER.md` 渲染成自定义 agent 定义（可选） |

## 起手（主控）

```bash
export OIA_BOARD=~/Documents/Fuhua/doc_one_is_all/board.md
O=~/Documents/skills/skills/one-is-all/bin/oia
$O init
```

然后读 `LEADER.md`，按它开工。

## 派单时怎么让成员拿到身份

两条路，取决于 harness 能不能让成员读到技能目录；**两条路的内容只有一个来源**（`WORKER.md`）：

1. **能读**：派单里写 `[ROLE member]`，并给路径 `…/one-is-all/WORKER.md`，让成员开工前先读。
2. **读不到**：把 `WORKER.md` 全文贴进任务（`bin/render-worker plain` 直接输出正文）。

两种都行。不要维护第二份工人提示词。

## 交给 harness 决定的事（本 skill 不依赖）

技能继承、项目规范继承、工具集、并发上限、超时、唤醒方式 —— 各家不同，写在 `references/context-profile.md` 的适配附录里，**是建议不是前提**。
skill 本身只保证：无论继承与否，成员拿到 `member.md` 就能按同一套规则干活。

## 常用命令

```bash
oia add --title … --owner … --ref … --deadline +2h   # 建任务
oia start / status / tick / set                      # 开跑、改状态、巡检跳、改字段
oia due / overdue / next / watch                     # 巡检到期、超预算、距下一跳、闹钟
oia ask / ask-done                                   # 「待你定」
oia archive --artifact … --verdict …                  # 归档，停止巡检
oia board / validate                                 # 看表、校验
oia log-add <ID> --from leader --kind verdict --decision approve --text "…"   # 记交互
oia log <ID> --json                                  # 看交互记录
oia answer <QID> --approve 1 --guidance "…"          # 用户批量意见（网页提交用）
oia submitted --json                                 # 待主控处理的用户意见
oia resolve <QID> --text "…"                         # 主控回复并落板

# 看板（只读，自动刷新）
bin/oia-web --port 8791        # 打开 http://127.0.0.1:8791/
```

## 硬规则

1. 同时 `running` ≤ 5；「待你定」≤ 3。
2. 只有主控写表；成员只写 `reports/<ID>.md`。
3. 成员禁止再派 subagent；要帮手就上报，由主控拆单。
4. 没证据的 `DONE` 不算完成；同一任务返修 ≤ 2 次。
5. 归档即停检；用户不点名不复查。
6. 主控禁止同步等待；慢活一律外派或后台。
7. 主控不查项目：读文件、跑状态命令、翻日志一律派单；一轮最多 3 次工具调用。
