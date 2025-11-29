#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function convertOrgToMarkdown(content) {
  let lines = content.split('\n');
  let result = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let title = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Skip mode lines
    if (line.startsWith('# -*-') || line.startsWith('#+OPTIONS:')) {
      continue;
    }

    // Extract title
    if (line.startsWith('#+TITLE:')) {
      title = line.replace('#+TITLE:', '').trim();
      result.push(`# ${title}`);
      result.push('');
      continue;
    }

    // Skip TOC markers
    if (line.includes(':TOC:')) {
      continue;
    }

    // Handle code blocks
    if (line.match(/^\s*#\+begin_src\s*(\w*)/i)) {
      const match = line.match(/^\s*#\+begin_src\s*(\w*)/i);
      codeBlockLang = match[1] || '';
      // Map some language names
      if (codeBlockLang.toLowerCase() === 'c') codeBlockLang = 'c';
      if (codeBlockLang.toLowerCase() === 'sh') codeBlockLang = 'bash';
      result.push('```' + codeBlockLang);
      inCodeBlock = true;
      continue;
    }

    if (line.match(/^\s*#\+end_src/i)) {
      result.push('```');
      result.push('');
      inCodeBlock = false;
      continue;
    }

    if (line.match(/^\s*#\+begin_example\s*(\w*)/i)) {
      const match = line.match(/^\s*#\+begin_example\s*(\w*)/i);
      codeBlockLang = match[1] || 'bash';
      result.push('```' + codeBlockLang);
      inCodeBlock = true;
      continue;
    }

    if (line.match(/^\s*#\+end_example/i)) {
      result.push('```');
      result.push('');
      inCodeBlock = false;
      continue;
    }

    // Inside code block, just add line as-is
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // Convert headers (* -> #, ** -> ##, etc.)
    const headerMatch = line.match(/^(\*+)\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length + 1; // +1 because title is #
      const headerText = headerMatch[2].replace(/\s*:TOC:\s*$/, ''); // Remove :TOC: suffix
      result.push('#'.repeat(level) + ' ' + headerText);
      result.push('');
      continue;
    }

    // Convert inline code =code= to `code`
    line = line.replace(/=([^=]+)=/g, '`$1`');

    // Convert file links [[file:xxx.org]] to [xxx](./xxx.md)
    line = line.replace(/\[\[file:([^\]]+)\.org\]\]/g, (match, p1) => {
      // Handle relative paths
      let mdPath = p1.replace(/README$/, '').replace(/\/$/, '');
      if (mdPath === '') mdPath = './';
      if (mdPath.startsWith('../')) {
        mdPath = mdPath.replace(/\.\.\//, '../');
      }
      if (!mdPath.endsWith('/') && !mdPath.includes('.')) {
        mdPath = mdPath + '.md';
      }
      return `[${p1}](${mdPath})`;
    });

    // Convert external links [[url][text]] to [text](url)
    line = line.replace(/\[\[([^\]]+)\]\[([^\]]+)\]\]/g, '[$2]($1)');

    // Convert simple external links [[url]] to [url](url)
    line = line.replace(/\[\[([^\]]+)\]\]/g, (match, url) => {
      if (url.startsWith('file:')) {
        const filePath = url.replace('file:', '').replace('.org', '.md');
        return `[${filePath}](${filePath})`;
      }
      return `[${url}](${url})`;
    });

    // Convert bold *text* (but not headers)
    // Be careful not to match header lines
    if (!line.startsWith('*')) {
      line = line.replace(/\*([^*]+)\*/g, '**$1**');
    }

    result.push(line);
  }

  return result.join('\n');
}

function processFile(srcPath, destPath) {
  const content = fs.readFileSync(srcPath, 'utf8');
  const markdown = convertOrgToMarkdown(content);

  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.writeFileSync(destPath, markdown);
  console.log(`Converted: ${srcPath} -> ${destPath}`);
}

function processDirectory(srcDir, destDir) {
  const files = fs.readdirSync(srcDir);

  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      const newDestDir = path.join(destDir, file);
      processDirectory(srcPath, newDestDir);
    } else if (file.endsWith('.org')) {
      const mdFile = file.replace('.org', '.md');
      // Rename README.org to index.md for better VitePress support
      const destFile = mdFile === 'README.md' ? 'index.md' : mdFile;
      const destPath = path.join(destDir, destFile);
      processFile(srcPath, destPath);
    }
  }
}

// Main
const srcDir = path.join(__dirname, '..', 'docs-zh');
const destDir = path.join(__dirname, '..', 'docs');

processDirectory(srcDir, destDir);
console.log('\nConversion complete!');
