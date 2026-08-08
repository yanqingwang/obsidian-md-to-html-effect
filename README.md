# MD to HTML Effectiveness

Convert Obsidian Markdown notes to standalone HTML files following the [html-effectiveness](https://github.com/Azhi-ss/html-effectiveness) standard.

将 Obsidian 中的 Markdown 笔记一键转换为符合 [html-effectiveness](https://github.com/Azhi-ss/html-effectiveness) 标准的单文件 HTML。

## What It Solves / 解决的问题

**Problem**: Obsidian notes are locked inside the app. When you want to share a formatted note as a web page, you need to manually convert it.

**问题**：Obsidian 笔记被锁定在应用内。想以网页形式分享格式化笔记时，需要手动转换。

**Solution**: One command converts any .md file to a self-contained .html file:

**方案**：一个命令即可将任意 .md 文件转换为自包含的 .html 文件：

- Same name and folder, just `.html` extension / 同名同目录，仅扩展名变为 .html
- Single-file, no external dependencies / 单文件，无外部依赖
- Dark theme (GitHub-dark inspired), responsive / 深色主题（GitHub-dark 风格），响应式
- Properly formatted: headings, tables, code blocks, lists, links, images / 格式正确：标题、表格、代码块、列表、链接、图片
- Works with `file://` protocol — open directly in any browser / 支持 file:// 协议 —— 可直接在任意浏览器打开

## Features / 功能

- **Convert current note** — command palette → "Convert current note to HTML Effectiveness" / 转换当前笔记 —— 命令面板 → "Convert current note to HTML Effectiveness"
- **Batch convert folder** — convert all new .md files in current folder to .html / 批量转换文件夹 —— 将当前文件夹内所有新的 .md 文件转换为 .html
- **Dark/Light theme** — settings toggle for output theme / 深色/浅色主题 —— 设置中切换输出主题
- **Same path** — output .html file sits next to the .md source / 相同路径 —— 输出的 .html 文件与 .md 源文件同目录

## Usage / 使用

1. Open any .md note in Obsidian / 在 Obsidian 中打开任意 .md 笔记
2. Open command palette → "Convert current note to HTML Effectiveness" / 打开命令面板 → "Convert current note to HTML Effectiveness"
3. A new .html file appears in the same folder / 同目录出现新的 .html 文件

Or batch convert / 或批量转换：

1. Open any .md file in the target folder / 打开目标文件夹内的任意 .md 文件
2. Command palette → "Convert all markdown in folder to HTML" / 命令面板 → "Convert all markdown in folder to HTML"

## Output Format / 输出格式

Single-file HTML with / 单文件 HTML，包含：

- Dark (GitHub-dark) or light theme / 深色（GitHub-dark）或浅色主题
- Inline CSS (no CDN) / 内联 CSS（无 CDN）
- Responsive layout / 响应式布局
- System font stack / 系统字体栈
- Code syntax highlighting via `<pre><code>` / 通过 `<pre><code>` 实现代码语法高亮
- Tables with header styling / 带表头样式的表格
- Proper heading hierarchy / 正确的标题层级

## Commands / 命令

| Command / 命令 | Description / 说明 |
|---------|-------------|
| Convert current note to HTML Effectiveness | Convert active .md to .html / 将当前 .md 转换为 .html |
| Convert all markdown in folder to HTML | Batch convert all new .md in folder / 批量转换文件夹内所有新的 .md |

## Installation / 安装

### From Obsidian Community Plugins / 从 Obsidian 社区插件安装

Settings → Community Plugins → Browse → Search "MD to HTML Effectiveness"

设置 → 社区插件 → 浏览 → 搜索 "MD to HTML Effectiveness"

### Manual / BRAT / 手动安装 / BRAT

1. Install [BRAT](https://obsidian.md/plugins?id=obsidian42-brat) / 安装 BRAT
2. Add repository: `yanqingwang/obsidian-md-to-html-effect` / 添加仓库：`yanqingwang/obsidian-md-to-html-effect`

## Development / 开发

```bash
cd md-to-html-effect-plugin
npm install
npm run dev
npm run build
```

## License / 许可证

MIT

Copyright (c) 2026 rosswang (Heart and Road Ltd)
