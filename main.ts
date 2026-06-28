import { App, Plugin, PluginSettingTab, Setting, Notice, TFile } from 'obsidian';

interface MD2HESettings { theme: 'dark' | 'light'; }
const DEFAULT_SETTINGS: MD2HESettings = { theme: 'dark' };

function escapeHtml(s: string): string {
	return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const CSS_DARK = `
* { margin:0;padding:0;box-sizing:border-box; }
body { background:#0d1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;padding:24px;max-width:1100px;margin:0 auto;line-height:1.7;font-size:15px;transition:all 0.2s; }
body.light { background:#ffffff;color:#1f2328; }
body.light h1 { color:#0969da; }
body.light h2 { color:#bd561d;border-bottom-color:#d0d7de; }
body.light h3 { color:#8250df; }
body.light code { background:#e8ecf0; }
body.light pre { background:#f6f8fa;border-color:#d0d7de; }
body.light th { background:#f6f8fa;color:#656d76; }
body.light td { border-bottom-color:#d0d7de; }
body.light tr:hover td { background:#f0f2f5; }
body.light blockquote { background:#f6f8fa;color:#656d76; }
body.light strong { color:#1f2328; }

.theme-toggle { position:fixed;top:12px;right:12px;z-index:999;background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px; }
.theme-toggle:hover { background:#30363d; }
body.light .theme-toggle { background:#e8ecf0;border-color:#d0d7de;color:#1f2328; }
body.light .theme-toggle:hover { background:#d0d7de; }

h1 { color:#58a6ff;font-size:30px;margin:36px 0 4px;letter-spacing:-0.5px; }
h2 { color:#f0883e;font-size:22px;margin:32px 0 12px;border-bottom:2px solid #30363d;padding-bottom:8px; }
h3 { color:#d2a8ff;font-size:17px;margin:24px 0 10px; }
h4 { color:#8b949e;font-size:14px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:1px; }

p { margin:10px 0; }
a { color:#58a6ff;text-decoration:none; }
a:hover { text-decoration:underline; }
strong { color:#f0f6fc; }
em { color:#e6edf3; }
del,s { text-decoration:line-through;color:#8b949e; }

code { background:#21262d;padding:2px 7px;border-radius:4px;font-size:0.88em;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace; }
pre { background:#161b22;border:1px solid #30363d;border-radius:8px;padding:18px;overflow-x:auto;margin:14px 0;line-height:1.5; }
pre code { background:none;padding:0;border-radius:0;font-size:0.88em; }

table { width:100%;border-collapse:collapse;margin:14px 0;font-size:14px; }
thead { border-bottom:2px solid #30363d; }
th { background:#161b22;color:#8b949e;padding:10px 12px;text-align:left;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.5px; }
td { padding:10px 12px;border-bottom:1px solid #21262d;vertical-align:top; }
tr:last-child td { border-bottom:none; }
tr:hover td { background:#1c2128; }

ul,ol { margin:8px 0;padding-left:26px; }
li { margin:5px 0;line-height:1.6; }

blockquote { border-left:3px solid #58a6ff;padding:10px 20px;margin:14px 0;color:#8b949e;background:#161b22;border-radius:0 8px 8px 0;font-size:14px; }
img { max-width:100%;border-radius:8px;margin:16px 0;border:1px solid #30363d; }
hr { border:none;border-top:1px solid #30363d;margin:28px 0; }

.subtitle { color:#8b949e;font-size:14px;margin-bottom:24px; }
@media (max-width:768px) { body { padding:16px; } }
@media print { body { background:#fff;color:#222; } body.light { background:#fff;color:#222; } .theme-toggle { display:none; } }
`;

function stripFrontmatter(lines: string[]): string[] {
	if (lines.length > 0 && lines[0].trim() === '---') {
		for (let i = 1; i < lines.length; i++) {
			if (lines[i].trim() === '---') {
				return lines.slice(i + 1);
			}
		}
	}
	return lines;
}

function mdToHtml(md: string): string {
	let lines = md.split('\n');
	lines = stripFrontmatter(lines);
	const html: string[] = [];
	let inCode = false, codeLang = '', codeContent: string[] = [];
	let inTableHeader = true;
	let inList: string[] = [];
	let listType = '';
	let tableOpen = false;

	function flushList(): void {
		if (inList.length) {
			html.push('<' + listType + '>' + inList.join('') + '</' + listType + '>');
			inList = []; listType = '';
		}
	}
	function flushTable(): void {
		if (tableOpen) { html.push('</tbody></table>'); tableOpen = false; }
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (inCode) {
			if (line.startsWith('```')) {
				html.push('<pre><code' + (codeLang ? ' class="language-' + escapeHtml(codeLang) + '"' : '') + '>' + escapeHtml(codeContent.join('\n')) + '</code></pre>');
				inCode = false; codeLang = ''; codeContent = [];
				continue;
			}
			codeContent.push(line); continue;
		}
		if (line.startsWith('```')) { inCode = true; codeLang = line.slice(3).trim(); codeContent = []; continue; }

		if (line.startsWith('|') && line.endsWith('|')) {
			flushList();
			const cells = line.split('|').filter(c => c.trim());
			if (cells.length && cells.every(c => /^[-:]+$/.test(c.trim()))) { inTableHeader = false; continue; }
			if (!tableOpen) { html.push('<table>'); tableOpen = true; inTableHeader = true; }
			const tag = inTableHeader ? 'th' : 'td';
			if (inTableHeader) {
				html.push('<thead><tr>' + cells.map(c => '<th>' + parseInline(c.trim()) + '</th>').join('') + '</tr></thead><tbody>');
				inTableHeader = false;
			} else {
				html.push('<tr>' + cells.map(c => '<td>' + parseInline(c.trim()) + '</td>').join('') + '</tr>');
			}
			continue;
		}
		if (line.trim() === '---' && tableOpen) { flushTable(); continue; }
		flushTable();

		if (line.startsWith('# ')) { flushList(); html.push('<h1>' + parseInline(line.slice(2).trim()) + '</h1>'); continue; }
		if (line.startsWith('## ')) { flushList(); html.push('<h2>' + parseInline(line.slice(3).trim()) + '</h2>'); continue; }
		if (line.startsWith('### ')) { flushList(); html.push('<h3>' + parseInline(line.slice(4).trim()) + '</h3>'); continue; }
		if (line.startsWith('#### ')) { flushList(); html.push('<h4>' + parseInline(line.slice(5).trim()) + '</h4>'); continue; }

		if (line.startsWith('- ') || line.startsWith('* ')) {
			if (listType !== 'ul') { flushList(); listType = 'ul'; }
			inList.push('<li>' + parseInline(line.slice(2).trim()) + '</li>'); continue;
		}
		if (/^\d+\.\s/.test(line)) {
			if (listType !== 'ol') { flushList(); listType = 'ol'; }
			inList.push('<li>' + parseInline(line.replace(/^\d+\.\s*/, '').trim()) + '</li>'); continue;
		}

		if (inList.length && (!line.trim() || line.startsWith('#'))) { flushList(); }

		if (line.startsWith('> ')) { flushList(); html.push('<blockquote>' + parseInline(line.slice(2).trim()) + '</blockquote>'); continue; }
		if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') { flushList(); html.push('<hr>'); continue; }
		if (line.trim() === '') { continue; }

		const trimmed = line.trim();
		if (/^\d+[%\$].*/.test(trimmed) || /^-?\$?\d+(\.\d+)?[%MBT]?[xX]/.test(trimmed)) {
			html.push('<p><strong>' + parseInline(line) + '</strong></p>');
		} else {
			html.push('<p>' + parseInline(line) + '</p>');
		}
	}

	flushList(); flushTable();
	if (inCode) html.push('<pre><code>' + escapeHtml(codeContent.join('\n')) + '</code></pre>');
	return html.join('\n');
}

function parseInline(text: string): string {
	let s = escapeHtml(text);
	s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
	s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
	s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
	s = s.replace(/_(.+?)_/g, '<em>$1</em>');
	s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
	s = s.replace(/!\[(.+?)\]\((.+?)\)/g, '<img alt="$1" src="$2">');
	s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '<a href="$1">$2' + (s.includes('$2') ? '' : '$1') + '</a>');
	s = s.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
	return s;
}

function buildHtml(title: string, bodyHtml: string, theme: string): string {
	const css = CSS_DARK;
	const now = new Date().toISOString().split('T')[0];
	return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + escapeHtml(title) + '</title>\n<style>\n' + css + '\n</style>\n</head>\n<body' + (theme === 'light' ? ' class="light"' : '') + '>\n<button class="theme-toggle" onclick="document.body.classList.toggle(\'light\')">\u2601 Switch Theme</button>\n<div class="subtitle">' + now + ' &middot; Generated by MD to HTML Effectiveness</div>\n' + bodyHtml + '\n</body>\n</html>';
}

async function convertFile(app: App, file: TFile, theme: string): Promise<void> {
	const content = await app.vault.read(file);
	const htmlContent = mdToHtml(content);
	const outPath = file.parent ? file.parent.path + '/' + file.basename + '.html' : file.basename + '.html';
	if (app.vault.getFileByPath(outPath)) {
		new Notice('HTML file already exists: ' + outPath);
		return;
	}
	await app.vault.create(outPath, buildHtml(file.basename, htmlContent, theme));
	new Notice('Converted: ' + outPath);
}

export default class MD2HEPlugin extends Plugin {
	settings: MD2HESettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addCommand({
			id: 'convert-md-to-html',
			name: 'Convert current note to HTML Effectiveness',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (file && file.extension === 'md') {
					if (!checking) void convertFile(this.app, file, this.settings.theme);
					return true;
				}
				return false;
			}
		});
		this.addCommand({
			id: 'convert-batch-md-to-html',
			name: 'Convert all markdown in folder to HTML',
			callback: async () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) { new Notice('Open a file in the folder to convert'); return; }
				const folder = file.parent;
				if (!folder) { new Notice('Cannot determine folder'); return; }
				const mdFiles = folder.children.filter(c => c instanceof TFile && c.extension === 'md') as TFile[];
				let count = 0;
				for (const f of mdFiles) {
					const outPath = folder.path + '/' + f.basename + '.html';
					if (this.app.vault.getFileByPath(outPath)) continue;
					await convertFile(this.app, f, this.settings.theme);
					count++;
				}
				new Notice('Converted ' + count + ' files in ' + folder.name);
			}
		});
		this.addSettingTab(new MD2HESettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		if (data && typeof data === 'object') {
			const o = data as Record<string, unknown>;
			if (o.theme === 'light') this.settings.theme = 'light';
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

class MD2HESettingTab extends PluginSettingTab {
	plugin: MD2HEPlugin;
	constructor(app: App, plugin: MD2HEPlugin) { super(app, plugin); this.plugin = plugin; }
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl).setName('Display').setHeading();
		new Setting(containerEl).setName('Output theme').setDesc('Color theme for generated HTML')
			.addDropdown(d => d.addOption('dark', 'Dark').addOption('light', 'Light')
				.setValue(this.plugin.settings.theme)
				.onChange(async (v) => {
					this.plugin.settings.theme = v as 'dark' | 'light';
					await this.plugin.saveSettings();
				}));
	}
}
