# B 站网页登录设计

日期：2026-08-29  
范围：`packages/main` 登录窗与 Cookie 采集；`packages/renderer` 设置页入口

## 目标

用 Electron 子窗口打开 `https://www.bilibili.com/`，点击页头登录打开官方弹层，用户在官网完成扫码 / 密码 / 短信 / 第三方登录。主进程从隔离 session 读取 Cookie，写成现有的 Cookie 请求头，写入 `electron-store`，再走 `refreshAccount()`。

成功标准：

- 设置页未登录时只有「连接 Bilibili」，不再展示自研二维码、手机号或 Cookie 粘贴
- 登录成功后资料卡、UID、收藏夹 / 合集 / 稍后再看与今天扫码成功后一致
- `SESSDATA` 为 HttpOnly：成功判定只走 `session.cookies`，不读页面 `document.cookie`
- 登录窗不挂 BBPlayer preload
- 官方弹层关闭按钮用 CSS 隐藏；Electron 登录窗 `closable: false`，成功后由主进程关窗
- `vp check`、`vp test`、`pnpm type-check` 通过

## 非目标

- 不改播放、搜索、下载、歌词
- 本轮不删 `auth.qrStart` / `auth.phoneStart` / `auth.phoneLogin` / 极验窗实现，只是设置页不再调用
- 不上 `safeStorage`
- 不做首次打开引导、不做 BBPlayer 自有账号
- 不把主进程 `fetch` 改成走 Electron session；API 仍用 Cookie 头
- 不提供 Cookie 粘贴 / 编辑；渲染进程设置页不再读写 Cookie 明文。`settings.set` 的 `cookie` 字段可留着，UI 不调用

## 背景

2026-08-29 在官网实测：

- 未登录页头入口为 `.header-login-entry`（外层 `.go-login-btn`），`.click()` 弹出 `.bili-mini-mask`
- 弹层约 820×430，左侧二维码为页面内 `<img data URL>`，右侧密码 / 短信 / 微信微博 QQ
- 弹层不是 iframe
- 登录凭证：`SESSDATA`（HttpOnly）、`bili_jct`（CSRF）、`DedeUserID`；`buvid3` / `buvid4` 建议一并保存

对照 r-music 网易云做法：开子窗口加载官网、点登录、听 Cookie。B 站应对齐其思路，但必须避开：默认 session 串号、`cookies.get({})` 不过滤域名、单字段立刻成功、关窗 `reject` 覆盖已成功的 Promise、OAuth 一律 `openExternal`。

## 架构

```
设置页「连接 Bilibili」
        │
        ▼
  auth.webStart
        │
        ├─ persist:bili-login 已有完整 Cookie 且 nav 校验通过
        │     → 写入 store → 返回账号（不开窗）
        │
        ▼
  BrowserWindow（partition persist:bili-login，Chrome UA，无 preload）
  load https://www.bilibili.com/
        │
        ├─ 没有 .header-login-entry → 视为已登录，收 Cookie
        ├─ 有入口 → click，注入 CSS 只留弹层
        └─ 找不到入口 → 改 load https://passport.bilibili.com/login
        │
        ▼
  cookies.changed debounce 400ms
  凑齐 SESSDATA + bili_jct + DedeUserID
        │
        ▼
  getAccount(cookieHeader) 非空
        │
        ▼
  store.cookie + refreshAccount → 关窗
```

主进程 `biliFetch` 不使用该 partition。登录窗只负责把 Cookie 变成与今天扫码/短信相同的 `name=value; ...` 头。

## 组件

### Cookie 纯函数（`web-login-cookies.ts`）

不依赖 Electron，供单测：

- `REQUIRED_LOGIN_COOKIES`：`['SESSDATA', 'bili_jct', 'DedeUserID']`
- `isCompleteBiliLoginCookies(cookies)`：三个字段都有非空 value
- `electronCookiesToHeader(cookies)`：只保留 `domain` 含 `bilibili.com` 的项（无 domain 则保留）；同名后者覆盖；输出 `a=b; c=d`
- `isAllowedLoginPopupUrl(url)`：hostname 为 `bilibili.com` 或其子域，或 `weixin.qq.com` / `qq.com` 及其子域，或 `weibo.com` 及其子域
- 常量：`BILI_WEB_LOGIN_PARTITION = 'persist:bili-login'`、`BILI_HOME_URL`、`BILI_PASSPORT_LOGIN_URL`、`LOGIN_ENTRY_SELECTOR = '.header-login-entry'`、`COOKIE_DEBOUNCE_MS = 400`、弹层 CSS、桌面 Chrome UA（与 `bili.ts` 的 `UA` 相同字符串）

### 登录窗（`web-login.ts`）

`openWebLogin({ parent, verifyAccount }) => Promise<string>`

1. 先 `peek`：从 partition 取 Cookie，完整且 `verifyAccount(header)` 为真则直接返回，不开窗。
2. 否则开 880×520 子窗，`parent` 为主窗，`modal: true`，**`closable: false`**（CSS 藏不掉红绿灯）。`webPreferences.partition` 为 `persist:bili-login`，**不设 preload**。对该 session `setUserAgent` 为桌面 Chrome UA。登录成功后主进程 `win.close()` 仍可关窗。
3. `setWindowOpenHandler`：`isAllowedLoginPopupUrl` 为真则 `allow` 并指定同一 partition；否则 `deny`。第三方登录必须留在 Electron 里，不能 `shell.openExternal`。
4. 加载首页。`did-finish-load` 后若 Cookie 已完整并校验通过，关窗返回。否则对 `.header-login-entry` 执行 `click()`；成功则 `insertCSS`：把 `.bili-mini-mask` 的兄弟节点 `visibility: hidden`，遮罩自身可见、背景白色，**隐藏 `.bili-mini-close-icon`**。找不到入口则改加载通行证登录页。随后 `show()`。
5. 监听 `session.cookies` 的 `changed`。忽略 `removed`。目标字段变化后 debounce 400ms，再 `cookies.get({ url: BILI_HOME_URL })`。完整则转成头、`verifyAccount`，通过才 resolve。
6. 用 `settled` 保证只结算一次。成功后的 `closed` 不得再 reject。窗口在正常路径不可关；若仍被系统强制关掉，视为 `已取消登录`。
7. 重复调用时若窗还在，聚焦已有窗口，不要开第二扇。

`clearBiliLoginSession()`：`session.fromPartition(persist:bili-login).clearStorageData({ storages: ['cookies'] })`。

### tRPC

`TrpcContext` 增加：

- `openWebLogin: () => Promise<string>`
- `clearBiliLoginSession: () => Promise<void>`

`auth.webStart`：调用 `openWebLogin`，`store.set('cookie', header)`，`refreshAccount()`，返回 `{ cookie, account }`（形状与 `phoneLogin` 相同）。

`auth.logout`：现有清空 store / WBI / 停扫码之外，`await clearBiliLoginSession()`。

`auth.qrStart`、`phoneStart`、`phoneLogin`、`completeGeetest`、`qrUpdates` 本轮保留。

### 设置页

未登录：按钮「连接 Bilibili」（进行中为「登录中…」）和失败/取消文案。已登录：资料卡 +「退出登录」，不显示连接按钮。

文案：「在官方页面登录后可打开收藏夹、合集和稍后再看。」

删除设置页对 `PhoneLogin`、扫码图、Cookie 文本框、`auth.qrStart`、`auth.qrUpdates` 的引用；可删除 `PhoneLogin.tsx`。渲染进程不再把 Cookie 放进 state，`settings.set` 保存其它选项时不带 `cookie`。`logout` 不再清理二维码本地 state。

## 错误处理

| 情况                        | 行为                                         |
| --------------------------- | -------------------------------------------- |
| 官方弹层右上角关闭          | CSS 隐藏 `.bili-mini-close-icon`，用户点不到 |
| 点登录选择器失败            | 改加载通行证页，不抛错                       |
| CSS 注入失败                | 仍显示完整首页，登录可用；关闭按钮可能仍可见 |
| Cookie 齐但 `getAccount` 空 | 继续等，直到校验通过或进程退出               |
| 分区里已有有效 Cookie       | 不开窗，直接写入 store                       |
| 窗口仍被系统强制关掉        | `已取消登录`，设置页展示该文案               |

## 测试

自动：

- `isCompleteBiliLoginCookies`：缺任一字段为假；三个都有为真
- `electronCookiesToHeader`：过滤非 bili 域、同名覆盖、拼头
- `isAllowedLoginPopupUrl`：官网 / 微信 / QQ / 微博允许，其它拒绝
- `auth.webStart`：mock `openWebLogin` 返回头后写入 store 并 `refreshAccount`
- `auth.logout`：调用 `clearBiliLoginSession`

手动（实现后）：设置页连接 → 弹层无关闭按钮、窗口红绿灯不可关 → 扫码成功 → 资料卡与收藏夹；已登录再点退出后重新连接；设置页没有 Cookie 输入框。

## 风险

- 首页 class 改版：点击失败回退通行证页；CSS 失败则展示完整首页
- Electron 默认 UA 含 Electron：partition 上覆盖 Chrome UA
- 微信/QQ 必须同 partition 子窗，不能外开系统浏览器
- 登录窗若挂 preload，等于把主进程桥暴露给 bili.com
