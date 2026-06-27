import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder } from 'obsidian';

interface MD2HESettings {
	theme: 'dark' | 'light';
	autoExport: boolean;
}
const DEFAULT_SETTINGS: MD2HESettings = { theme: 'dark', autoExport: false };

function escapeHtml(s: string): string {
	return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const CSS_DARK = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0d1117; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; padding: 24px; max-width: 1000px; margin: 0 auto; line-height: 1.7; }
h1 { color: #58a6ff; font-size: 28px; margin: 32px 0 12px; }
h2 { color: #f0883e; font-size: 22px; margin: 28px 0 10px; border-bottom: 1px solid #30363d; padding-bottom: 8px; }
h3 { color: #d2a8ff; font-size: 17px; margin: 24px 0 8px; }
h4 { color: #8b949e; font-size: 14px; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 1px; }
p { margin: 12px 0; }
a { color: #58a6ff; text-decoration: none; }
a:hover { text-decoration: underline; }
strong { color: #f0f6fc; }
em { color: #c9d1d9; }
code { background: #21262d; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: 'SFMono-Regular', Consolas, monospace; }
pre { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; overflow: auto; margin: 12px 0; }
pre code { background: none; padding: 0; border-radius: 0; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
th { background: #161b22; color: #8b949e; padding: 10px 8px; border-bottom: 1px solid #30363d; text-align: left; font-weight: 600; }
td { padding: 10px 8px; border-bottom: 1px solid #21262d; }
tr:hover { background: #161b22; }
ul, ol { margin: 8px 0; padding-left: 24px; }
li { margin: 4px 0; }
blockquote { border-left: 3px solid #30363d; padding: 8px 16px; margin: 12px 0; color: #8b949e; background: #161b22; border-radius: 0 8px 8px 0; }
img { max-width: 100%; border-radius: 8px; margin: 12px 0; }
hr { border: none; border-top: 1px solid #30363d; margin: 24px 0; }
.meta { color: #8b949e; font-size: 14px; margin-bottom: 24px; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; background: #1f3a5f; color: #58a6ff; margin-right: 4px; }
@media (max-width: 768px) { body { padding: 16px; } }`;

const CSS_LIGHT = CSS_DARK
	.replace(/#0d1117/g, '#ffffff')
	.replace(/#c9d1d9/g, '#1f2328')
	.replace(/#161b22/g, '#f6f8fa')
	.replace(/#30363d/g, '#d0d7de')
	.replace(/#21262d/g, '#e8ecf0')
	.replace(/#58a6ff/g, '#0969da')
	.replace(/#f0883e/g, '#bd561d')
	.replace(/#d2a8ff/g, '#8250df')
	.replace(/#8b949e/g, '#656d76')
	.replace(/#f0f6fc/g, '#1f2328')
	.replace(/#1f3a5f/g, '#ddf4ff');

function mdToHtml(md: string): string {
	const lines = md.split('\n');
	const html: string[] = [];
	let inCode = false;
	let codeLang = '';
	let codeContent: string[] = [];
	let inTable = false;
	let inList: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (inCode) {
			if (line.startsWith('```')) {
				html.push('<pre><code' + (codeLang ? ' class="language-' + escapeHtml(codeLang) + '"' : '') + '>' + escapeHtml(codeContent.join('\n')) + '</code></pre>');
				inCode = false;
				codeLang = '';
				codeContent = [];
				continue;
			}
			codeContent.push(line);
			continue;
		}

		if (line.startsWith('```')) {
			inCode = true;
			codeLang = line.slice(3).trim();
			codeContent = [];
			continue;
		}

		if (line.startsWith('|') && line.endsWith('|')) {
			const cells = line.split('|').filter(c => c.trim());
			if (cells.every(c => /^[-:]+$/.test(c.trim()))) continue;
			html.push('<tr>' + cells.map(c => '<td>' + parseInline(c.trim()) + '</td>').join('') + '</tr>');
			inTable = true;
			continue;
		}
		if (inTable && !line.startsWith('|')) {
			html.push('</tbody></table>');
			inTable = false;
		}
		if (!inTable && line.startsWith('|')) {
			html.push('<table><thead>');
		}

		if (line.startsWith('# ')) {
			html.push('<h1>' + parseInline(line.slice(2).trim()) + '</h1>');
			continue;
		}
		if (line.startsWith('## ')) {
			html.push('<h2>' + parseInline(line.slice(3).trim()) + '</h2>');
			continue;
		}
		if (line.startsWith('### ')) {
			html.push('<h3>' + parseInline(line.slice(4).trim()) + '</h3>');
			continue;
		}
		if (line.startsWith('#### ')) {
			html.push('<h4>' + parseInline(line.slice(5).trim()) + '</h4>');
			continue;
		}

		if (line.startsWith('- ') || line.startsWith('* ')) {
			inList.push('<li>' + parseInline(line.slice(2).trim()) + '</li>');
			continue;
		}
		if (inList.length && line.trim() && !line.startsWith('- ') && !line.startsWith('* ')) {
			html.push('<ul>' + inList.join('') + '</ul>');
			inList = [];
		}
		if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ') || /^\d+\.\s/.test(line)) {
			inList.push('<li>' + parseInline(line.replace(/^\d+\.\s*/, '').trim()) + '</li>');
			continue;
		}

		if (inList.length > 0 && (!line.trim() || line.startsWith('#'))) {
			html.push('<ul>' + inList.join('') + '</ul>');
			inList = [];
		}

		if (line.startsWith('> ')) {
			html.push('<blockquote>' + parseInline(line.slice(2).trim()) + '</blockquote>');
			continue;
		}

		if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
			html.push('<hr>');
			continue;
		}

		if (line.trim() === '') {
			continue;
		}

		html.push('<p>' + parseInline(line) + '</p>');
	}

	if (inCode) {
		html.push('<pre><code>' + escapeHtml(codeContent.join('\n')) + '</code></pre>');
	}
	if (inList.length) {
		html.push('<ul>' + inList.join('') + '</ul>');
	}
	if (inTable) {
		html.push('</tbody></table>');
	}

	return html.join('\n');
}

function parseInline(text: string): string {
	return escapeHtml(text)
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/\*(.+?)\*/g, '<em>$1</em>')
		.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
		.replace(/!\[(.+?)\]\((.+?)\)/g, '<img alt="$1" src="$2">');
}

function buildHtml(title: string, contentHtml: string, theme: string): string {
	const css = theme === 'light' ? CSS_LIGHT : CSS_DARK;
	return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + escapeHtml(title) + '</title>\n<style>\n' + css + '\n</style>\n</head>\n<body>\n<h1>' + escapeHtml(title) + '</h1>\n' + contentHtml + '\n</body>\n</html>';
}

async function convertFile(app: App, file: TFile, theme: string): Promise<void> {
	const content = await app.vault.read(file);
	const htmlContent = mdToHtml(content);
	const title = file.basename;
	const fullHtml = buildHtml(title, htmlContent, theme);
	const outPath = file.parent ? file.parent.path + '/' + title + '.html' : title + '.html';
	await app.vault.create(outPath, fullHtml);
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
					if (!checking) {
						void convertFile(this.app, file, this.settings.theme);
					}
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
			if (o.autoExport === true) this.settings.autoExport = true;
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
		new Setting(containerEl).setName('Output theme').setDesc('Color theme for generated HTML files')
			.addDropdown(d => d.addOption('dark', 'Dark').addOption('light', 'Light')
				.setValue(this.plugin.settings.theme)
				.onChange(async (v) => {
					this.plugin.settings.theme = v as 'dark' | 'light';
					await this.plugin.saveSettings();
				}));
	}
}
