# pi-one-is-all

把每个 Pi 会话变成主控。主控负责派单、验收、记账；具体的活交给 `one-is-all-member`。

这个包只登记自己的扩展和 skill。它不改 Pi 的全局工具设置，不替换别人的插件，不写 `~/.pi/agent/extensions/`。

## 安装

```bash
pi install /absolute/path/to/pi-one-is-all
```

装好后新开一个 Pi 会话。`/skill:one-is-all` 能读到规程。临时关掉守护：

```bash
ONE_IS_ALL_LEADER=0 pi
```

会话内也可以 `/leader off`，`/leader on` 再打开。

## 卸载

```bash
pi remove /absolute/path/to/pi-one-is-all
```

任务表留在 `~/.one-is-all/board.md`，卸载不会删它。

## 看板

```bash
node skills/one-is-all/bin/oia-web --port 8792
```

打开 <http://127.0.0.1:8792/>。

## 和别的插件

- `pi-subagents` 仍负责派子会话。本包只是调用它的 `subagent` 工具。
- 不可逆动作只看工单的「目标 / 范围」，不会因为规程正文里出现「删除」就拦截普通派单。
- `bg_delegate`、`bg_run`、`fusion_investigate` 会被拦住，避免绕过派单。
