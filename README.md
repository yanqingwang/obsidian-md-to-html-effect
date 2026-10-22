# MD to HTML Effectiveness

[English](#english) | [中文](#中文)

## English

Convert Obsidian Markdown notes to standalone HTML files following the [html-effectiveness](https://github.com/Azhi-ss/html-effectiveness) standard.

### What It Solves

Obsidian notes are locked inside the app. When you want to share a formatted note as a web page, you normally have to convert it by hand. This plugin adds a command that turns the active note into an `.html` file next to the source note.

### Features

- **Convert current note** — command palette → "Convert current note to HTML Effectiveness"
- **Batch convert folder** — convert all new `.md` files in the current folder
- **Output theme** — Dark, Light, or Auto; Auto follows the current Obsidian theme when you convert
- **Same folder output** — the `.html` file is written next to the `.md` source
- **Markdown images** — supports `![alt](path)`, titles, and Obsidian size syntax `![alt|300](path)`
- **Obsidian image embeds** — supports `![[image.png]]`, `![[image.png|300]]`, and `![[image.png|300x200]]`
- **Self-contained images** — local vault images, including `![[...]]` embeds, are embedded as base64 data URIs
- **Tables** — optional outer pipes, empty cells, escaped pipes, alignment, inline code, and images inside cells
- **Mermaid diagrams** — rendered to inline SVG during conversion; invalid diagrams fall back to source code
- **Common Markdown** — headings, lists, blockquotes, code blocks, links, wiki-links, bold, italic, and strikethrough

### Requirements

- Obsidian 1.7.0 or newer
- Desktop or mobile

### Installation

#### Community plugins

Settings → Community plugins → Browse → search "MD to HTML Effectiveness".

#### Manual / BRAT

1. Install [BRAT](https://obsidian.md/plugins?id=obsidian42-brat).
2. Add repository: `yanqingwang/obsidian-md-to-html-effect`.

### Usage

1. Open a Markdown note.
2. Open the command palette and run "Convert current note to HTML Effectiveness".
3. The generated `.html` file appears in the same folder.

To convert a folder, open any note in that folder and run "Convert all markdown in folder to HTML". Existing `.html` files are skipped, so delete an old output before converting again.

Local images are embedded into the HTML as data URIs, so the generated file can be moved independently. External image URLs remain as URLs and still require network access. Notes with many images produce larger HTML files.

### Output

The generated file contains inline CSS, no external scripts, and a responsive light or dark theme. With Auto, the theme is captured from Obsidian at conversion time; changing the Obsidian theme later does not modify existing HTML, so reconvert to update it. Local images are embedded as data URIs, so the HTML is self-contained apart from external image URLs. Tables use proper `<thead>` / `<tbody>` markup, and image dimensions from Obsidian embeds are preserved. Mermaid diagrams are converted to inline SVG, so the HTML does not need a Mermaid runtime.

### Development

```bash
npm install
npm run build
node test-convert.js
```

### Feedback

- GitHub Issues: https://github.com/yanqingwang/obsidian-md-to-html-effect/issues
- Email: 289631530@qq.com

When reporting a problem, please include your Obsidian version, plugin version, a description or screenshot, and the expected result.

### License

MIT

Copyright (c) 2026 rosswang (Heart and Road Ltd)

## 中文

将 Obsidian 中的 Markdown 笔记转换为符合 [html-effectiveness](https://github.com/Azhi-ss/html-effectiveness) 标准的独立 HTML 文件。

### 解决的问题

Obsidian 笔记被锁定在应用内。想以网页形式分享格式化笔记时，通常需要手动转换。本插件提供一个命令，把当前笔记转换成同目录下的 `.html` 文件。

### 功能

- **转换当前笔记** —— 命令面板 → "Convert current note to HTML Effectiveness"
- **批量转换文件夹** —— 转换当前文件夹内所有新的 `.md` 文件
- **输出主题** —— 深色、浅色或自动；自动模式在转换时跟随 Obsidian 当前主题
- **同目录输出** —— `.html` 文件与 `.md` 源文件位于同一文件夹
- **Markdown 图片** —— 支持 `![alt](path)`、标题，以及 Obsidian 尺寸语法 `![alt|300](path)`
- **Obsidian 图片嵌入** —— 支持 `![[image.png]]`、`![[image.png|300]]`、`![[image.png|300x200]]`
- **图片内嵌** —— 本地 vault 图片（包括 `![[...]]` 嵌入）会以 base64 data URI 写入 HTML
- **表格** —— 支持省略外侧竖线、空单元格、转义竖线、对齐、行内代码和单元格内图片
- **Mermaid 图表** —— 转换时渲染为内联 SVG；无效图表回退为源代码
- **常用 Markdown** —— 标题、列表、引用、代码块、链接、wiki 链接、加粗、斜体和删除线

### 系统要求

- Obsidian 1.7.0 或更高版本
- 桌面端或移动端

### 安装

#### 社区插件市场

设置 → 社区插件 → 浏览 → 搜索 "MD to HTML Effectiveness"。

#### 手动安装 / BRAT

1. 安装 [BRAT](https://obsidian.md/plugins?id=obsidian42-brat)。
2. 添加仓库：`yanqingwang/obsidian-md-to-html-effect`。

### 使用

1. 打开一个 Markdown 笔记。
2. 打开命令面板，运行 "Convert current note to HTML Effectiveness"。
3. 同目录下会生成 `.html` 文件。

批量转换：打开目标文件夹内任意笔记，运行 "Convert all markdown in folder to HTML"。已存在的 `.html` 会被跳过，需要重新转换时请先删除旧文件。

本地图片会以 data URI 内嵌到 HTML 中，因此生成的文件可以单独移动。外链图片仍保留原始 URL，需要联网加载。图片较多时 HTML 文件会相应变大。

### 输出

生成的文件包含内联 CSS，不依赖外部脚本，并提供响应式深色或浅色主题。选择自动模式时，主题会在转换时从 Obsidian 读取；之后更改 Obsidian 主题不会修改已经生成的 HTML，需要重新转换。本地图片会以 data URI 内嵌，因此除了外链图片之外，HTML 是自包含的。表格使用正确的 `<thead>` / `<tbody>` 结构，Obsidian 图片嵌入中的宽高设置会保留。Mermaid 图表会转换为内联 SVG，因此 HTML 不需要额外的 Mermaid 运行时。

### 开发

```bash
npm install
npm run build
node test-convert.js
```

### 问题反馈

- GitHub Issues：https://github.com/yanqingwang/obsidian-md-to-html-effect/issues
- 邮箱：289631530@qq.com

反馈时请尽量提供：Obsidian 版本、插件版本、问题描述或截图、预期结果。

### 许可证

MIT

Copyright (c) 2026 rosswang (Heart and Road Ltd)

[回到顶部](#md-to-html-effectiveness) | [English](#english)
