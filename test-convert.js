/**
 * Standalone test harness for the md-to-html-effect converter.
 *
 * The converter lives in main.ts. This harness bundles the real file with
 * esbuild and stubs the `obsidian` module, so tests exercise the same code the
 * plugin ships instead of a duplicated copy.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

function loadConverter() {
    const result = esbuild.buildSync({
        entryPoints: [path.join(__dirname, 'main.ts')],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        write: false,
        external: ['obsidian'],
        logLevel: 'silent',
    });

    class Stub {}
    const obsidian = {
        Plugin: Stub,
        PluginSettingTab: Stub,
        Setting: Stub,
        Notice: Stub,
        TFile: Stub,
    };
    const module = { exports: {} };
    const customRequire = (id) => id === 'obsidian' ? obsidian : require(id);
    new Function('module', 'exports', 'require', result.outputFiles[0].text)(
        module,
        module.exports,
        customRequire,
    );
    return module.exports;
}

const { mdToHtml, buildHtml, buildEmbeddedImageMap, resolveOutputTheme } = loadConverter();

let passed = 0;
const failures = [];

function check(name, condition, detail) {
    if (condition) {
        passed++;
    } else {
        failures.push(name + (detail ? ': ' + detail : ''));
    }
}

function contains(name, html, needle) {
    check(name, html.includes(needle), 'missing ' + JSON.stringify(needle));
}

function notContains(name, html, needle) {
    check(name, !html.includes(needle), 'unexpected ' + JSON.stringify(needle));
}

function equal(name, actual, expected) {
    check(name, actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

function runThemeTests() {
    equal('auto theme follows dark Obsidian', resolveOutputTheme('auto', true), 'dark');
    equal('auto theme follows light Obsidian', resolveOutputTheme('auto', false), 'light');
    equal('explicit light theme ignored dark Obsidian', resolveOutputTheme('light', true), 'light');
    equal('explicit dark theme ignored light Obsidian', resolveOutputTheme('dark', false), 'dark');
}

function runInlineTests() {
    let html = mdToHtml('![小狗](https://example.com/dog.png)');
    contains('markdown image', html, '<img alt="小狗" src="https://example.com/dog.png">');

    html = mdToHtml('![小狗](https://example.com/dog.png "A dog")');
    contains('image title', html, '<img alt="小狗" src="https://example.com/dog.png" title="A dog">');

    html = mdToHtml('![alt](my_image_file.png)');
    contains('image URL with underscores', html, 'src="my_image_file.png"');
    notContains('image URL not emphasized', html, 'my<em>image</em>file');

    html = mdToHtml('![alt](https://example.com/a_(b).png)');
    contains('image URL with parentheses', html, 'src="https://example.com/a_(b).png"');

    html = mdToHtml('![alt](attachments/my image.png)');
    contains('image path with spaces', html, 'src="attachments/my%20image.png"');

    html = mdToHtml('![alt](<attachments/my image.png>)');
    contains('image angle-bracket path', html, 'src="attachments/my%20image.png"');

    html = mdToHtml('![[puppy.png]]');
    contains('wiki image', html, '<img alt="puppy.png" src="puppy.png">');

    html = mdToHtml('![[puppy.png|200]]');
    contains('wiki image width', html, '<img alt="puppy.png" src="puppy.png" width="200">');

    html = mdToHtml('![[puppy.png|200x150]]');
    contains('wiki image width and height', html, '<img alt="puppy.png" src="puppy.png" width="200" height="150">');

    html = mdToHtml('![[puppy.png|A puppy]]');
    contains('wiki image alt text', html, '<img alt="A puppy" src="puppy.png">');

    html = mdToHtml('![[puppy.png|200|A puppy]]');
    contains('wiki image size and alt', html, '<img alt="A puppy" src="puppy.png" width="200">');

    html = mdToHtml('![alt|120](img.png)');
    contains('markdown image width', html, '<img alt="alt" src="img.png" width="120">');

    html = mdToHtml('[![alt](img.png)](https://example.com)');
    contains('image inside link', html, '<a href="https://example.com"><img alt="alt" src="img.png"></a>');

    html = mdToHtml('[x](https://a/b_c_d)');
    contains('link URL with underscores', html, '<a href="https://a/b_c_d">x</a>');

    html = mdToHtml('[[page|alias]]');
    contains('wiki link alias', html, '<a href="page">alias</a>');
    notContains('wiki link alias not concatenated', html, 'aliaspage');

    html = mdToHtml('`![alt](img.png)`');
    contains('image syntax inside code', html, '<code>![alt](img.png)</code>');
    notContains('image syntax inside code not converted', html, '<img');

    html = mdToHtml('~~deleted~~');
    contains('strikethrough', html, '<del>deleted</del>');

    html = mdToHtml('![<x>](img.png)');
    contains('image alt escaped', html, 'alt="&lt;x&gt;"');

    html = mdToHtml('![alt](img.png)', src => 'resolved/' + src);
    contains('image resolver', html, 'src="resolved/img.png"');

    let resolverCalled = false;
    mdToHtml('![alt](https://example.com/x.png)', () => {
        resolverCalled = true;
        return 'x';
    });
    check('resolver skipped for external URL', resolverCalled === false);

    html = mdToHtml('![alt](img.png)', () => 'data:image/png;base64,abc');
    contains('data URI image', html, 'src="data:image/png;base64,abc"');
    notContains('data URI image not path-encoded', html, 'data%3A');

    html = mdToHtml('![[attachments/china_media_heatmap.png]]', () => 'data:image/png;base64,abc');
    contains('wiki image data URI', html, '<img alt="china_media_heatmap.png" src="data:image/png;base64,abc">');

    const rawBlocks = new Map([
        ['%%MD2HE_MERMAID_0%%', '<div class="mermaid-diagram"><svg></svg></div>'],
    ]);
    html = mdToHtml('Before\n\n%%MD2HE_MERMAID_0%%\n\nAfter', undefined, rawBlocks);
    contains('pre-rendered mermaid block', html, '<div class="mermaid-diagram"><svg></svg></div>');
    notContains('pre-rendered mermaid block not escaped', html, '&lt;div class="mermaid-diagram"');
}

async function runEmbeddingTests() {
    let readPath = '';
    let readCount = 0;
    const app = {
        metadataCache: {
            getFirstLinkpathDest(candidate) {
                if (candidate === 'attachments/china_media_heatmap.png') {
                    return { path: 'attachments/china_media_heatmap.png', extension: 'png' };
                }
                return null;
            },
        },
        vault: {
            async readBinary(file) {
                readPath = file.path;
                readCount++;
                return new Uint8Array([137, 80, 78, 71]).buffer;
            },
        },
    };
    const file = { path: 'notes/test.md', parent: { path: 'notes' } };
    const map = await buildEmbeddedImageMap(
        app,
        file,
        '![[attachments/china_media_heatmap.png]]\n\n![alt](attachments/china_media_heatmap.png)',
    );
    equal('embedded image read path', readPath, 'attachments/china_media_heatmap.png');
    equal('embedded image read once', readCount, 1);
    equal('embedded image count', map.size, 1);
    equal('embedded image data URI', map.get('attachments/china_media_heatmap.png'), 'data:image/png;base64,iVBORw==');

    const missing = await buildEmbeddedImageMap(
        { metadataCache: { getFirstLinkpathDest: () => null }, vault: { readBinary: async () => new ArrayBuffer(0) } },
        file,
        '![[missing.png]]',
    );
    equal('missing image not embedded', missing.size, 0);

    const external = await buildEmbeddedImageMap(app, file, '![x](https://example.com/x.png)');
    equal('external image not embedded', external.size, 0);
}

function runTableTests() {
    let html = mdToHtml('| a |  | c |\n|---|---|---|\n| 1 |  | 3 |');
    contains('table empty header cell', html, '<th>a</th><th></th><th>c</th>');
    contains('table empty body cell', html, '<td>1</td><td></td><td>3</td>');
    contains('table has thead', html, '<thead><tr>');
    contains('table has tbody', html, '<tbody>');

    html = mdToHtml('a | b\n--- | ---\n1 | 2');
    contains('table without outer pipes header', html, '<th>a</th><th>b</th>');
    contains('table without outer pipes body', html, '<td>1</td><td>2</td>');

    html = mdToHtml('| L | C | R |\n|:---|:---:|---:|\n| 1 | 2 | 3 |');
    contains('table align left', html, '<th style="text-align:left">L</th>');
    contains('table align center', html, '<th style="text-align:center">C</th>');
    contains('table align right', html, '<th style="text-align:right">R</th>');

    html = mdToHtml('| A | B |\n|---|---|\n| x \\| y | z |');
    contains('table escaped pipe', html, '<td>x | y</td>');

    html = mdToHtml('| A | B |\n|---|---|\n| `x|y` | z |');
    contains('table pipe inside code', html, '<td><code>x|y</code></td>');

    html = mdToHtml('| | B |\n|---|---|\n| | 2 |');
    contains('table empty first header cell', html, '<th></th><th>B</th>');
    contains('table empty first body cell', html, '<td></td><td>2</td>');

    html = mdToHtml('| A |\n|---|\n| 1 |\n\nAfter');
    contains('table followed by paragraph', html, '</table>\n<p>After</p>');

    html = mdToHtml('| A |\n|---|\n\n| B |\n|---|\n| 2 |');
    equal('two tables separated by blank line', (html.match(/<table>/g) || []).length, 2);

    html = mdToHtml('| A | B |\n|---|---|');
    contains('header-only table', html, '<thead><tr><th>A</th><th>B</th></tr></thead>');
    notContains('header-only table has no tbody', html, '<tbody>');

    html = mdToHtml('| A | B |\n|---|---|\n| ![x](img.png) | y |');
    contains('image inside table', html, '<td><img alt="x" src="img.png"></td>');
}

function validateSample(html) {
    if (html.includes('title: 小狗测试')) failures.push('Frontmatter not stripped');

    if (!html.includes('<thead>')) failures.push('Table missing <thead>');
    if (!html.includes('<tbody>')) failures.push('Table missing <tbody>');
    const tbodyStart = html.indexOf('<tbody>');
    const tbodyEnd = html.indexOf('</tbody>');
    if (tbodyStart >= 0 && tbodyEnd > tbodyStart && html.slice(tbodyStart, tbodyEnd).includes('<th>')) {
        failures.push('<th> found inside <tbody>');
    }

    if (!html.includes('<del>')) failures.push('Strikethrough not converted');
    equal('sample h1 count', (html.match(/<h1>/g) || []).length, 1);
    if ((html.match(/<h2>/g) || []).length < 2) failures.push('Expected at least 2 <h2>');
    if ((html.match(/<h3>/g) || []).length < 8) failures.push('Expected at least 8 <h3>');
    if (!html.includes('<h4>')) failures.push('Missing <h4>');

    if (!html.includes('<pre><code class="language-python"')) failures.push('Code block missing language class');
    if (!html.includes('<code>npm run build</code>')) failures.push('Inline code not converted');
    if (!html.includes('<ul>')) failures.push('Unordered list missing');
    if (!html.includes('<ol>')) failures.push('Ordered list missing');
    if (!html.includes('<blockquote>')) failures.push('Blockquote missing');
    if (!html.includes('这是一段引用文字')) failures.push('Blockquote content missing');

    if (!html.includes('href="https://openai.com"')) failures.push('External link broken');
    if (!html.includes('<a href="另一个笔记">另一个笔记</a>')) failures.push('Wiki-link [[page]] not converted');
    if (!html.includes('<a href="测试页面">显示名称</a>')) failures.push('Wiki-link [[page|alias]] not converted');
    notContains('Wiki-link alias not concatenated', html, '显示名称测试页面');

    if (!html.includes('<img alt="小狗" src="https://example.com/dog.png"')) failures.push('Markdown image not converted');
    if (!html.includes('<img alt="puppy.png" src="puppy.png">')) failures.push('Wiki image not converted');
    if (!html.includes('<img alt="puppy.png" src="puppy.png" width="200">')) failures.push('Wiki image width not converted');
    if (!html.includes('<img alt="puppy.png" src="puppy.png" width="200" height="150">')) failures.push('Wiki image width and height not converted');
    if (!html.includes('src="attachments/puppy.png"')) failures.push('Local image path not converted');

    if (!html.includes('<hr>')) failures.push('HR missing');
    if (html.includes('<p>这段文字')) failures.push('HTML entities not escaped - raw tags rendered');
    if (!html.includes('&lt;p&gt;这段文字应该被转义&lt;/p&gt;')) failures.push('HTML entities not escaped');

    if (!html.startsWith('<!DOCTYPE html>')) failures.push('Missing DOCTYPE');
    if (!html.includes('<html lang="zh-CN">')) failures.push('Missing html lang');
    if (!html.includes('<meta charset="UTF-8">')) failures.push('Missing charset meta');
    if (!html.includes('<meta name="viewport"')) failures.push('Missing viewport meta');
    if (!html.includes('</html>')) failures.push('Missing closing html tag');
    if (!html.includes('<style>')) failures.push('Missing <style> tag');

    if (!html.includes('<strong>加粗文字</strong>')) failures.push('Bold text not converted');
    if (!html.includes('<em>斜体文字</em>')) failures.push('Italic text not converted');
    if (!html.includes('<em><strong>加粗斜体</strong></em>')) failures.push('Bold+italic not converted correctly');

    const light = buildHtml('test', '<p>x</p>', 'light');
    if (!light.includes('#ffffff')) failures.push('Light theme CSS missing');
    if (light.includes('theme-toggle')) failures.push('Unexpected theme toggle');
}

async function main() {
    runThemeTests();
    runInlineTests();
    await runEmbeddingTests();
    runTableTests();

    const inputFile = process.argv[2] || path.join(__dirname, 'test-小狗.md');
    const md = fs.readFileSync(inputFile, 'utf8');
    const bodyHtml = mdToHtml(md);
    const fullHtml = buildHtml('test-小狗', bodyHtml, 'dark');
    fs.writeFileSync(path.join(__dirname, 'test-小狗.html'), fullHtml, 'utf8');

    validateSample(fullHtml);

    console.log('=== VALIDATION RESULTS ===');
    console.log(`Passed: ${passed}`);
    if (failures.length === 0) {
        console.log('ALL CHECKS PASSED');
    } else {
        console.log(`FAILED: ${failures.length}`);
        failures.forEach((issue, index) => console.log(`  ${index + 1}. ${issue}`));
    }
    console.log('\n=== BODY HTML PREVIEW (first 500 chars) ===');
    console.log(bodyHtml.slice(0, 500));

    process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
