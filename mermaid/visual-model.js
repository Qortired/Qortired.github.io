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
  const layoutEdgeRecords = [];
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
        if (parsed?.version === 1 && Array.isArray(parsed.edges)) layoutEdgeRecords.push(...parsed.edges);
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
  if (layoutEdgeRecords.length) {
    const offsets = new Map(layoutEdgeRecords.map(record => [String(record.id || ''), record]));
    model.edges.forEach(edge => {
      const saved = offsets.get(edge.id);
      if (saved && Number.isFinite(Number(saved.parallelOffset))) edge.parallelOffset = Number(saved.parallelOffset);
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
    const edgeLayouts = model.edges
      .filter(edge => Number.isFinite(Number(edge.parallelOffset)))
      .map(edge => ({ id: edge.id, parallelOffset: Number(edge.parallelOffset) }));
    const layout = {
      version: 1,
      nodes: model.nodes.map(node => ({ id: node.id, x: Math.round(Number(node.x) || 0), y: Math.round(Number(node.y) || 0), layoutLocked: Boolean(node.layoutLocked) })),
      ...(edgeLayouts.length ? { edges: edgeLayouts } : {})
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

function allocateVisualId(preferredId, fallbackPrefix, reservedIds) {
  const preferred = String(preferredId || '').trim();
  if (preferred && !reservedIds.has(preferred)) {
    reservedIds.add(preferred);
    return preferred;
  }
  let number = 1;
  let candidate = `${fallbackPrefix}${number}`;
  while (reservedIds.has(candidate)) {
    number += 1;
    candidate = `${fallbackPrefix}${number}`;
  }
  reservedIds.add(candidate);
  return candidate;
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

function initializeVisualLayout(model, options = {}) {
  const preserveLocked = Boolean(options.preserveLocked);
  const lockedPositions = preserveLocked
    ? new Map(model.nodes.filter(node => node.layoutLocked).map(node => [node.id, { x: node.x, y: node.y }]))
    : new Map();
  if (!preserveLocked) model.nodes.forEach(node => { node.layoutLocked = false; });
  model.edges.forEach(edge => { delete edge.parallelOffset; });
  model.layoutMetadata = true;
  model.nodes.forEach(visualMeasure);
  if (!model.nodes.length) return;

  const nodeById = new Map(model.nodes.map(node => [node.id, node]));
  const incoming = new Map(model.nodes.map(node => [node.id, new Set()]));
  const outgoing = new Map(model.nodes.map(node => [node.id, new Set()]));
  const addDirectedEdge = (from, to) => {
    if (from === to || !nodeById.has(from) || !nodeById.has(to)) return;
    outgoing.get(from).add(to);
    incoming.get(to).add(from);
  };
  model.edges.forEach(edge => {
    if (edge.direction === 'invisible' || edge.direction === 'none') return;
    if (edge.direction === 'reverse') addDirectedEdge(edge.target, edge.source);
    else {
      addDirectedEdge(edge.source, edge.target);
      if (edge.direction === 'both') addDirectedEdge(edge.target, edge.source);
    }
  });

  const ranks = new Map(model.nodes.map(node => [node.id, 0]));
  const remainingIncoming = new Map(model.nodes.map(node => [node.id, incoming.get(node.id).size]));
  const queue = model.nodes.filter(node => remainingIncoming.get(node.id) === 0).map(node => node.id).sort();
  const processed = new Set();
  while (processed.size < model.nodes.length) {
    if (!queue.length) {
      const cycleNode = model.nodes.filter(node => !processed.has(node.id)).sort((a, b) => {
        const incomingA = [...incoming.get(a.id)].filter(id => !processed.has(id)).length;
        const incomingB = [...incoming.get(b.id)].filter(id => !processed.has(id)).length;
        return incomingA - incomingB || a.id.localeCompare(b.id);
      })[0];
      if (!cycleNode) break;
      queue.push(cycleNode.id);
    }
    const id = queue.shift();
    if (processed.has(id)) continue;
    processed.add(id);
    outgoing.get(id).forEach(target => {
      if (processed.has(target)) return;
      ranks.set(target, Math.max(ranks.get(target) || 0, (ranks.get(id) || 0) + 1));
      remainingIncoming.set(target, Math.max(0, remainingIncoming.get(target) - 1));
      if (remainingIncoming.get(target) === 0) queue.push(target);
    });
  }

  const layers = new Map();
  model.nodes.forEach(node => {
    const rank = ranks.get(node.id) || 0;
    if (!layers.has(rank)) layers.set(rank, []);
    layers.get(rank).push(node);
  });
  const orderedLayers = [...layers.entries()].sort((a, b) => a[0] - b[0]).map(([, nodes]) => nodes.sort((a, b) => a.id.localeCompare(b.id)));
  const order = new Map();
  const updateOrder = layer => layer.forEach((node, index) => order.set(node.id, index));
  orderedLayers.forEach(updateOrder);
  const reorderLayer = (layer, direction) => {
    const decorated = layer.map((node, index) => {
      const neighbors = [...(direction === 'up' ? incoming.get(node.id) : outgoing.get(node.id))]
        .filter(id => (direction === 'up' ? ranks.get(id) < ranks.get(node.id) : ranks.get(id) > ranks.get(node.id)))
        .map(id => order.get(id))
        .filter(value => Number.isFinite(value));
      return { node, index, center: neighbors.length ? neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length : null };
    });
    decorated.sort((a, b) => {
      if (a.center === null && b.center !== null) return 1;
      if (a.center !== null && b.center === null) return -1;
      if (a.center !== null && b.center !== null && a.center !== b.center) return a.center - b.center;
      return a.index - b.index;
    });
    layer.splice(0, layer.length, ...decorated.map(item => item.node));
    updateOrder(layer);
  };
  for (let pass = 0; pass < 4; pass += 1) {
    orderedLayers.forEach(layer => reorderLayer(layer, 'up'));
    [...orderedLayers].reverse().forEach(layer => reorderLayer(layer, 'down'));
  }

  const horizontalGap = 124;
  const verticalGap = 96;
  const canvasWidth = Math.max(1800, Math.min(2600, 900 + model.nodes.length * 70));
  let y = 72;
  orderedLayers.forEach(layer => {
    const rowHeight = Math.max(...layer.map(node => node.height));
    const rowWidth = layer.reduce((sum, node) => sum + node.width, 0) + horizontalGap * Math.max(0, layer.length - 1);
    let x = Math.max(80, (canvasWidth - rowWidth) / 2);
    const centerY = y + rowHeight / 2;
    layer.forEach(node => {
      node.x = x + node.width / 2;
      node.y = centerY;
      x += node.width + horizontalGap;
    });
    y += rowHeight + verticalGap;
  });
  lockedPositions.forEach((position, id) => {
    const node = model.nodes.find(item => item.id === id);
    if (node) { node.x = position.x; node.y = position.y; node.layoutLocked = true; }
  });
  separateSubsystemGroups(model, { preserveLocked });
  if (!preserveLocked) alignVisualLayoutToCanvasOrigin(model);
}

function alignVisualLayoutToCanvasOrigin(model) {
  if (!model.nodes.length) return;
  const groupTops = model.groups.map(group => groupBounds(model, group)).filter(Boolean);
  const left = Math.min(
    ...model.nodes.map(node => node.x - node.width / 2),
    ...groupTops.map(bounds => bounds.left)
  );
  const top = Math.min(
    ...model.nodes.map(node => node.y - node.height / 2),
    ...groupTops.map(bounds => bounds.top)
  );
  const offsetX = 72 - left;
  const offsetY = 54 - top;
  model.nodes.forEach(node => {
    node.x += offsetX;
    node.y += offsetY;
  });
}

function translateGroupNodes(model, group, deltaX, deltaY, { preserveLocked = false } = {}) {
  const memberIds = new Set(group.nodeIds || []);
  model.nodes.filter(node => memberIds.has(node.id) && !(preserveLocked && node.layoutLocked)).forEach(node => {
    node.x += deltaX;
    node.y += deltaY;
  });
}

function separateSubsystemGroups(model, { preserveLocked = false } = {}) {
  // Subsystems are rendered as large containers. A node-by-node layout can
  // place two containers over one another even when their own nodes do not
  // collide. Candidate placements are scored for total area and aspect ratio,
  // so the result uses available width without becoming excessively wide.
  const gutter = 180;
  const groups = model.groups
    .filter(group => Array.isArray(group.nodeIds) && group.nodeIds.length)
    .map(group => ({ group, bounds: groupBounds(model, group) }))
    .filter(item => item.bounds)
    .sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left || a.group.id.localeCompare(b.group.id));
  const groupedNodeIds = new Set(groups.flatMap(item => item.group.nodeIds || []));
  const outsideNodes = model.nodes
    .filter(node => !groupedNodeIds.has(node.id))
    .map(node => ({
      left: node.x - node.width / 2,
      top: node.y - node.height / 2,
      right: node.x + node.width / 2,
      bottom: node.y + node.height / 2
    }));
  const placed = [];
  groups.forEach(item => {
    const obstacles = [
      ...placed.map(previous => previous.bounds),
      ...outsideNodes
    ];
    const candidateRect = candidate => ({
      left: item.bounds.left + candidate.x,
      top: item.bounds.top + candidate.y,
      right: item.bounds.left + item.bounds.width + candidate.x,
      bottom: item.bounds.top + item.bounds.height + candidate.y
    });
    const collides = (rect, obstacle) => rect.left < obstacle.right + gutter && rect.right > obstacle.left - gutter && rect.top < obstacle.bottom + gutter && rect.bottom > obstacle.top - gutter;
    const candidates = [{ x: 0, y: 0 }];
    const clearCandidates = [];
    const seen = new Set();
    for (let index = 0; index < candidates.length && index < 96; index += 1) {
      const candidate = candidates[index];
      const key = `${Math.round(candidate.x)}:${Math.round(candidate.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rect = candidateRect(candidate);
      const overlaps = obstacles.filter(obstacle => collides(rect, obstacle));
      if (!overlaps.length) { clearCandidates.push(candidate); continue; }
      overlaps.slice(0, 3).forEach(obstacle => {
        candidates.push({ x: obstacle.right + gutter - item.bounds.left, y: candidate.y });
        candidates.push({ x: candidate.x, y: obstacle.bottom + gutter - item.bounds.top });
      });
    }
    const available = clearCandidates.length ? clearCandidates : [{ x: 0, y: 0 }];
    const fixedBounds = [...outsideNodes, ...placed.map(previous => previous.bounds)];
    const best = available.sort((a, b) => {
      const score = candidate => {
        const rect = candidateRect(candidate);
        const extent = [...fixedBounds, rect];
        const left = Math.min(...extent.map(box => box.left));
        const right = Math.max(...extent.map(box => box.right));
        const top = Math.min(...extent.map(box => box.top));
        const bottom = Math.max(...extent.map(box => box.bottom));
        const width = right - left;
        const height = bottom - top;
        const aspectPenalty = Math.pow(Math.max(width, height) / Math.max(1, Math.min(width, height)) - 1, 2);
        return width * height * (1 + aspectPenalty * .18) + (Math.abs(candidate.x) + Math.abs(candidate.y)) * 160;
      };
      return score(a) - score(b);
    })[0];
    if (best.x || best.y) translateGroupNodes(model, item.group, best.x, best.y, { preserveLocked });
    const shiftedBounds = groupBounds(model, item.group);
    placed.push({ bounds: { ...shiftedBounds, right: shiftedBounds.left + shiftedBounds.width, bottom: shiftedBounds.top + shiftedBounds.height } });
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

window.MindTreeVisualModel = { VISUAL_IMAGE_MARKER, escHtml, escAttr, stripHtml, parseVisualLabel, readVisualNodeToken, parseVisualGraph, mermaidLabel, visualTextLines, serializeVisualGraph, visualMeasure, allocateVisualId, layoutVisualModel, initializeVisualLayout, nodeBoundary, groupBounds };

