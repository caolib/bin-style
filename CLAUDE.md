# bin-style

Claude Code 插件集合，经 `.claude-plugin/marketplace.json` 发布。

- `user-message-style`：仓库根自身，用户消息边框 + `/ustyle` 面板 → `hooks/user-message.tsx`
- `compact-status`：输入框上方状态栏 → `compact-status/hooks/register.tsx`

两个插件互不依赖，可单独安装。

## 命令

- 测试：`claude plugin test .`（引擎自带测试器；`bun test` 解析不了 `claude-code/testing`）
- 类型检查：`bunx tsc -p tsconfig.json --noEmit`
- 清单校验：`claude plugin validate .`
- 生效：`/reload-plugins`（插件直接读本仓库，无需 install）

## 约定

- `.claude-plugin/types/claude-code/index.d.ts` 是引擎 API 类型快照，按它写，不要臆造 API
- 新增 atom 必须同步 `types/index.d.ts` 的 `PluginState`
- `hooks/hooks.json` 是 hooks 模块入口

## 测试写法

- `on('事件', ...)` 返回该事件的结果对象（如 `{ text, origin }`）；对 `$` 方法的应答才是 `{ value }`
- `$.prompt.submit(...)`、`$.turn.start(...)` 可真实触发插件 hook
- 断言 `await ui.drawn()` 的渲染树

## 引擎边界（已实测）

- 本人消息：UserMessage 无 `from`/`task`
- 排队未发送的消息用入队时现铸 uuid，渲染 props 区分不出来；靠 `prompt.submit` 的 `turnId` 记录文本
- 斜杠命令最终回显、全屏 sticky 行由引擎绘制，hook 看不到
