// Pure Mermaid graph-model utilities. Keep DOM and Electron concerns in mermaid-viewer.js.

const VISUAL_IMAGE_MARKER = '\uE000图片链接\uE001';
const escHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const escAttr = value => String(value ?? '').replace(/[&"']/g, char => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;' }[char]));
const stripHtml = value => String(value ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

function parseVisualLabel(label) {
  const source = String(label ?? '');
  const link = source.match(/<a\s+[^>]*href\s*=\s*['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i);
  const image = source.match(/<img\s+[^>]*src\s*=\s*['"]([^'"]+)['"][^>]*>/i);
  const linkedImage = link && /\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#].*)?$/i.test(link[1]) ? link[1] : '';
  const imageMarkup = linkedImage ? link[0] : image?.[0] || '';
  const imagePath = image ? image[1] : linkedImage;
  const imageLabel = linkedImage ? stripHtml(link[2]) || '查看图片' : image ? '查看图片' : '';
  const withImageMarker = imageMarkup ? source.replace(imageMarkup, VISUAL_IMAGE_MARKER) : source;
  return {
    text: stripHtml(link && !linkedImage ? withImageMarker.replace(link[0], link[2]) : withImageMarker),
    href: link && !linkedImage ? link[1] : '',
    imagePath,
    imageLabel
  };
}

function readVisualNodeToken(text, offset = 0) {
  const match = String(text).slice(offset).match(/^\s*([A-Za-z][\w-]*)/);
  if (!match) return null;
  const id = match[1];
  let end = offset + match[0].length;
  while (/\s/.test(String(text)[end] || '')) end += 1;
  const opener = String(text)[end];
  if (opener !== '[' && opener !== '{') return { id, type: 'rect', label: '', end };
  const closer = opener === '[' ? ']' : '}';
  const start = end + 1;
  let cursor = start;
  let quote = false;
  for (; cursor < String(text).length; cursor += 1) {
    const char = String(text)[cursor];
    if (char === '"' && String(text)[cursor - 1] !== '\\') quote = !quote;
    if (char === closer && !quote) break;
  }
  let label = String(text).slice(start, cursor);
  if (label.startsWith('"') && label.endsWith('"')) label = label.slice(1, -1);
  return { id, type: opener === '{' ? 'diamond' : 'rect', label: label.replace(/&quot;/g, '"'), end: Math.min(cursor + 1, String(text).length) };
}

function parseVisualGraph(code) {
  const model = { direction: /(?:graph|flowchart)\s+(LR|RL|BT|TB)/i.exec(code)?.[1]?.toUpperCase() || 'TB', nodes: [], edges: [], groups: [] };
  const groups = [];
  const subsystemRecords = [];
  const layoutRecords = [];
  const nextParsedId = prefix => {
    let number = 1;
    while (model.nodes.some(node => node.id === `${prefix}${number}`) || model.edges.some(edge => edge.id === `${prefix}${number}`) || model.groups.some(group => group.id === `${prefix}${number}`)) number += 1;
    return `${prefix}${number}`;
  };
  const ensureNode = (id, type = 'rect', label = '') => {
    if (!id) return null;
    let node = model.nodes.find(item => item.id === id);
    if (!node) {
      const parsed = parseVisualLabel(label);
      node = { id, type, text: parsed.text, href: parsed.href, imagePath: parsed.imagePath, imageLabel: parsed.imageLabel, x: 120 + model.nodes.length * 30, y: 100 + model.nodes.length * 30, width: 160, height: 64, groupId: groups.at(-1) || '', layoutLocked: false };
      model.nodes.push(node);
    } else if (label) {
      const parsed = parseVisualLabel(label);
      node.type = type || node.type;
      node.text = parsed.text;
      node.href = parsed.href;
      node.imagePath = parsed.imagePath;
      node.imageLabel = parsed.imageLabel;
    }
    if (!node.groupId && groups.length) node.groupId = groups.at(-1);
    return node;
  };

  String(code).split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.trim();
    const subsystemMeta = line.match(/^%%\s*mindtree-subsystem\s+(.+)$/i);
    if (subsystemMeta) {
      try {
        subsystemRecords.push(JSON.parse(decodeURIComponent(subsystemMeta[1])));
      } catch {
        // Ignore malformed metadata so older or hand-edited Mermaid remains usable.
      }
      return;
    }
    const layoutMeta = line.match(/^%%\s*mindtree-layout\s+(.+)$/i);
    if (layoutMeta) {
      try {
        const parsed = JSON.parse(decodeURIComponent(layoutMeta[1]));
        if (parsed?.version === 1 && Array.isArray(parsed.nodes)) layoutRecords.push(...parsed.nodes);
      } catch {
        // Ignore malformed layout metadata so older or hand-edited Mermaid remains usable.
      }
      return;
    }
    if (!line || line.startsWith('%%') || /^(graph|flowchart)\b/i.test(line) || /^(direction|style|classDef|class|linkStyle)\b/i.test(line)) return;
    const subgraph = line.match(/^subgraph\s+(.+)$/i);
    if (subgraph) {
      const token = readVisualNodeToken(subgraph[1]);
      const id = token?.id || nextParsedId('G');
      model.groups.push({ id, title: token?.label ? parseVisualLabel(token.label).text : id, nodeIds: [], href: '', linkedFile: '', collapsed: false });
      groups.push(id);
      return;
    }
    if (/^end$/i.test(line)) {
      groups.pop();
      return;
    }

    const leftToken = readVisualNodeToken(line);
    const edgeMatch = leftToken && line.slice(leftToken.end).match(/^\s*(<-->|<--|-->|---|~~~)\s*(?:\|([\s\S]*?)\|)?\s*(.*)$/);
    if (edgeMatch) {
      const left = ensureNode(leftToken.id, leftToken.type, leftToken.label);
      const right = readVisualNodeToken(edgeMatch[3]);
      const target = right ? ensureNode(right.id, right.type, right.label) : ensureNode(edgeMatch[3].trim());
      if (left && target) {
        const operator = edgeMatch[1];
        model.edges.push({ id: nextParsedId('E'), source: left.id, target: target.id, label: stripHtml(edgeMatch[2] || ''), direction: operator === '<--' ? 'reverse' : operator === '<-->' ? 'both' : operator === '---' ? 'none' : operator === '~~~' ? 'invisible' : 'forward' });
      }
      return;
    }

    const token = readVisualNodeToken(line);
    if (token) ensureNode(token.id, token.type, token.label);
  });

  model.groups.forEach(group => {
    group.nodeIds = model.nodes.filter(node => node.groupId === group.id).map(node => node.id);
  });
  if (layoutRecords.length) {
    const positions = new Map(layoutRecords.map(record => [String(record.id || ''), record]));
    model.nodes.forEach(node => {
      const saved = positions.get(node.id);
      if (!saved || !Number.isFinite(Number(saved.x)) || !Number.isFinite(Number(saved.y))) return;
      node.x = Number(saved.x);
      node.y = Number(saved.y);
      node.layoutLocked = Boolean(saved.layoutLocked);
    });
    model.layoutMetadata = true;
  }
  subsystemRecords.forEach(record => {
    const node = model.nodes.find(item => item.id === record.linkId);
    if (node && record.version === 1 && record.href) node.subsystemRestore = record;
  });
  return model;
}

function mermaidLabel(node, imagePrefix = '') {
  const imageLink = node.imagePath ? `<a href='${escAttr(imagePrefix + node.imagePath)}'>${escHtml(node.imageLabel || '查看图片')}</a>` : '';
  const rawText = String(node.text || '').replace(VISUAL_IMAGE_MARKER, imageLink || '[图片链接]');
  const text = (rawText || '&nbsp;').split(/\r?\n/).map(part => part.replace(/"/g, '&quot;')).join('<br/>');
  const linked = node.href ? `<a href='${escAttr(node.href)}'>${text || '打开链接'}</a>` : text;
  const image = node.imagePath && !String(node.text || '').includes(VISUAL_IMAGE_MARKER) ? `${linked ? '<br/>' : ''}${imageLink}` : '';
  return `${linked}${image}`;
}

function visualTextLines(node) {
  const sourceText = String(node.text || '未命名格子');
  const lines = sourceText.replace(VISUAL_IMAGE_MARKER, node.imageLabel ? `[${node.imageLabel}]` : '[图片链接]').split(/\r?\n/);
  if (node.imagePath && !sourceText.includes(VISUAL_IMAGE_MARKER)) lines.push(`[${node.imageLabel || '查看图片'}]`);
  return lines;
}

function serializeVisualGraph(model, options = {}) {
  const lines = [`graph ${model.direction || 'TB'}`];
  const grouped = new Set();
  const writeNode = node => `${node.id}${node.type === 'diamond' ? `{"${mermaidLabel(node, options.imagePrefix || '')}"}` : `["${mermaidLabel(node, options.imagePrefix || '')}"]`}`;
  const writeEdgesFor = nodeIds => {
    model.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)).forEach(edge => {
      const op = edge.direction === 'reverse' ? '<--' : edge.direction === 'both' ? '<-->' : edge.direction === 'none' ? '---' : edge.direction === 'invisible' ? '~~~' : '-->';
      const label = edge.label ? `|${edge.label.replace(/[|\r\n]/g, ' ')}|` : '';
      lines.push(`    ${edge.source} ${op}${label} ${edge.target}`);
    });
  };
  const writeGroup = group => {
    const ids = new Set(group.nodeIds);
    lines.push(`    subgraph ${group.id}["${String(group.title || group.id).replace(/"/g, '&quot;')}"]`);
    lines.push('        direction TB');
    model.nodes.filter(node => ids.has(node.id)).forEach(node => { lines.push(`        ${writeNode(node)}`); grouped.add(node.id); });
    model.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)).forEach(edge => {
      const op = edge.direction === 'reverse' ? '<--' : edge.direction === 'both' ? '<-->' : edge.direction === 'none' ? '---' : edge.direction === 'invisible' ? '~~~' : '-->';
      const label = edge.label ? `|${edge.label.replace(/[|\r\n]/g, ' ')}|` : '';
      lines.push(`        ${edge.source} ${op}${label} ${edge.target}`);
    });
    lines.push('    end');
  };
  model.groups.filter(group => !group.collapsed).forEach(writeGroup);
  model.nodes.filter(node => !grouped.has(node.id)).forEach(node => lines.push(`    ${writeNode(node)}`));
  const visibleIds = new Set(model.nodes.filter(node => !grouped.has(node.id)).map(node => node.id));
  model.groups.filter(group => !group.collapsed).forEach(group => group.nodeIds.forEach(id => visibleIds.add(id)));
  model.edges.filter(edge => !model.groups.some(group => group.nodeIds.includes(edge.source) && group.nodeIds.includes(edge.target))).forEach(edge => {
    const op = edge.direction === 'reverse' ? '<--' : edge.direction === 'both' ? '<-->' : edge.direction === 'none' ? '---' : edge.direction === 'invisible' ? '~~~' : '-->';
    const label = edge.label ? `|${edge.label.replace(/[|\r\n]/g, ' ')}|` : '';
    lines.push(`    ${edge.source} ${op}${label} ${edge.target}`);
  });
  lines.push(...model.groups.filter(group => group.href).map(group => `    %% 子系统链接：${group.id} -> ${group.href}`));
  model.nodes.filter(node => node.subsystemRestore?.version === 1).forEach(node => {
    const record = { ...node.subsystemRestore, linkId: node.id, href: node.href };
    lines.push(`    %% mindtree-subsystem ${encodeURIComponent(JSON.stringify(record))}`);
  });
  if (model.layoutMetadata || model.nodes.some(node => node.layoutLocked)) {
    const layout = {
      version: 1,
      nodes: model.nodes.map(node => ({ id: node.id, x: Math.round(Number(node.x) || 0), y: Math.round(Number(node.y) || 0), layoutLocked: Boolean(node.layoutLocked) }))
    };
    lines.push(`    %% mindtree-layout ${encodeURIComponent(JSON.stringify(layout))}`);
  }
  lines.push('');
  return lines.join('\n');
}

function visualMeasure(node) {
  const lines = visualTextLines(node);
  const widest = Math.max(...lines.map(line => [...line].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 16 : 9), 0)), 72);
  node.width = Math.max(node.type === 'diamond' ? 116 : 150, Math.min(node.type === 'diamond' ? 230 : 340, widest + 42));
  node.height = Math.max(node.type === 'diamond' ? node.width : 58, lines.length * 25 + 34);
}

function layoutVisualModel(model) {
  model.nodes.forEach(visualMeasure);
  const ranks = new Map(model.nodes.map(node => [node.id, 0]));
  const incoming = new Map(model.nodes.map(node => [node.id, 0]));
  const outgoing = new Map(model.nodes.map(node => [node.id, []]));
  model.edges.forEach(edge => {
    if (edge.direction === 'invisible' || edge.direction === 'none') return;
    const from = edge.direction === 'reverse' ? edge.target : edge.source;
    const to = edge.direction === 'reverse' ? edge.source : edge.target;
    if (from === to || !outgoing.has(from) || !incoming.has(to)) return;
    outgoing.get(from).push(to);
    incoming.set(to, incoming.get(to) + 1);
  });
  const queue = [...incoming.entries()].filter(([, count]) => count === 0).map(([id]) => id);
  const processed = new Set();
  while (processed.size < model.nodes.length) {
    if (!queue.length) {
      const cycleNode = model.nodes.find(node => !processed.has(node.id));
      if (!cycleNode) break;
      queue.push(cycleNode.id);
    }
    const id = queue.shift();
    if (processed.has(id)) continue;
    processed.add(id);
    outgoing.get(id).forEach(target => {
      if (!processed.has(target)) ranks.set(target, Math.max(ranks.get(target) || 0, (ranks.get(id) || 0) + 1));
      incoming.set(target, Math.max(0, incoming.get(target) - 1));
      if (incoming.get(target) === 0) queue.push(target);
    });
  }
  const locked = new Set(model.nodes.filter(node => node.layoutLocked).map(node => node.id));
  locked.forEach(id => {
    const node = model.nodes.find(item => item.id === id);
    if (node) ranks.set(id, Math.max(0, Math.round((node.y - 90) / 160)));
  });
  const directedEdges = model.edges.map(edge => {
    if (edge.direction === 'invisible' || edge.direction === 'none') return null;
    const from = edge.direction === 'reverse' ? edge.target : edge.source;
    const to = edge.direction === 'reverse' ? edge.source : edge.target;
    return from !== to && outgoing.has(from) && incoming.has(to) ? { from, to } : null;
  }).filter(Boolean);
  for (let pass = 0; pass < Math.max(2, model.nodes.length * 2); pass += 1) {
    let changed = false;
    directedEdges.forEach(({ from, to }) => {
      if (locked.has(from) && locked.has(to)) return;
      if (locked.has(from) && !locked.has(to)) {
        const next = Math.max(ranks.get(to) || 0, (ranks.get(from) || 0) + 1);
        if (next !== ranks.get(to)) { ranks.set(to, next); changed = true; }
        return;
      }
      if (!locked.has(from) && locked.has(to)) {
        const next = Math.min(ranks.get(from) || 0, Math.max(0, (ranks.get(to) || 0) - 1));
        if (next !== ranks.get(from)) { ranks.set(from, next); changed = true; }
        return;
      }
      const next = Math.max(ranks.get(to) || 0, (ranks.get(from) || 0) + 1);
      if (next !== ranks.get(to)) { ranks.set(to, next); changed = true; }
    });
    if (!changed) break;
  }
  const levels = new Map();
  model.nodes.forEach(node => {
    const rank = ranks.get(node.id) || 0;
    if (!levels.has(rank)) levels.set(rank, []);
    levels.get(rank).push(node);
  });
  [...levels.entries()].sort((a, b) => a[0] - b[0]).forEach(([rank, nodes]) => {
    const gap = 56;
    const fixed = nodes.filter(node => locked.has(node.id));
    const floating = nodes.filter(node => !locked.has(node.id)).sort((a, b) => a.id.localeCompare(b.id));
    if (!floating.length) return;
    const fixedY = fixed.length ? fixed.reduce((sum, node) => sum + node.y, 0) / fixed.length : 90 + rank * 160;
    if (!fixed.length) {
      const total = floating.reduce((sum, node) => sum + node.width, 0) + gap * Math.max(0, floating.length - 1);
      let x = Math.max(80, (1400 - total) / 2);
      floating.forEach(node => { node.x = x + node.width / 2; node.y = fixedY; x += node.width + gap; });
      return;
    }
    const occupied = [...fixed];
    const center = fixed.reduce((sum, node) => sum + node.x, 0) / fixed.length;
    floating.forEach(node => {
      let chosenX = center;
      for (let step = 0; step < floating.length * 8 + 8; step += 1) {
        if (step === 0) chosenX = center;
        else {
          const distance = Math.ceil(step / 2) * Math.max(180, node.width + gap);
          chosenX = center + (step % 2 ? 1 : -1) * distance;
        }
        const clear = occupied.every(other => Math.abs(chosenX - other.x) >= (node.width + other.width) / 2 + gap);
        if (clear) break;
      }
      node.x = Math.max(80, chosenX);
      node.y = fixedY;
      occupied.push(node);
    });
  });
}

function nodeBoundary(node, toward) {
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  if (!dx && !dy) return { x: node.x, y: node.y };
  if (node.type === 'diamond') {
    const scale = 1 / (Math.abs(dx) / (node.width / 2) + Math.abs(dy) / (node.height / 2));
    return { x: node.x + dx * scale, y: node.y + dy * scale };
  }
  const scale = Math.min((node.width / 2) / Math.abs(dx || Infinity), (node.height / 2) / Math.abs(dy || Infinity));
  return { x: node.x + dx * scale, y: node.y + dy * scale };
}

function groupBounds(model, group) {
  const nodes = group.nodeIds.map(id => model.nodes.find(node => node.id === id)).filter(Boolean);
  if (!nodes.length) return null;
  const left = Math.min(...nodes.map(node => node.x - node.width / 2)) - 28;
  const top = Math.min(...nodes.map(node => node.y - node.height / 2)) - 42;
  const right = Math.max(...nodes.map(node => node.x + node.width / 2)) + 28;
  const bottom = Math.max(...nodes.map(node => node.y + node.height / 2)) + 28;
  return { left, top, width: right - left, height: bottom - top };
}

window.MindTreeVisualModel = { VISUAL_IMAGE_MARKER, escHtml, escAttr, stripHtml, parseVisualLabel, readVisualNodeToken, parseVisualGraph, mermaidLabel, visualTextLines, serializeVisualGraph, visualMeasure, layoutVisualModel, nodeBoundary, groupBounds };

