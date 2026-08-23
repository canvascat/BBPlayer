# BBPlayer

BBPlayer 是本地优先的 Bilibili 音频播放器。当前仓库交付 macOS 桌面端。

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## 命令

注意，所有命令都应当在项目根目录运行。

```bash
pnpm install                   # Only pnpm — npm/yarn breaks workspace resolution
pnpm desktop                   # 启动桌面端（也可用 vp dev）
vp check                       # 格式化检查 + oxlint
vp lint                        # 仅 lint
vp fmt --write .               # 格式化
vp test                        # 跑 Vitest（Vite+ 内置）
pnpm type-check                # TypeScript type checking
```

不要直接安装或调用 `eslint`、`oxlint`、`oxfmt`、`jest`、`vitest`。用 Vite+ 命令：`vp lint`、`vp fmt`、`vp check`、`vp test`。

## 最佳实践

如果任务涉及 TypeScript / JavaScript，你应当在每个任务完成后都**在项目根目录**运行一次 `vp check`，检查是否引入了新的错误。

## 仓库结构

### /apps

- desktop - macOS 桌面客户端（Electron + React + Vite+）
- docs - 文档网站

### /packages

- core — 搜索策略、BV/AV、歌词解析与行转换
