# 任务总表（board.md）

全工作区**只有一张**。主控独占写权限，负责人只读。

```bash
export OIA_BOARD=~/Documents/Fuhua/doc_one_is_all/board.md
O=~/Documents/skills/skills/one-is-all/bin/oia
$O init
```

（不设 `OIA_BOARD` 时默认 `~/.one-is-all/board.md`；建议显式指到 `doc_one_is_all/`，便于跟着工作区走。）

---

## 一、三个区

### 进行中

| ID | 任务 | 状态 | 负责人 | 引用 | 节拍 | 连检 | 上次巡检 | 下次巡检 | 截止 | 最后回执 | 里程碑 | 下一步 | 待定 | 优先级 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

| 列 | 谁写 | 说明 |
|---|---|---|
| `ID` | 命令 | `T01` 起，永不复用 |
| `任务` | 主控 | 一句话，动词开头 |
| `状态` | 命令 | 见 `references/protocol.md` §2 |
| `负责人` | 主控 | 子 agent 的 name；未派写 `-` |
| `引用` | 主控 | Pi 的 run id / Codex 的 thread id / DSH 的 agent id；追问、叫停、对账都靠它 |
| `节拍` | 命令 | 秒。30 / 60 / 300 / 900+ |
| `连检` | 命令 | 连续无异常次数，用于升级 |
| `上次巡检` | 命令 | 自动 |
| `下次巡检` | 命令 | 自动；非巡检状态写 `-` |
| `截止` | 主控 | 业务预算到期时间；超了先发收尾令再停 |
| `最后回执` | 命令 | 负责人最后一次说话的时间 |
| `里程碑` | 主控 | `M1/M2…`，一句话 |
| `下一步` | 主控 | 一句话，给用户看的 |
| `待定` | 主控 | 卡在等谁/等什么 |
| `优先级` | 主控 | `P0/P1/P2` |

### 待你定

| ID | 事项 | 建议 | 默认动作 |
|---|---|---|---|

最多 3 条。`默认动作` 写「你不回我按 … 走」，避免主控卡在等人上。

### 归档

| ID | 任务 | 完成时间 | 产出物 | 验收结论 |
|---|---|---|---|---|

不参与巡检。超过 40 行移入 `archive/YYYY-MM.md`。

---

## 二、命令速查

| 命令 | 作用 |
|---|---|
| `oia init [--force]` | 建空板 |
| `oia add --title … [--owner …] [--ref …] [--deadline +2h] [--priority P1] [--state running]` | 加任务，输出 ID |
| `oia start <ID>` | 置 running，节拍重置 30s |
| `oia tick <ID> --ok` | 正常一跳：连检 +1，按规则升档 |
| `oia tick <ID> --anomaly` | 异常：节拍回落 30s |
| `oia tick <ID> --seen` | 记「最后回执」时间 |
| `oia status <ID> <状态>` | 改状态（自动处理巡检字段） |
| `oia set <ID> [--milestone] [--next] [--pending] [--priority] [--owner] [--ref] [--deadline] [--interval]` | 改内容 |
| `oia ask --item … [--advice …] [--default …]` | 加「待你定」 |
| `oia ask-done <QID>` | 清「待你定」 |
| `oia archive <ID> [--artifact …] [--verdict …]` | 归档 |
| `oia due [--json]` | 到巡检点的任务；无则退出码 3 |
| `oia overdue [--json]` | 超预算的任务；无则退出码 3 |
| `oia next [--json]` | 距下一跳秒数；无则退出码 3 |
| `oia watch` | **闹钟**：到点退出（退出即唤醒主控） |
| `oia board` / `oia show <ID>` | 看表 |
| `oia validate` | 校验列数与格式 |

退出码：`0` 正常、`2` 用法/校验错、`3` 无到期、`4` 找不到任务。

---

## 三、节拍

```
派单 → 30s ──3 次正常──► 60s ──5 次正常──► 300s ──3 次正常──► 900s（可自定义）
        ▲                                                           │
        └──────────────────── 任何异常 ─────────────────────────────┘
```

不巡检的状态：`queued` / `waiting_you` / `review` / `paused` / `dropped` / 归档。
`blocked` 巡检，但节拍不低于 900s。

---

## 四、闹钟怎么挂

主控在后台起：

```bash
$O watch --board "$OIA_BOARD"
```

- 进程退出 = 主控被唤醒（`DUE T01,T02`）。
- 主控处理完重新挂一个；表一变先停旧的。
- 没有可巡检任务时立即 `NO-ACTIVE` 退出，不空转。

---

## 五、手改的边界

`board.md` 由 `oia` 整体重写。手改只允许临时救急，改完必须：

```bash
$O validate
```

列数不对、时间格式不对、状态不合法都会被 `validate` 拦下。别绕过它。

---

## 六、一次完整的生命周期

```bash
$O add --title "跑通 cap5 评测" --owner ag-3f --priority P1   # → T01
$O start T01
$O set T01 --milestone M1 --next "等首轮回执"

# 负责人回执到了
$O tick T01 --seen
$O set T01 --milestone M2 --next "等汇总"

# 巡检
$O due
$O tick T01 --ok

# 完成
$O status T01 review
$O archive T01 --artifact reports/cap5-summary.md --verdict "三分片有数，总数一致"
```
