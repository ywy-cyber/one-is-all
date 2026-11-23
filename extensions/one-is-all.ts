/**
 * one-is-all leader 守护层（Pi extension）
 *
 * 不再裁剪工具：主控拿全套（read/write/edit/grep/find/ls/bash + oia/exp/watch/subagent）。
 * 只守两条硬规则：
 *   1. 一次用户请求内，超过 5 个 assistant turn 还没结果 → 停手，派给 one-is-all-member；
 *   2. 破坏性/对外动作的派单必须带 [APPROVED]（先呈报、拿到批准）。
 *
 * 子 agent 会话（header 有 parentSession）不受限制。
 * 单次试跑：pi -e <此文件>；默认生效：装进 ~/.pi/agent/extensions/
 * 临时关闭：/leader off（本会话），或 ONE_IS_ALL_LEADER=0。
 */

import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";

const SKILL_DIR =
  process.env.ONE_IS_ALL_SKILL ?? join(import.meta.dirname, "../skills/one-is-all");
const OIA_BIN = join(SKILL_DIR, "bin", "oia");
const EXP_BIN = join(homedir(), "Documents/skills/skills/experience-notes/exp.sh");
const BOARD = process.env.OIA_BOARD ?? join(homedir(), ".one-is-all", "board.md");

const MAX_TURNS_BEFORE_DISPATCH = 5;
// 「亲自干活」的工具：超过 5 轮还不派单，这些就被拦
const WORK_TOOLS = new Set(["read", "write", "edit", "grep", "find", "ls", "bash"]);
// 只看工单动作，不扫贴进来的成员规程。规程里的「删除」会误伤普通派单。
const DESTRUCTIVE = /(?:^|\n)\s*(?:目标|范围)\s*[:：].*(?:\brm\b|删除|清空|清理|覆盖|强推|--force)/i;

type Ctx = { sessionManager?: { getHeader?: () => unknown } };

function isChild(ctx: Ctx): boolean {
  try {
    const header = ctx.sessionManager?.getHeader?.() as Record<string, unknown> | undefined;
    return Boolean(header && (header.parentSession || header.parentSessionId));
  } catch {
    return false;
  }
}

function runBin(bin: string, args: string[], timeout = 30_000): Promise<{ text: string; code: number }> {
  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      { env: { ...process.env, OIA_BOARD: BOARD }, timeout, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        const code =
          typeof (error as { code?: unknown } | null)?.code === "number"
            ? (error as { code: number }).code
            : error
              ? 1
              : 0;
        const text = [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join("\n");
        resolve({ text: text || "(no output)", code });
      },
    );
  });
}

export default function (pi: ExtensionAPI) {
  let watcher: ChildProcess | null = null;
  let enforce = process.env.ONE_IS_ALL_LEADER !== "0";
  let turns = 0;
  let dispatched = false;

  pi.on("before_agent_start", (event, ctx) => {
    if (!enforce || isChild(ctx as Ctx)) return;
    if (event.messageType === "user") {
      turns = 0;
      dispatched = false;
    }
  });

  pi.on("turn_start", (_event, ctx) => {
    if (!enforce || isChild(ctx as Ctx)) return;
    turns += 1;
  });

  pi.registerCommand("leader", {
    description: "开关 one-is-all 守护规则：/leader off 关闭本轮会话的 5 轮派单与 [APPROVED] 闸",
    handler: async (args, ctx) => {
      const off = String(args ?? "").trim().toLowerCase() === "off";
      enforce = !off;
      const text = `one-is-all 守护：${enforce ? "开" : "关"}`;
      if (ctx.hasUI) ctx.ui.notify(text, "info");
      if (process.env.ONE_IS_ALL_DEBUG) console.error(`[one-is-all] ${text}`);
      return text;
    },
  });

  pi.registerTool({
    name: "oia",
    label: "任务总表",
    description:
      "维护 one-is-all 任务总表（board.md）。只读：board、due、overdue、next、show <ID>。写入：add --title <标题> [--owner <成员>] [--ref <runId>] [--deadline +2h] [--state running]；status <ID> <状态>；tick <ID> --ok|--anomaly|--seen；set <ID> --ref/--next/--milestone/--deadline；archive <ID> [--artifact <路径>] [--verdict <结论>]；log-add <ID> --from leader --kind verdict --decision approve|reject|question --text …（记裁决）；submitted --json（待处理的用户意见）；resolve <QID> --text …（回复并落板）。带 ID 的子命令必须写 ID。",
    parameters: Type.Object({
      args: Type.Array(Type.String(), { description: "传给 oia 的参数数组，第一个元素是子命令" }),
    }),
    async execute(_toolCallId, params) {
      const { text, code } = await runBin(OIA_BIN, params.args);
      return {
        content: [{ type: "text", text: `${text}${code ? `\n(exit ${code})` : ""}` }],
        details: { exitCode: code, board: BOARD },
      };
    },
  });

  pi.registerTool({
    name: "exp",
    label: "经验库检索",
    description: '检索工作区经验库（只读）。例：exp({"query":"timeoutMs","any":true})。',
    parameters: Type.Object({
      query: Type.String({ description: "检索词，优先用报错原文、命令、工具名" }),
      any: Type.Optional(Type.Boolean({ description: "true 表示任一词命中即可" })),
    }),
    async execute(_toolCallId, params) {
      const args = ["search", params.query];
      if (params.any) args.push("--any");
      const { text, code } = await runBin(EXP_BIN, args, 20_000);
      return {
        content: [{ type: "text", text: `${text}${code ? `\n(exit ${code})` : ""}` }],
        details: { exitCode: code },
      };
    },
  });

  pi.registerTool({
    name: "watch",
    label: "巡检闹钟",
    description: "挂巡检闹钟：有 running 任务时后台跑 oia watch，到期或异常退出时自动唤醒；无任务时不挂。",
    parameters: Type.Object({}),
    async execute() {
      if (watcher && watcher.exitCode === null) {
        return { content: [{ type: "text", text: "闹钟已在跑。" }], details: { running: true } };
      }
      const probe = await runBin(OIA_BIN, ["next"], 10_000);
      if (probe.code === 3) {
        return {
          content: [{ type: "text", text: "没有可巡检任务（无 running），不挂闹钟。" }],
          details: { running: false },
        };
      }
      watcher = spawn(OIA_BIN, ["watch"], {
        env: { ...process.env, OIA_BOARD: BOARD },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      watcher.stdout?.on("data", (chunk) => (output += String(chunk)));
      watcher.stderr?.on("data", (chunk) => (output += String(chunk)));
      watcher.on("exit", (code) => {
        watcher = null;
        if (code === 3 || /NO-ACTIVE/.test(output)) return;
        const detail = output.trim() || "无输出";
        pi.sendMessage(
          {
            customType: "one-is-all-watch",
            content: `巡检闹钟退出（code ${code}）：${detail}\n按 LEADER.md 第九、十节处理到期任务，再重新挂闹钟。`,
            display: true,
          },
          { triggerTurn: true },
        );
      });
      return {
        content: [{ type: "text", text: "闹钟已挂上；到期或退出时会自动唤醒。" }],
        details: { running: true },
      };
    },
  });

  pi.on("tool_call", (event, ctx) => {
    if (!enforce || isChild(ctx as Ctx)) return;

    if (event.toolName === "bg_delegate" || event.toolName === "bg_run" || event.toolName === "fusion_investigate") {
      return {
        block: true,
        reason: "不要绕过 one-is-all 派单。用 subagent 派给 one-is-all-member，并先 oia add 登记。这条旁路已拦截。",
      };
    }

    if (event.toolName === "subagent") {
      const action = (event.input as { action?: unknown })?.action;
      if (!action) {
        const task = String((event.input as { task?: unknown })?.task ?? "");
        if (DESTRUCTIVE.test(task) && !task.includes("[APPROVED]")) {
          return {
            block: true,
            reason:
              "这张工单的目标或范围包含删除/覆盖/强推。普通派单不需要批准；只有这一步真要做不可逆动作时，先呈报，获准后再带 [APPROVED] 重派。",
          };
        }
        dispatched = true;
      }
      return;
    }

    if (WORK_TOOLS.has(event.toolName) && !dispatched && turns > MAX_TURNS_BEFORE_DISPATCH) {
      return {
        block: true,
        reason: `已经 ${turns} 轮还没结果：停手，把这件事派给 one-is-all-member，不要继续自己磨。`,
      };
    }
  });
}
