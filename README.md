# MD to HTML Effectiveness

将 Obsidian 中的 Markdown 笔记一键转换为符合 [html-effectiveness](https://github.com/Azhi-ss/html-effectiveness) 标准的单文件 HTML。

Convert Obsidian Markdown notes to standalone HTML files following the [html-effectiveness](https://github.com/Azhi-ss/html-effectiveness) standard.

## What It Solves

**Problem**: Obsidian notes are locked inside the app. When you want to share a formatted note as a web page, you need to manually convert it.

**Solution**: One command converts any .md file to a self-contained .html file:
- Same name and folder, just `.html` extension
- Single-file, no external dependencies
- Dark theme (GitHub-dark inspired), responsive
- Properly formatted: headings, tables, code blocks, lists, links, images
- Works with `file://` protocol — open directly in any browser

## Features

- **Convert current note** — command palette → "Convert current note to HTML Effectiveness"
- **Batch convert folder** — convert all new .md files in current folder to .html
- **Dark/Light theme** — settings toggle for output theme
- **Same path** — output .html file sits next to the .md source

## Usage

1. Open any .md note in Obsidian
2. Open command palette → "Convert current note to HTML Effectiveness"
3. A new .html file appears in the same folder

Or batch convert:
1. Open any .md file in the target folder
2. Command palette → "Convert all markdown in folder to HTML"

## Output Format

Single-file HTML with:
- Dark (GitHub-dark) or light theme
- Inline CSS (no CDN)
- Responsive layout
- System font stack
- Code syntax highlighting via `<pre><code>`
- Tables with header styling
- Proper heading hierarchy

## Commands

| Command | Description |
|---------|-------------|
| Convert current note to HTML Effectiveness | Convert active .md to .html |
| Convert all markdown in folder to HTML | Batch convert all new .md in folder |

## Installation

### From Obsidian Community Plugins
Settings → Community Plugins → Browse → Search "MD to HTML Effectiveness"

### Manual / BRAT
1. Install [BRAT](https://obsidian.md/plugins?id=obsidian42-brat)
2. Add repository: `yanqingwang/obsidian-md-to-html-effect`

## Development

```bash
cd md-to-html-effect-plugin
npm install
npm run dev
npm run build
```

## License

MIT
Copyright (c) 2026 rosswang (Heart and Road Ltd)
