import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, loadMermaid, type SettingDefinitionItem } from 'obsidian';

type OutputTheme = 'dark' | 'light';
type ThemeSetting = OutputTheme | 'auto';
interface MD2HESettings { theme: ThemeSetting; }
const DEFAULT_SETTINGS: MD2HESettings = { theme: 'auto' };

function resolveOutputTheme(theme: ThemeSetting, isDark = document.body.classList.contains('theme-dark')): OutputTheme {
	if (theme === 'auto') return isDark ? 'dark' : 'light';
	return theme;
}

function escapeHtml(s: string): string {
	return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const CSS_DARK = `
* { margin:0;padding:0;box-sizing:border-box; }
body { background:#0d1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;padding:24px;max-width:1000px;margin:0 auto;line-height:1.7; }
h1 { color:#58a6ff;font-size:28px;margin:32px 0 12px; }
h2 { color:#f0883e;font-size:22px;margin:28px 0 10px;border-bottom:1px solid #30363d;padding-bottom:8px; }
h3 { color:#d2a8ff;font-size:17px;margin:24px 0 8px; }
a { color:#58a6ff;text-decoration:none; }
a:hover { text-decoration:underline; }
strong { color:#f0f6fc; }
code { background:#21262d;padding:2px 6px;border-radius:4px;font-size:.9em;font-family:'SFMono-Regular',Consolas,monospace; }
pre { background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;overflow:auto;margin:12px 0; }
pre code { background:none;padding:0;border-radius:0; }
table { width:100%;border-collapse:collapse;margin:12px 0;font-size:14px; }
th { background:#161b22;color:#8b949e;padding:10px 8px;border-bottom:1px solid #30363d;text-align:left;font-weight:600; }
td { padding:10px 8px;border-bottom:1px solid #21262d; }
tr:hover { background:#161b22; }
ul,ol { margin:8px 0;padding-left:24px; }
li { margin:4px 0; }
blockquote { border-left:3px solid #30363d;padding:8px 16px;margin:12px 0;color:#8b949e;background:#161b22;border-radius:0 8px 8px 0; }
img { max-width:100%;border-radius:8px;margin:12px 0; }
.mermaid-diagram { margin:16px 0;text-align:center;overflow-x:auto; }
.mermaid-diagram svg { max-width:100%;height:auto; }
hr { border:none;border-top:1px solid #30363d;margin:24px 0; }
p { margin:12px 0; }
@media (max-width:768px){body{padding:16px;}}`;

const CSS_LIGHT = CSS_DARK
	.replace(/#0d1117/g,'#ffffff').replace(/#c9d1d9/g,'#1f2328')
	.replace(/#161b22/g,'#f6f8fa').replace(/#30363d/g,'#d0d7de')
	.replace(/#21262d/g,'#e8ecf0').replace(/#58a6ff/g,'#0969da')
	.replace(/#f0883e/g,'#bd561d').replace(/#d2a8ff/g,'#8250df')
	.replace(/#8b949e/g,'#656d76').replace(/#f0f6fc/g,'#1f2328');

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

type ImageResolver = (src: string) => string;

interface ImageInfo {
	alt: string;
	src: string;
	width?: string;
	height?: string;
	title?: string;
}

interface LinkInfo {
	label: string;
	href: string;
	title?: string;
}

function isExternalUrl(src: string): boolean {
	return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src.trim());
}

function encodeLocalPath(src: string): string {
	const hashIndex = src.indexOf('#');
	const pathPart = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
	const suffix = hashIndex >= 0 ? src.slice(hashIndex) : '';
	const encoded = pathPart.split('/').map(segment => {
		if (!segment || segment === '.' || segment === '..') return segment;
		try {
			return encodeURIComponent(decodeURIComponent(segment));
		} catch {
			return encodeURIComponent(segment);
		}
	}).join('/');
	return encoded + suffix;
}

function relativePath(fromDir: string, toPath: string): string {
	const from = fromDir.split('/').filter(Boolean);
	const to = toPath.split('/').filter(Boolean);
	let common = 0;
	while (common < from.length && common < to.length && from[common] === to[common]) common++;
	const parts = from.slice(common).map(() => '..');
	parts.push(...to.slice(common));
	return parts.join('/');
}

function normalizeVaultPath(path: string): string {
	const parts: string[] = [];
	for (const part of path.split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') {
			parts.pop();
			continue;
		}
		parts.push(part);
	}
	return parts.join('/');
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function resolveImageDestination(app: App, file: TFile, src: string): TFile | null {
	const raw = src.trim().replace(/^<|>$/g, '');
	if (!raw || isExternalUrl(raw)) return null;
	const hashIndex = raw.indexOf('#');
	const pathPart = (hashIndex >= 0 ? raw.slice(0, hashIndex) : raw).replace(/^\/+/, '');
	if (!pathPart) return null;
	const noteDir = file.parent ? file.parent.path : '';
	const candidates = [pathPart, safeDecode(pathPart)];
	if (noteDir) candidates.push(normalizeVaultPath(noteDir + '/' + pathPart));
	candidates.push(normalizeVaultPath(pathPart));
	for (const candidate of candidates) {
		const dest = app.metadataCache.getFirstLinkpathDest(candidate, file.path);
		if (dest) return dest;
	}
	return null;
}

function resolveImagePath(app: App, file: TFile, src: string): string {
	const raw = src.trim().replace(/^<|>$/g, '');
	if (!raw || isExternalUrl(raw)) return raw;
	const dest = resolveImageDestination(app, file, raw);
	if (!dest) return raw;
	return relativePath(file.parent ? file.parent.path : '', dest.path);
}

function imageMimeType(path: string): string | null {
	const match = /\.([a-z0-9]+)$/i.exec(path);
	const extension = match ? match[1].toLowerCase() : '';
	switch (extension) {
		case 'png': return 'image/png';
		case 'jpg':
		case 'jpeg': return 'image/jpeg';
		case 'gif': return 'image/gif';
		case 'webp': return 'image/webp';
		case 'svg': return 'image/svg+xml';
		case 'avif': return 'image/avif';
		case 'bmp': return 'image/bmp';
		case 'ico': return 'image/x-icon';
		case 'tif':
		case 'tiff': return 'image/tiff';
		default: return null;
	}
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const end = Math.min(i + chunkSize, bytes.length);
		for (let j = i; j < end; j++) binary += String.fromCharCode(bytes[j]);
	}
	return btoa(binary);
}

function collectImageSources(markdown: string): string[] {
	const sources = new Set<string>();
	replaceMarkdownImages(markdown, info => {
		if (info.src) sources.add(info.src);
		return '';
	});
	const wikiImage = /!\[\[([^\]]+)\]\]/g;
	let match: RegExpExecArray | null;
	while ((match = wikiImage.exec(markdown)) !== null) {
		const linkpath = match[1].split('|')[0].trim();
		if (linkpath) sources.add(linkpath);
	}
	return Array.from(sources);
}

export async function buildEmbeddedImageMap(app: App, file: TFile, markdown: string): Promise<Map<string, string>> {
	const embedded = new Map<string, string>();
	const sources = collectImageSources(markdown);
	if (!sources.length) return embedded;

	const cache = new Map<string, string | null>();
	for (const src of sources) {
		const dest = resolveImageDestination(app, file, src);
		if (!dest) continue;
		const mime = imageMimeType(dest.path);
		if (!mime) continue;

		const cached = cache.get(dest.path);
		if (cached !== undefined) {
			if (cached) embedded.set(src, cached);
			continue;
		}

		try {
			const buffer = await app.vault.readBinary(dest);
			const dataUrl = 'data:' + mime + ';base64,' + arrayBufferToBase64(buffer);
			cache.set(dest.path, dataUrl);
			embedded.set(src, dataUrl);
		} catch (error) {
			console.warn('MD to HTML: failed to embed image ' + dest.path, error);
			cache.set(dest.path, null);
		}
	}
	return embedded;
}

function parseDestination(inner: string): { src: string; title?: string } {
	const value = inner.trim();
	if (!value) return { src: '' };
	if (value.startsWith('<')) {
		const end = value.indexOf('>');
		if (end >= 0) {
			const src = value.slice(1, end).trim();
			const rest = value.slice(end + 1).trim();
			return { src, title: parseTitle(rest) };
		}
	}
	const match = /^(\S+)(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?$/.exec(value);
	if (match) {
		return { src: match[1], title: match[2] ?? match[3] ?? match[4] };
	}
	return { src: value };
}

function parseTitle(value: string): string | undefined {
	if (!value) return undefined;
	const match = /^(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/.exec(value);
	return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

function imageSource(src: string, resolveImage?: ImageResolver): string {
	if (!src || isExternalUrl(src)) return src;
	return resolveImage ? resolveImage(src) : src;
}

function renderImage(src: string, alt: string, width = '', height = '', title?: string): string {
	const finalSrc = isExternalUrl(src) ? src : encodeLocalPath(src);
	let attrs = ' alt="' + escapeHtml(alt) + '" src="' + escapeHtml(finalSrc) + '"';
	if (width) attrs += ' width="' + escapeHtml(width) + '"';
	if (height) attrs += ' height="' + escapeHtml(height) + '"';
	if (title) attrs += ' title="' + escapeHtml(title) + '"';
	return '<img' + attrs + '>';
}

function applyEmphasis(value: string): string {
	return value
		.replace(/~~(.+?)~~/g, '<del>$1</del>')
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/__(.+?)__/g, '<strong>$1</strong>')
		.replace(/\*(.+?)\*/g, '<em>$1</em>')
		.replace(/_(.+?)_/g, '<em>$1</em>');
}

function formatInlineText(text: string): string {
	return applyEmphasis(escapeHtml(text));
}

const TOKEN_DELIMITER = '\uE000';

function restoreTokens(value: string, tokens: string[]): string {
	let result = value;
	for (let pass = 0; pass < 10; pass++) {
		const pattern = new RegExp(TOKEN_DELIMITER + '(\\d+)' + TOKEN_DELIMITER, 'g');
		const next = result.replace(pattern, (_match, index: string) => tokens[Number(index)] ?? '');
		if (next === result) break;
		result = next;
	}
	return result;
}

function replaceMarkdownImages(text: string, render: (info: ImageInfo) => string): string {
	let result = '';
	let index = 0;
	while (index < text.length) {
		const start = text.indexOf('![', index);
		if (start < 0) {
			result += text.slice(index);
			break;
		}
		if (start > 0 && text[start - 1] === '\\') {
			result += text.slice(index, start + 2);
			index = start + 2;
			continue;
		}
		const altEnd = text.indexOf(']', start + 2);
		if (altEnd < 0 || text[altEnd + 1] !== '(') {
			result += text.slice(index, start + 2);
			index = start + 2;
			continue;
		}
		let depth = 1;
		let quote = '';
		let cursor = altEnd + 2;
		while (cursor < text.length && depth > 0) {
			const ch = text[cursor];
			if (quote) {
				if (ch === quote && text[cursor - 1] !== '\\') quote = '';
			} else if ((ch === '"' || ch === "'") && (cursor === altEnd + 2 || /\s/.test(text[cursor - 1]))) {
				quote = ch;
			} else if (ch === '(') {
				depth++;
			} else if (ch === ')') {
				depth--;
			}
			cursor++;
		}
		if (depth !== 0) {
			result += text.slice(index, start + 2);
			index = start + 2;
			continue;
		}
		const rawAlt = text.slice(start + 2, altEnd);
		const destination = parseDestination(text.slice(altEnd + 2, cursor - 1));
		let alt = rawAlt;
		let width = '';
		let height = '';
		const sizeMatch = /^(.*?)\|(\d+)(?:x(\d+))?$/.exec(rawAlt);
		if (sizeMatch) {
			alt = sizeMatch[1];
			width = sizeMatch[2];
			height = sizeMatch[3] ?? '';
		}
		result += text.slice(index, start) + render({ alt, src: destination.src, width, height, title: destination.title });
		index = cursor;
	}
	return result;
}

function replaceMarkdownLinks(text: string, render: (info: LinkInfo) => string): string {
	let result = '';
	let index = 0;
	while (index < text.length) {
		const start = text.indexOf('[', index);
		if (start < 0) {
			result += text.slice(index);
			break;
		}
		if ((start > 0 && (text[start - 1] === '!' || text[start - 1] === '\\')) || text[start + 1] === '[') {
			result += text.slice(index, start + 1);
			index = start + 1;
			continue;
		}
		const labelEnd = text.indexOf(']', start + 1);
		if (labelEnd < 0 || text[labelEnd + 1] !== '(') {
			result += text.slice(index, start + 1);
			index = start + 1;
			continue;
		}
		let depth = 1;
		let quote = '';
		let cursor = labelEnd + 2;
		while (cursor < text.length && depth > 0) {
			const ch = text[cursor];
			if (quote) {
				if (ch === quote && text[cursor - 1] !== '\\') quote = '';
			} else if ((ch === '"' || ch === "'") && (cursor === labelEnd + 2 || /\s/.test(text[cursor - 1]))) {
				quote = ch;
			} else if (ch === '(') {
				depth++;
			} else if (ch === ')') {
				depth--;
			}
			cursor++;
		}
		if (depth !== 0) {
			result += text.slice(index, start + 1);
			index = start + 1;
			continue;
		}
		const label = text.slice(start + 1, labelEnd);
		const destination = parseDestination(text.slice(labelEnd + 2, cursor - 1));
		result += text.slice(index, start) + render({ label, href: destination.src, title: destination.title });
		index = cursor;
	}
	return result;
}

function splitTableRow(line: string): string[] | null {
	const value = line.trim();
	if (!value.includes('|')) return null;
	let start = 0;
	let end = value.length;
	if (value[start] === '|') start++;
	if (end > start && value[end - 1] === '|' && value[end - 2] !== '\\') end--;
	const cells: string[] = [];
	let current = '';
	let inCode = false;
	for (let i = start; i < end; i++) {
		const ch = value[i];
		if (!inCode && ch === '\\' && value[i + 1] === '\\') {
			current += '\\';
			i++;
			continue;
		}
		if (!inCode && ch === '\\' && value[i + 1] === '|') {
			current += '|';
			i++;
			continue;
		}
		if (ch === '`') {
			inCode = !inCode;
			current += ch;
			continue;
		}
		if (!inCode && ch === '|') {
			cells.push(current.trim());
			current = '';
			continue;
		}
		current += ch;
	}
	cells.push(current.trim());
	return cells;
}

function isSeparatorRow(cells: string[] | null): boolean {
	return !!cells && cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseAlignment(cell: string): string {
	const value = cell.trim();
	const left = value.startsWith(':');
	const right = value.endsWith(':');
	if (left && right) return 'center';
	if (right) return 'right';
	if (left) return 'left';
	return '';
}

function isPipeDelimited(line: string): boolean {
	const value = line.trim();
	return value.startsWith('|') && value.endsWith('|') && !value.endsWith('\\|');
}

function renderTableRow(tag: 'th' | 'td', row: string[], columns: number, alignments: string[], resolveImage?: ImageResolver): string {
	const cells: string[] = [];
	for (let i = 0; i < columns; i++) {
		const alignment = alignments[i];
		const style = alignment ? ' style="text-align:' + alignment + '"' : '';
		cells.push('<' + tag + style + '>' + parseInline(row[i] ?? '', resolveImage) + '</' + tag + '>');
	}
	return cells.join('');
}

function mdToHtml(md: string, resolveImage?: ImageResolver, rawBlocks?: Map<string, string>): string {
	let lines = md.split('\n');
	lines = stripFrontmatter(lines);
	const html: string[] = [];
	let inCode = false, codeLang = '', codeContent: string[] = [];
	let inList: string[] = [];
	let listType = '';
	let tableOpen = false;
	let tableRows: string[][] = [];
	let tableAlignments: string[] = [];

	function flushList(): void {
		if (inList.length) {
			html.push('<' + listType + '>' + inList.join('') + '</' + listType + '>');
			inList = []; listType = '';
		}
	}
	function flushTable(): void {
		if (!tableOpen) return;
		const header = tableRows[0] ?? [];
		const columns = Math.max(header.length, ...tableRows.map(row => row.length));
		html.push('<table>');
		html.push('<thead><tr>' + renderTableRow('th', header, columns, tableAlignments, resolveImage) + '</tr></thead>');
		if (tableRows.length > 1) {
			html.push('<tbody>');
			for (const row of tableRows.slice(1)) {
				html.push('<tr>' + renderTableRow('td', row, columns, tableAlignments, resolveImage) + '</tr>');
			}
			html.push('</tbody>');
		}
		html.push('</table>');
		tableOpen = false;
		tableRows = [];
		tableAlignments = [];
	}
	function startTable(row: string[], alignments: string[]): void {
		flushList();
		tableOpen = true;
		tableRows = [row];
		tableAlignments = alignments;
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

		const rawBlock = rawBlocks?.get(line.trim());
		if (rawBlock !== undefined) {
			flushList();
			flushTable();
			html.push(rawBlock);
			continue;
		}

		const tableRow = splitTableRow(line);
		if (tableOpen) {
			if (tableRow && !isSeparatorRow(tableRow)) {
				tableRows.push(tableRow);
				continue;
			}
			if (tableRow && isSeparatorRow(tableRow)) {
				continue;
			}
			flushTable();
		}

		if (tableRow && !isSeparatorRow(tableRow)) {
			const nextRow = i + 1 < lines.length ? splitTableRow(lines[i + 1]) : null;
			if (nextRow && isSeparatorRow(nextRow)) {
				startTable(tableRow, nextRow.map(parseAlignment));
				i++;
				continue;
			}
			if (isPipeDelimited(line)) {
				startTable(tableRow, []);
				continue;
			}
		}

		if (line.startsWith('# ')) { flushList(); html.push('<h1>' + parseInline(line.slice(2).trim(), resolveImage) + '</h1>'); continue; }
		if (line.startsWith('## ')) { flushList(); html.push('<h2>' + parseInline(line.slice(3).trim(), resolveImage) + '</h2>'); continue; }
		if (line.startsWith('### ')) { flushList(); html.push('<h3>' + parseInline(line.slice(4).trim(), resolveImage) + '</h3>'); continue; }
		if (line.startsWith('#### ')) { flushList(); html.push('<h4>' + parseInline(line.slice(5).trim(), resolveImage) + '</h4>'); continue; }

		if (line.startsWith('- ') || line.startsWith('* ')) {
			if (listType !== 'ul') { flushList(); listType = 'ul'; }
			inList.push('<li>' + parseInline(line.slice(2).trim(), resolveImage) + '</li>'); continue;
		}
		if (/^\d+\.\s/.test(line)) {
			if (listType !== 'ol') { flushList(); listType = 'ol'; }
			inList.push('<li>' + parseInline(line.replace(/^\d+\.\s*/, '').trim(), resolveImage) + '</li>'); continue;
		}

		if (inList.length && (!line.trim() || line.startsWith('#'))) { flushList(); }

		if (line.startsWith('> ')) { flushList(); html.push('<blockquote>' + parseInline(line.slice(2).trim(), resolveImage) + '</blockquote>'); continue; }
		if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') { flushList(); html.push('<hr>'); continue; }
		if (line.trim() === '') { continue; }

		html.push('<p>' + parseInline(line, resolveImage) + '</p>');
	}

	flushList(); flushTable();
	if (inCode) html.push('<pre><code>' + escapeHtml(codeContent.join('\n')) + '</code></pre>');
	return html.join('\n');
}

function parseInline(text: string, resolveImage?: ImageResolver): string {
	const tokens: string[] = [];
	const stash = (value: string): string => {
		const token = TOKEN_DELIMITER + tokens.length + TOKEN_DELIMITER;
		tokens.push(value);
		return token;
	};

	let value = text.replace(/`([^`]+)`/g, (_match, code: string) => stash('<code>' + escapeHtml(code) + '</code>'));
	value = replaceMarkdownImages(value, info => stash(renderImage(imageSource(info.src, resolveImage), info.alt, info.width, info.height, info.title)));
	value = value.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
		const parts = inner.split('|');
		const linkpath = parts[0].trim();
		if (!linkpath) return '';
		let width = '';
		let height = '';
		let alt = '';
		for (const part of parts.slice(1)) {
			const option = part.trim();
			const size = /^(\d+)(?:x(\d+))?$/.exec(option);
			if (size) {
				width = size[1];
				height = size[2] ?? '';
			} else if (!alt) {
				alt = option;
			}
		}
		if (!alt) alt = linkpath.split('/').pop() || linkpath;
		return stash(renderImage(imageSource(linkpath, resolveImage), alt, width, height));
	});
	value = value.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, page: string, alias?: string) => {
		const target = page.trim();
		const label = (alias ?? target).trim() || target;
		return stash('<a href="' + escapeHtml(target) + '">' + formatInlineText(label) + '</a>');
	});
	value = replaceMarkdownLinks(value, info => stash('<a href="' + escapeHtml(info.href) + '"' + (info.title ? ' title="' + escapeHtml(info.title) + '"' : '') + '>' + formatInlineText(info.label) + '</a>'));

	return restoreTokens(applyEmphasis(escapeHtml(value)), tokens);
}

function buildHtml(title: string, bodyHtml: string, theme: OutputTheme): string {
	const css = theme === 'light' ? CSS_LIGHT : CSS_DARK;
	return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + escapeHtml(title) + '</title>\n<style>\n' + css + '\n</style>\n</head>\n<body>\n' + bodyHtml + '\n</body>\n</html>';
}

interface MermaidRenderResult {
	svg?: string;
}

interface MermaidApi {
	render(id: string, text: string, container?: HTMLElement): Promise<string | MermaidRenderResult>;
}

async function renderMermaidBlocks(markdown: string): Promise<{ markdown: string; rawBlocks: Map<string, string> }> {
	const lines = markdown.split('\n');
	const output: string[] = [];
	const rawBlocks = new Map<string, string>();
	let mermaid: MermaidApi | null = null;
	let diagramIndex = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!/^```\s*mermaid\s*$/i.test(line.trim())) {
			output.push(line);
			continue;
		}

		let end = i + 1;
		const source: string[] = [];
		while (end < lines.length && !lines[end].trim().startsWith('```')) {
			source.push(lines[end]);
			end++;
		}
		if (end >= lines.length) {
			output.push(line);
			continue;
		}

		const sentinel = '%%MD2HE_MERMAID_' + rawBlocks.size + '%%';
		const container = createDiv({ cls: 'mermaid' });
		container.setCssStyles({
			width: Math.max(600, Math.min(1000, window.innerWidth - 80)) + 'px',
			visibility: 'hidden',
			position: 'absolute',
			left: '0',
			top: '0',
		});
		document.body.appendChild(container);
		try {
			if (!mermaid) mermaid = (await loadMermaid()) as MermaidApi;
			const result = await mermaid.render('md2he-mermaid-' + diagramIndex, source.join('\n'), container);
			diagramIndex++;
			const svg = typeof result === 'string' ? result : result?.svg;
			if (svg) {
				rawBlocks.set(sentinel, '<div class="mermaid-diagram">' + svg + '</div>');
				output.push(sentinel);
				i = end;
				continue;
			}
		} catch (error) {
			console.warn('MD to HTML: Mermaid render failed', error);
			diagramIndex++;
		} finally {
			container.remove();
		}

		for (let j = i; j <= end; j++) output.push(lines[j]);
		i = end;
	}

	return { markdown: output.join('\n'), rawBlocks };
}

async function convertFile(app: App, file: TFile, theme: ThemeSetting): Promise<void> {
	const outputTheme = resolveOutputTheme(theme);
	const content = await app.vault.read(file);
	const { markdown, rawBlocks } = await renderMermaidBlocks(content);
	const embeddedImages = await buildEmbeddedImageMap(app, file, markdown);
	const htmlContent = mdToHtml(markdown, (src) => embeddedImages.get(src) ?? resolveImagePath(app, file, src), rawBlocks);
	const outPath = file.parent ? file.parent.path + '/' + file.basename + '.html' : file.basename + '.html';
	if (app.vault.getFileByPath(outPath)) {
		new Notice('HTML file already exists: ' + outPath);
		return;
	}
	await app.vault.create(outPath, buildHtml(file.basename, htmlContent, outputTheme));
	new Notice('Converted: ' + outPath);
}

export default class MD2HEPlugin extends Plugin {
	settings: MD2HESettings = { ...DEFAULT_SETTINGS };

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
			callback: async (): Promise<void> => {
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
		const data: Record<string, unknown> | null = await this.loadData() as Record<string, unknown> | null;
		if (data && typeof data === 'object') {
			const theme = data.theme;
			if (theme === 'auto' || theme === 'light' || theme === 'dark') this.settings.theme = theme;
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

export { mdToHtml, buildHtml, resolveOutputTheme };

const THEME_OPTIONS: Record<string, string> = {
	auto: 'Auto (follow Obsidian)',
	dark: 'Dark',
	light: 'Light',
};

const THEME_DESCRIPTION = 'Color theme for generated HTML files. Auto follows the Obsidian theme at conversion time.';

class MD2HESettingTab extends PluginSettingTab {
	plugin: MD2HEPlugin;
	constructor(app: App, plugin: MD2HEPlugin) { super(app, plugin); this.plugin = plugin; }
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl).setName('Display').setHeading();
		new Setting(containerEl).setName('Output theme').setDesc(THEME_DESCRIPTION)
			.addDropdown(d => {
				for (const [value, label] of Object.entries(THEME_OPTIONS)) d.addOption(value, label);
				d.setValue(this.plugin.settings.theme)
					.onChange(async (v) => {
						await this.setControlValue('theme', v);
					});
			});
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [{
			type: 'group',
			heading: 'Display',
			items: [{
				name: 'Output theme',
				desc: THEME_DESCRIPTION,
				control: {
					type: 'dropdown',
					key: 'theme',
					defaultValue: 'auto',
					options: THEME_OPTIONS,
				},
			}],
		}];
	}

	getControlValue(key: string): unknown {
		return key === 'theme' ? this.plugin.settings.theme : undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key !== 'theme') return;
		if (value === 'auto' || value === 'dark' || value === 'light') {
			this.plugin.settings.theme = value;
			await this.plugin.saveSettings();
		}
	}
}
