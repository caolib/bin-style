# bin-style

Claude Code 插件集合，通过 `.claude-plugin/marketplace.json` 作为本地或 GitHub marketplace 发布。

## 安装

```
/plugin marketplace add caolib/bin-style
/plugin install user-message-style --marketplace caolib/bin-style
/plugin install compact-status --marketplace caolib/bin-style
```

## 插件

- **user-message-style**：给自己在对话里发的消息加上主题色圆角边框，深色主题下更容易分辨；`/ustyle` 可查看当前设置，边框颜色在 `/config` 里选择主题色。安装后立即生效，不需要额外配置。
- **compact-status**：输入框上方的单行状态栏，显示模型与思考程度、窗口占用、当前上下文与缓存命中率、仓库目录、分支领先/落后与增删行数。`/config` 里切换配色主题，`/status-theme` 预览全部主题，`plain` 主题只使用前景色、不画背景。

两个插件互不依赖，可单独安装。状态栏只读取会话数据和只读 Git 命令，不修改模型、提示词或已有状态栏；它需要 Nerd Font 字体才能正确显示 Powerline 半圆分隔符。

## 使用

安装后在 `/config` 里可以分别调整两个插件的选项：`user-message-style` 提供边框颜色选择，`compact-status` 提供配色主题选择。状态栏每五秒刷新一次 Git 信息，其余数字随会话测量实时更新。

修改插件源码后，重启会话或执行 `/reload-plugins` 让新版本生效。卸载用 `/plugin uninstall <插件名>@bin-style`。

## 许可

MIT，见 [LICENSE](LICENSE)。
