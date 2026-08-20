---
name: commit-msg
description: 编写 Git 提交说明。当用户要求 commit、撰写或修改 commit message 时使用。
---

# 提交说明

用户明确要求创建提交时才 commit。按仓库 Git 安全约定执行：不改 git config、不跳过 hook、不 force push 到 main/master、不随意 amend。

## 格式

使用 [Conventional Commits](https://www.conventionalcommits.org/)，**描述必须是简体中文**（此为最高优先级）：

```
<type>[optional scope]: <简体中文描述>
```

常用 type：`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`。

## 写法

- 1–2 句，写清**为什么**，不要堆砌改了哪些文件
- 标题不超过 72 个字符，不以句号结尾
- `add` 表示全新能力，`update` 表示增强已有能力，`fix` 表示修 bug
- 不要提交密钥文件（`.env`、`credentials.json` 等）
- 用 HEREDOC 传 message：

```bash
git commit -m "$(cat <<'EOF'
feat(desktop): 用 Vite+ 替换 electron-vite

EOF
)"
```

## 示例

```
feat(desktop): 用 Vite+ 和 vite-plugin-electron 替换 electron-vite
fix(player): 封面请求改 Referer，避免 hdslb 返回 403
chore: 用 Vite+ 的 oxlint/oxfmt 替换 ESLint 与 lefthook
```
