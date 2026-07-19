(() => {
      const fileInput = document.getElementById('fileInput');
      const openButton = document.getElementById('openButton');
      const editButton = document.getElementById('editButton');
      const visualButton = document.getElementById('visualButton');
      const saveButton = document.getElementById('saveButton');
      const saveAsButton = document.getElementById('saveAsButton');
      const saveStatus = document.getElementById('saveStatus');
      const dropzone = document.getElementById('dropzone');
      const fileName = document.getElementById('fileName');
      const modeBadge = document.getElementById('modeBadge');
      const brandSubtitle = document.getElementById('brandSubtitle');
      const workspace = document.getElementById('workspace');
      const editorPanel = document.getElementById('editorPanel');
      const codeInput = document.getElementById('codeInput');
      const diagramOutput = document.getElementById('diagramOutput');
      const diagramScroll = document.getElementById('diagramScroll');
      const zoomLabel = document.getElementById('zoomLabel');
      const zoomIn = document.getElementById('zoomIn');
      const zoomOut = document.getElementById('zoomOut');
      const zoomReset = document.getElementById('zoomReset');
      const positionIndicator = document.getElementById('positionIndicator');
      const positionThumb = document.getElementById('positionThumb');
      const fileChangeNotice = document.getElementById('fileChangeNotice');
      const reloadFileButton = document.getElementById('reloadFileButton');
      const ignoreFileButton = document.getElementById('ignoreFileButton');
      const visualPanel = document.getElementById('visualPanel');
      const visualInspector = document.getElementById('visualInspector');
      const visualCanvas = document.getElementById('visualCanvas');
      const visualCanvasWrap = visualCanvas.closest('.visual-canvas-wrap');
      const visualStatus = document.getElementById('visualStatus');
      const visualError = document.getElementById('visualError');
      const inspectorBody = document.getElementById('inspectorBody');
      const visualSelectionType = document.getElementById('visualSelectionType');
      const visualSelect = document.getElementById('visualSelect');
      const addRectButton = document.getElementById('addRectButton');
      const addDiamondButton = document.getElementById('addDiamondButton');
      const connectButton = document.getElementById('connectButton');
      const groupButton = document.getElementById('groupButton');
      const layoutButton = document.getElementById('layoutButton');
      const undoButton = document.getElementById('undoButton');
      const redoButton = document.getElementById('redoButton');
      const closeVisualButton = document.getElementById('closeVisualButton');

      const isWebReadingRuntime = !window.electronAPI;
      if (isWebReadingRuntime) {
        [editButton, visualButton, saveButton, saveAsButton].forEach(button => {
          if (button) button.hidden = true;
        });
        modeBadge.textContent = '阅读模式';
        brandSubtitle.textContent = '在线阅读 Mermaid 图形，支持缩放、图片和子系统链接';
      }

      let editing = false;
      let currentFileName = 'diagram.mmd';
      let sourceText = '';
      let sourceFilePath = '';
      let sourceDirectoryUrl = '';
      let isDirty = false;
      let zoom = 1;
      let baseSvgWidth = 0;
      let renderId = 0;
      let renderTimer = null;
      let isPanning = false;
      let panStartX = 0;
      let panStartY = 0;
      let panScrollLeft = 0;
      let panScrollTop = 0;
      let isProgressDragging = false;
      let progressDragOffset = 0;
      let isReloadingExternalFile = false;
      let mobileAutoFit = true;
      const mobilePointers = new Map();
      let pinchStartDistance = 0;
      let pinchStartZoom = 1;
      let visualEditing = false;
      let visualMode = 'select';
      let visualModel = { direction: 'TB', nodes: [], edges: [], groups: [] };
      let visualZoom = 1;
      let visualSelection = null;
      let visualHistory = [];
      let visualFuture = [];
      let visualDrag = null;
      let visualConnectStart = '';
      let visualConnectPoint = null;
      let visualConnectTarget = '';
      let visualEdgeEndpointDrag = null;
      let visualEndpointTarget = '';
      let visualLastPointerPoint = null;
      let visualClipboardFallback = '';
      let visualTextEditBefore = null;
      let visualTextEditSelection = [];
      let visualRestoreDraft = null;
      let visualOriginalCode = '';
      let visualOriginalSourceCode = '';
      let visualWasDirty = false;

      const SVG_NS = 'http://www.w3.org/2000/svg';
      const {
        VISUAL_IMAGE_MARKER,
        escHtml,
        escAttr,
        stripHtml,
        parseVisualGraph,
        mermaidLabel,
        visualTextLines,
        serializeVisualGraph,
        visualMeasure,
        layoutVisualModel,
        nodeBoundary,
        groupBounds
      } = window.MindTreeVisualModel;
      const visualState = () => JSON.parse(JSON.stringify(visualModel));
      const visualNode = id => visualModel.nodes.find(node => node.id === id);
      const visualEdge = id => visualModel.edges.find(edge => edge.id === id);
      const visualGroup = id => visualModel.groups.find(group => group.id === id);
      const nextVisualId = prefix => {
        let number = 1;
        while (visualNode(`${prefix}${number}`) || visualEdge(`${prefix}${number}`) || visualGroup(`${prefix}${number}`)) number += 1;
        return `${prefix}${number}`;
      };

      const visualClipboardType = 'mindtree-visual-nodes';

      async function writeVisualClipboard(payload) {
        const text = JSON.stringify(payload);
        visualClipboardFallback = text;
        if (window.electronAPI?.writeClipboardText) {
          await window.electronAPI.writeClipboardText(text);
          return;
        }
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        }
      }

      async function readVisualClipboard() {
        if (window.electronAPI?.readClipboardText) {
          const text = await window.electronAPI.readClipboardText();
          if (text) return text;
        }
        if (navigator.clipboard?.readText) {
          try {
            const text = await navigator.clipboard.readText();
            if (text) return text;
          } catch {
            // Some non-Electron contexts deny clipboard reads; use the local fallback.
          }
        }
        return visualClipboardFallback;
      }

      function createSvgElement(tag, attrs = {}) {
        const element = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value));
        return element;
      }

      function setVisualError(message = '') {
        visualError.hidden = !message;
        visualError.textContent = message;
      }

      function setVisualStatus(message = '') {
        visualStatus.hidden = !message;
        visualStatus.textContent = message;
      }

      function updateVisualToolbarState() {
        const canGroup = visualSelection?.kind === 'nodes' && visualSelection.ids.length >= 2;
        groupButton.disabled = !canGroup;
        groupButton.title = canGroup ? '将选中的格子创建为可视化分组' : '请先选择至少两个格子';
      }


      function visualPoint(event) {
        const point = visualCanvas.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const matrix = visualCanvas.getScreenCTM();
        const transformed = matrix ? point.matrixTransform(matrix.inverse()) : point;
        return { x: transformed.x, y: transformed.y };
      }

      function visualCopySelection() {
        finishVisualTextEdit();
        if (visualSelection?.kind !== 'nodes' || !visualSelection.ids.length) {
          setVisualStatus('请先选择要复制的格子。');
          return;
        }
        const nodes = visualSelection.ids.map(visualNode).filter(Boolean);
        if (!nodes.length) return;
        const left = Math.min(...nodes.map(node => node.x - node.width / 2));
        const right = Math.max(...nodes.map(node => node.x + node.width / 2));
        const top = Math.min(...nodes.map(node => node.y - node.height / 2));
        const bottom = Math.max(...nodes.map(node => node.y + node.height / 2));
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;
        const payload = {
          type: visualClipboardType,
          version: 1,
          sourceFilePath,
          nodes: nodes.map(node => ({
            type: node.type === 'diamond' ? 'diamond' : 'rect',
            text: String(node.text || ''),
            href: String(node.href || ''),
            imagePath: String(node.imagePath || ''),
            imageLabel: String(node.imageLabel || ''),
            offsetX: Number(node.x) - centerX,
            offsetY: Number(node.y) - centerY
          }))
        };
        writeVisualClipboard(payload).then(() => {
          setVisualStatus(`已复制 ${nodes.length} 个格子`);
        }).catch(error => {
          setVisualError(`复制格子失败：${error?.message || error}`);
        });
      }

      async function rebasePastedResource(value, payload) {
        const rawValue = String(value || '');
        if (!rawValue || !payload.sourceFilePath || !sourceFilePath || payload.sourceFilePath === sourceFilePath || !window.electronAPI?.rebaseLocalResource || /^(?:https?:|mailto:|data:|javascript:|#)/i.test(rawValue)) {
          return { value: rawValue, failed: false };
        }
        try {
          return { value: await window.electronAPI.rebaseLocalResource(payload.sourceFilePath, sourceFilePath, rawValue), failed: false };
        } catch {
          return { value: rawValue, failed: true };
        }
      }

      async function pasteVisualNodes() {
        finishVisualTextEdit();
        let payload;
        try {
          payload = JSON.parse(await readVisualClipboard());
        } catch {
          return;
        }
        if (payload?.type !== visualClipboardType || payload.version !== 1 || !Array.isArray(payload.nodes) || !payload.nodes.length) return;
        const point = visualLastPointerPoint || { x: 700, y: 120 };
        const before = visualState();
        const pastedNodes = [];
        let resourceWarnings = 0;
        for (const item of payload.nodes) {
          const href = await rebasePastedResource(item.href, payload);
          const imagePath = await rebasePastedResource(item.imagePath, payload);
          resourceWarnings += Number(href.failed) + Number(imagePath.failed);
          const node = {
            id: nextVisualId(item.type === 'diamond' ? 'D' : 'N'),
            type: item.type === 'diamond' ? 'diamond' : 'rect',
            text: String(item.text || ''),
            href: href.value,
            imagePath: imagePath.value,
            imageLabel: String(item.imageLabel || ''),
            x: point.x + (Number(item.offsetX) || 0),
            y: point.y + (Number(item.offsetY) || 0),
            width: 160,
            height: 64,
            groupId: '',
            layoutLocked: true
          };
          visualMeasure(node);
          pastedNodes.push(node);
        }
        visualModel.nodes.push(...pastedNodes);
        visualModel.layoutMetadata = true;
        visualHistory.push(before); visualFuture = [];
        visualSelection = { kind: 'nodes', ids: pastedNodes.map(node => node.id) };
        markVisualDirty();
        setVisualError('');
        setVisualStatus(resourceWarnings ? `已粘贴 ${pastedNodes.length} 个格子，但有 ${resourceWarnings} 个本地路径未能自动修正。` : `已粘贴 ${pastedNodes.length} 个格子`);
        renderVisualModel();
      }

      function visualNodeAtClientPoint(clientX, clientY) {
        const element = document.elementFromPoint(clientX, clientY);
        const nodeElement = element instanceof Element ? element.closest('[data-node-id]') : null;
        return nodeElement?.dataset.nodeId || '';
      }


      function renderVisualModel(options = {}) {
        const visualBounds = visualModel.nodes.length ? {
          right: Math.max(...visualModel.nodes.map(node => node.x + node.width / 2)) + 120,
          bottom: Math.max(...visualModel.nodes.map(node => node.y + node.height / 2)) + 120
        } : { right: 1400, bottom: 900 };
        const visualWidth = Math.max(1400, visualBounds.right);
        const visualHeight = Math.max(900, visualBounds.bottom);
        visualCanvas.setAttribute('viewBox', `0 0 ${visualWidth} ${visualHeight}`);
        visualCanvas.style.width = `${visualWidth * visualZoom}px`;
        visualCanvas.style.height = `${visualHeight * visualZoom}px`;
        visualCanvas.style.setProperty('--visual-grid-size', `${Math.max(4, 20 * visualZoom)}px`);
        visualCanvas.replaceChildren();
        const defs = createSvgElement('defs');
        const marker = createSvgElement('marker', { id: 'visual-arrow', markerWidth: '9', markerHeight: '9', refX: '8', refY: '4', orient: 'auto', markerUnits: 'strokeWidth' });
        marker.append(createSvgElement('path', { d: 'M0,0 L8,4 L0,8 z', fill: '#4a4f5d' }));
        defs.append(marker);
        visualCanvas.append(defs);
        const edgeLayer = createSvgElement('g');
        visualCanvas.append(edgeLayer);
        visualModel.groups.forEach(group => {
          const bounds = groupBounds(visualModel, group);
          if (!bounds) return;
          const groupEl = createSvgElement('g', { class: `visual-group${visualSelection?.kind === 'group' && visualSelection.id === group.id ? ' selected' : ''}`, 'data-group-id': group.id });
          groupEl.append(createSvgElement('rect', { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height, rx: 13, fill: '#f7f7ff', stroke: '#9b91ef', 'stroke-width': '1.5' }));
          const title = createSvgElement('text', { x: bounds.left + 14, y: bounds.top + 24, class: 'visual-group-title' });
          title.textContent = group.title || group.id;
          groupEl.append(title);
          edgeLayer.append(groupEl);
        });
        const drawEdge = edge => {
          const from = visualNode(edge.source);
          const to = visualNode(edge.target);
          if (!from || !to) return;
          const start = nodeBoundary(from, to);
          const end = nodeBoundary(to, from);
          const edgeEl = createSvgElement('g', { class: `visual-edge${visualSelection?.kind === 'edge' && visualSelection.id === edge.id ? ' selected' : ''}`, 'data-edge-id': edge.id });
          const pathData = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
          edgeEl.append(createSvgElement('path', { class: 'visual-edge-hit', d: pathData, fill: 'none', stroke: '#000', 'stroke-opacity': '0', 'stroke-width': '10', 'pointer-events': 'stroke' }));
          const path = createSvgElement('path', { d: pathData, fill: 'none', stroke: edge.direction === 'invisible' ? 'transparent' : '#4a4f5d', 'stroke-width': edge.direction === 'invisible' ? '1' : '1.6', 'stroke-dasharray': edge.direction === 'invisible' ? '4 4' : '', 'marker-end': ['forward', 'both'].includes(edge.direction) ? 'url(#visual-arrow)' : '', 'marker-start': ['reverse', 'both'].includes(edge.direction) ? 'url(#visual-arrow)' : '' });
          edgeEl.append(path);
          if (edge.label) {
            const label = createSvgElement('text', { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 7, class: 'visual-edge-label', 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': '6', 'stroke-linejoin': 'round' });
            label.textContent = edge.label;
            edgeEl.append(label);
          }
          if (visualSelection?.kind === 'edge' && visualSelection.id === edge.id && ['forward', 'reverse'].includes(edge.direction)) {
            const endpoint = edge.direction === 'reverse' ? start : end;
            edgeEl.append(createSvgElement('circle', { class: 'visual-edge-endpoint', 'data-edge-endpoint': edge.direction === 'reverse' ? 'source' : 'target', cx: endpoint.x, cy: endpoint.y, r: '7', fill: '#fff', stroke: '#6557d8', 'stroke-width': '2.5' }));
          }
          edgeLayer.append(edgeEl);
        };
        visualModel.edges.forEach(drawEdge);
        if (visualConnectStart && visualConnectPoint) {
          const from = visualNode(visualConnectStart);
          if (from) {
            const start = nodeBoundary(from, visualConnectPoint);
            edgeLayer.append(createSvgElement('path', { d: `M ${start.x} ${start.y} L ${visualConnectPoint.x} ${visualConnectPoint.y}`, fill: 'none', stroke: '#6557d8', 'stroke-width': '2', 'stroke-dasharray': '5 4' }));
          }
        }
        if (visualEdgeEndpointDrag?.currentPoint) {
          const edge = visualEdge(visualEdgeEndpointDrag.edgeId);
          const fixedNode = edge ? visualNode(visualEdgeEndpointDrag.endpointRole === 'target' ? edge.source : edge.target) : null;
          if (fixedNode) {
            const start = nodeBoundary(fixedNode, visualEdgeEndpointDrag.currentPoint);
            edgeLayer.append(createSvgElement('path', { class: 'visual-edge-endpoint-preview', d: `M ${start.x} ${start.y} L ${visualEdgeEndpointDrag.currentPoint.x} ${visualEdgeEndpointDrag.currentPoint.y}`, fill: 'none', stroke: '#6557d8', 'stroke-width': '2.5', 'stroke-dasharray': '6 4', 'marker-end': 'url(#visual-arrow)' }));
          }
        }
        const nodeLayer = createSvgElement('g');
        visualCanvas.append(nodeLayer);
        visualModel.nodes.forEach(node => {
          visualMeasure(node);
          const selected = visualSelection?.kind === 'nodes' && visualSelection.ids.includes(node.id);
          const linked = Boolean(String(node.href || '').trim() || String(node.imagePath || '').trim());
          const connectTarget = (visualConnectTarget === node.id && visualConnectStart !== node.id) || (visualEndpointTarget === node.id && visualEdgeEndpointDrag?.fixedNodeId !== node.id);
          const nodeEl = createSvgElement('g', { class: `visual-node${selected ? ' selected' : ''}${linked ? ' has-link' : ''}${connectTarget ? ' connect-target' : ''}`, 'data-node-id': node.id, transform: `translate(${node.x} ${node.y})` });
          let shape;
          if (node.type === 'diamond') {
            shape = createSvgElement('polygon', { class: 'visual-shape', points: `0,${-node.height / 2} ${node.width / 2},0 0,${node.height / 2} ${-node.width / 2},0`, fill: '#eeecff', stroke: '#8f80ee', 'stroke-width': '1.6' });
          } else {
            shape = createSvgElement('rect', { class: 'visual-shape', x: -node.width / 2, y: -node.height / 2, width: node.width, height: node.height, rx: 2, fill: '#eeecff', stroke: '#8f80ee', 'stroke-width': '1.6' });
          }
          nodeEl.append(shape);
          const textLines = visualTextLines(node);
          const textStart = -((textLines.length - 1) * 11);
          textLines.forEach((line, index) => {
            const text = createSvgElement('text', { x: 0, y: textStart + index * 23, 'text-anchor': 'middle' });
            text.textContent = line;
            nodeEl.append(text);
          });
          nodeLayer.append(nodeEl);
        });
        if (visualDrag?.kind === 'marquee') {
          const left = Math.min(visualDrag.start.x, visualDrag.current.x);
          const top = Math.min(visualDrag.start.y, visualDrag.current.y);
          const width = Math.abs(visualDrag.current.x - visualDrag.start.x);
          const height = Math.abs(visualDrag.current.y - visualDrag.start.y);
          visualCanvas.append(createSvgElement('rect', { x: left, y: top, width, height, fill: 'rgba(101,87,216,.12)', stroke: '#6557d8', 'stroke-dasharray': '5 4' }));
        }
        updateVisualToolbarState();
        if (!options.skipInspector) renderVisualInspector();
      }

      function selectVisualNodes(ids) {
        visualSelection = ids.length ? { kind: 'nodes', ids } : null;
        renderVisualModel();
      }

      function isSubsystemFileHref(href) {
        return Boolean(href) && !/^https?:\/\//i.test(String(href)) && /(?:^|[\\/])decision-systems[\\/]/i.test(String(href)) && /\.(?:md|markdown|mmd|mermaid|txt)(?:[?#].*)?$/i.test(String(href));
      }

      function isRestorableSubsystemNode(node) {
        return Boolean(node?.subsystemRestore?.version === 1 || isSubsystemFileHref(node?.href));
      }

      function subsystemBoundaryCandidates(model) {
        const incoming = new Set();
        const outgoing = new Set();
        const addDirection = (from, to) => {
          if (from && to && from !== to) { outgoing.add(from); incoming.add(to); }
        };
        model.edges.forEach(edge => {
          if (edge.direction === 'invisible' || edge.direction === 'none') return;
          if (edge.direction === 'reverse') addDirection(edge.target, edge.source);
          else if (edge.direction === 'both') { addDirection(edge.source, edge.target); addDirection(edge.target, edge.source); }
          else addDirection(edge.source, edge.target);
        });
        const nodes = model.nodes;
        return {
          entries: nodes.filter(node => !incoming.has(node.id)),
          exits: nodes.filter(node => !outgoing.has(node.id))
        };
      }

      function mapSubsystemExternalEdge(edge, linkId, entryId, exitId) {
        const mapped = { ...edge };
        const sourceRole = edge.direction === 'reverse' ? 'entry' : 'exit';
        const targetRole = edge.direction === 'reverse' ? 'exit' : 'entry';
        if (mapped.source === linkId) mapped.source = sourceRole === 'entry' ? entryId : exitId;
        if (mapped.target === linkId) mapped.target = targetRole === 'entry' ? entryId : exitId;
        return mapped;
      }

      function restoreNodeLabel(node) {
        return visualTextLines(node).join(' / ') || node.id;
      }

      async function rebaseRestoredNode(node, childFilePath) {
        if (!window.electronAPI?.rebaseLocalResource) return;
        if (node.imagePath) node.imagePath = await window.electronAPI.rebaseLocalResource(childFilePath, sourceFilePath, node.imagePath);
        if (node.href && !/^https?:\/\//i.test(node.href)) node.href = await window.electronAPI.rebaseLocalResource(childFilePath, sourceFilePath, node.href);
        if (node.subsystemRestore?.href && !/^https?:\/\//i.test(node.subsystemRestore.href)) {
          node.subsystemRestore.href = await window.electronAPI.rebaseLocalResource(childFilePath, sourceFilePath, node.subsystemRestore.href);
        }
      }

      async function prepareVisualSubsystemRestore() {
        const node = visualNode(visualSelection?.ids?.[0]);
        if (!node || !isRestorableSubsystemNode(node)) return;
        if (!sourceFilePath || !window.electronAPI?.resolveLocalResource || !window.electronAPI?.readSourceFile) {
          throw new Error('复原子系统需要在 Electron 桌面端打开本地主文件。');
        }
        const resource = await window.electronAPI.resolveLocalResource(sourceFilePath, node.href);
        if (!resource?.filePath) throw new Error(`找不到子系统文件：${node.href}`);
        const source = await window.electronAPI.readSourceFile(resource.filePath);
        const code = extractMermaid(source.content);
        if (!code) throw new Error('子系统文件中没有找到 Mermaid 图代码。');
        const childModel = parseVisualGraph(code);
        if (!childModel.nodes.length) throw new Error('子系统文件没有可复原的格子。');
        for (const childNode of childModel.nodes) await rebaseRestoredNode(childNode, resource.filePath);

        const record = node.subsystemRestore?.version === 1 ? node.subsystemRestore : null;
        const boundary = subsystemBoundaryCandidates(childModel);
        const externalEdges = record?.externalEdges?.length
          ? record.externalEdges.map(edge => ({ ...edge }))
          : visualModel.edges.filter(edge => edge.source === node.id || edge.target === node.id).map(edge => ({ ...edge }));
        const mappings = externalEdges.map(edge => ({
          edgeId: edge.id,
          role: edge.direction === 'reverse'
            ? edge.source === node.id ? 'entry' : 'exit'
            : edge.target === node.id ? 'entry' : 'exit',
          nodeId: ''
        }));
        if (record) {
          const childIds = new Set(childModel.nodes.map(item => item.id));
          record.nodes?.forEach(item => { if (!childIds.has(item.id)) throw new Error(`子系统文件缺少原格子：${item.id}`); });
          mappings.forEach(mapping => {
            const edge = externalEdges.find(item => item.id === mapping.edgeId);
            const endpoint = [edge?.source, edge?.target].find(item => childIds.has(item));
            if (endpoint) mapping.nodeId = endpoint;
          });
        } else {
          mappings.forEach(mapping => {
            const candidates = mapping.role === 'entry' ? boundary.entries : boundary.exits;
            if (candidates.length === 1) mapping.nodeId = candidates[0].id;
          });
        }
        visualRestoreDraft = {
          nodeId: node.id,
          fileName: resource.fileName || node.href,
          filePath: resource.filePath,
          node,
          childModel,
          record,
          externalEdges,
          mappings,
          boundary,
          legacy: !record
        };
        setVisualError('');
        setVisualStatus(record ? '已读取子系统内容，请确认后复原。' : '已读取旧子系统，请确认入口和出口连接后复原。');
        renderVisualModel();
      }

      function remapRestoredMetadata(record, idMap, linkId) {
        if (!record) return record;
        const mapped = JSON.parse(JSON.stringify(record));
        mapped.linkId = idMap.get(record.linkId) || linkId;
        mapped.nodes = (record.nodes || []).map(node => ({ ...node, id: idMap.get(node.id) || node.id }));
        mapped.externalEdges = (record.externalEdges || []).map(edge => ({ ...edge, source: idMap.get(edge.source) || edge.source, target: idMap.get(edge.target) || edge.target }));
        return mapped;
      }

      async function applyVisualSubsystemRestore() {
        const draft = visualRestoreDraft;
        if (!draft || draft.nodeId !== visualSelection?.ids?.[0]) return;
        if (draft.mappings.some(mapping => !mapping.nodeId)) {
          setVisualError('请为所有外部箭头选择入口或出口格子。');
          return;
        }
        const before = visualState();
        try {
          const existingIds = new Set(visualModel.nodes.filter(item => item.id !== draft.nodeId).map(item => item.id));
          const idMap = new Map();
          draft.childModel.nodes.forEach(node => {
            let id = node.id;
            if (existingIds.has(id) || idMap.has(id)) id = nextVisualId(node.type === 'diamond' ? 'D' : 'N');
            idMap.set(node.id, id); existingIds.add(id);
          });
          const groupId = draft.record?.groupId && !visualGroup(draft.record.groupId) ? draft.record.groupId : nextVisualId('G');
          const restoredNodes = draft.childModel.nodes.map(node => {
            const snapshot = draft.record?.nodes?.find(item => item.id === node.id);
            const restored = { ...node, id: idMap.get(node.id), groupId };
            if (snapshot) Object.assign(restored, { x: snapshot.x, y: snapshot.y, width: snapshot.width, height: snapshot.height, layoutLocked: Boolean(snapshot.layoutLocked) });
            if (restored.subsystemRestore) restored.subsystemRestore = remapRestoredMetadata(restored.subsystemRestore, idMap, restored.id);
            return restored;
          });
          const usedEdgeIds = new Set(visualModel.edges.filter(edge => edge.source !== draft.nodeId && edge.target !== draft.nodeId).map(edge => edge.id));
          const makeEdgeId = edge => {
            let id = edge.id;
            if (usedEdgeIds.has(id)) id = nextVisualId('E');
            usedEdgeIds.add(id); return id;
          };
          const restoredEdges = draft.childModel.edges.map(edge => ({ ...edge, id: makeEdgeId(edge), source: idMap.get(edge.source) || edge.source, target: idMap.get(edge.target) || edge.target }));
          const externalEdges = draft.record?.externalEdges?.length
            ? draft.record.externalEdges.map(edge => ({ ...edge, id: makeEdgeId(edge), source: idMap.get(edge.source) || edge.source, target: idMap.get(edge.target) || edge.target }))
            : draft.externalEdges.map(edge => {
              const mappingFor = role => draft.mappings.find(mapping => mapping.edgeId === edge.id && mapping.role === role)?.nodeId;
              const entryId = idMap.get(mappingFor('entry')) || mappingFor('entry');
              const exitId = idMap.get(mappingFor('exit')) || mappingFor('exit');
              return { ...mapSubsystemExternalEdge(edge, draft.nodeId, entryId, exitId), id: makeEdgeId(edge) };
            });
          if (externalEdges.some(edge => !edge.source || !edge.target || edge.source === edge.target)) throw new Error('外部箭头复原后出现无效连接。');

          if (!window.electronAPI?.deleteSubsystemFile) throw new Error('当前程序不支持安全删除子系统文件，请重新打包后重试。');
          await window.electronAPI.deleteSubsystemFile(sourceFilePath, draft.node.href);

          visualModel.nodes = visualModel.nodes.filter(item => item.id !== draft.nodeId);
          visualModel.edges = visualModel.edges.filter(edge => edge.source !== draft.nodeId && edge.target !== draft.nodeId);
          visualModel.nodes.push(...restoredNodes);
          visualModel.edges.push(...restoredEdges, ...externalEdges);
          visualModel.groups.push({ id: groupId, title: draft.record?.title || draft.node.text || '复原子系统', nodeIds: restoredNodes.map(node => node.id), href: '', linkedFile: '', collapsed: false });
          visualHistory.push(before); visualFuture = []; visualRestoreDraft = null; visualSelection = { kind: 'group', id: groupId }; markVisualDirty(); layoutVisualModel(visualModel); renderVisualModel();
          setVisualStatus(`子分组已复原，子系统文件已删除：${draft.fileName}，请保存主图。`);
          setVisualError('');
        } catch (error) {
          setVisualError(`复原子系统失败：${error?.message || error}`);
          setVisualStatus('复原失败，原链接和文件均已保留。');
        }
      }

      function cancelVisualSubsystemRestore() {
        visualRestoreDraft = null;
        setVisualError('');
        setVisualStatus('已取消子分组复原。');
        renderVisualModel();
      }

      function restoreDraftMarkup(draft) {
        if (!draft) return '';
        const choices = role => (role === 'entry' ? draft.boundary.entries : draft.boundary.exits);
        const ambiguous = draft.mappings.some(mapping => !mapping.nodeId);
        const mappingMarkup = draft.legacy && draft.externalEdges.length
          ? `<p class="inspector-warning">旧链接没有保存原始外部箭头关系，请选择每条箭头对应的${ambiguous ? '入口或出口' : '格子'}。</p>${draft.mappings.map(mapping => {
            const edge = draft.externalEdges.find(item => item.id === mapping.edgeId);
            const options = choices(mapping.role);
            return `<label>箭头 ${escHtml(edge?.label || mapping.edgeId)}（${mapping.role === 'entry' ? '进入子系统' : '离开子系统'}）<select data-restore-edge="${escAttr(mapping.edgeId)}"><option value="">请选择</option>${options.map(node => `<option value="${escAttr(node.id)}" ${mapping.nodeId === node.id ? 'selected' : ''}>${escHtml(restoreNodeLabel(node))}</option>`).join('')}</select></label>`;
          }).join('')}` : `<p class="inspector-empty">将恢复子系统格子、箭头和分组，并删除 ${escHtml(draft.fileName)}。图片文件不会删除。</p>`;
        return `<div class="restore-confirm"><strong>确认复原子分组</strong>${mappingMarkup}<div class="inspector-actions"><button id="confirmRestoreSubsystemButton" type="button" ${ambiguous ? 'disabled' : ''}>确认复原并删除文件</button><button id="cancelRestoreSubsystemButton" type="button">取消</button></div></div>`;
      }

      function renderVisualInspector() {
        if (!visualEditing) return;
        if (!visualSelection) {
          visualSelectionType.textContent = '未选择';
          inspectorBody.innerHTML = '<div class="inspector-empty">选择一个格子、箭头或子系统后，可以编辑其属性。</div>';
          return;
        }
        if (visualSelection.kind === 'nodes') {
          const nodes = visualSelection.ids.map(visualNode).filter(Boolean);
          const node = nodes[0];
          visualSelectionType.textContent = nodes.length > 1 ? `${nodes.length} 个格子` : node?.type === 'diamond' ? '菱形格子' : '矩形格子';
          if (!node) return;
          const visibleText = String(node.text || '').replace(VISUAL_IMAGE_MARKER, node.imageLabel ? `[${node.imageLabel}]` : '[图片链接]');
          const restoreSection = nodes.length === 1 && isRestorableSubsystemNode(node)
            ? `<div class="restore-section"><button id="prepareRestoreSubsystemButton" type="button">复原子分组（删除链接文件）</button>${visualRestoreDraft?.nodeId === node.id ? restoreDraftMarkup(visualRestoreDraft) : ''}</div>`
            : '';
          inspectorBody.innerHTML = `<label>格子文字<textarea id="visualTextInput">${escHtml(visibleText)}</textarea></label><label>格子样式<select id="visualTypeInput"><option value="rect" ${node.type === 'rect' ? 'selected' : ''}>矩形</option><option value="diamond" ${node.type === 'diamond' ? 'selected' : ''}>斜正方形</option></select></label><label>超链接（可选）<input id="visualHrefInput" value="${escHtml(node.href)}" placeholder="相对路径或 https://..."></label><label>图片链接路径（可选）<input id="visualImageInput" value="${escHtml(node.imagePath)}" placeholder="images/example.png"></label><label>图片链接显示文字（可选）<input id="visualImageLabelInput" value="${escHtml(node.imageLabel)}" placeholder="查看图片"></label><div class="inspector-actions"><button id="insertImageButton" type="button">插入图片链接</button><button id="openVisualLinkButton" type="button" ${node.href ? '' : 'disabled'}>打开链接</button><button id="openVisualImageButton" type="button" ${node.imagePath ? '' : 'disabled'}>打开图片</button><button id="deleteVisualButton" type="button">删除格子</button></div>${restoreSection}${nodes.length < 2 ? '<p class="inspector-empty">按住 Ctrl（或 Cmd）继续选择格子，至少选择两个后即可创建分组。</p>' : ''}`;
          const visualTextInput = document.getElementById('visualTextInput');
          visualTextInput.addEventListener('focus', beginVisualTextEdit);
          visualTextInput.addEventListener('input', event => updateSelectedVisualTextLive(event.target.value));
          visualTextInput.addEventListener('blur', finishVisualTextEdit);
          document.getElementById('visualTypeInput').addEventListener('change', event => updateSelectedVisualNodes({ type: event.target.value }));
          document.getElementById('visualHrefInput').addEventListener('change', event => updateSelectedVisualNodes({ href: event.target.value.trim() }));
          document.getElementById('visualImageInput').addEventListener('change', event => updateSelectedVisualNodes({ imagePath: event.target.value.trim() }));
          document.getElementById('visualImageLabelInput').addEventListener('change', event => updateSelectedVisualNodes({ imageLabel: event.target.value.trim() }));
          document.getElementById('deleteVisualButton').addEventListener('click', deleteSelectedVisual);
          document.getElementById('openVisualLinkButton').addEventListener('click', () => openVisualLink(node.href));
          document.getElementById('openVisualImageButton').addEventListener('click', () => openVisualImage(node.imagePath));
          document.getElementById('insertImageButton').addEventListener('click', chooseVisualImage);
          const prepareRestoreButton = document.getElementById('prepareRestoreSubsystemButton');
          if (prepareRestoreButton) prepareRestoreButton.addEventListener('click', async () => {
            prepareRestoreButton.disabled = true;
            setVisualError('');
            setVisualStatus(`正在读取子系统文件：${node.href}…`);
            try {
              await prepareVisualSubsystemRestore();
            } catch (error) {
              setVisualError(`读取子系统失败：${error?.message || error}`);
              setVisualStatus('读取失败，原链接和文件均已保留。');
              prepareRestoreButton.disabled = false;
            }
          });
          inspectorBody.querySelectorAll('[data-restore-edge]').forEach(select => select.addEventListener('change', event => {
            const mapping = visualRestoreDraft?.mappings.find(item => item.edgeId === event.target.dataset.restoreEdge);
            if (!mapping) return;
            mapping.nodeId = event.target.value;
            renderVisualInspector();
          }));
          const confirmRestoreButton = document.getElementById('confirmRestoreSubsystemButton');
          if (confirmRestoreButton) confirmRestoreButton.addEventListener('click', async () => {
            confirmRestoreButton.disabled = true;
            await applyVisualSubsystemRestore();
          });
          const cancelRestoreButton = document.getElementById('cancelRestoreSubsystemButton');
          if (cancelRestoreButton) cancelRestoreButton.addEventListener('click', cancelVisualSubsystemRestore);
          return;
        }
        if (visualSelection.kind === 'edge') {
          const edge = visualEdge(visualSelection.id);
          visualSelectionType.textContent = '箭头';
          const endpointHint = ['forward', 'reverse'].includes(edge?.direction) ? '<p class="inspector-empty">拖动画布上的箭头尖端，可以修改箭头指向。</p>' : '<p class="inspector-empty">双向、无箭头和隐藏线暂不支持拖动端点。</p>';
          inspectorBody.innerHTML = `<label>箭头文字<textarea id="visualEdgeLabelInput">${escHtml(edge?.label || '')}</textarea></label>${endpointHint}<div class="inspector-actions"><button id="flipVisualEdgeButton" type="button">翻转方向</button><button id="deleteVisualEdgeButton" type="button">删除箭头</button></div>`;
          document.getElementById('visualEdgeLabelInput').addEventListener('change', event => {
            const before = visualState();
            edge.label = event.target.value.trim();
            visualHistory.push(before); visualFuture = []; markVisualDirty(); renderVisualModel();
          });
          document.getElementById('flipVisualEdgeButton').addEventListener('click', () => {
            const before = visualState();
            if (edge.direction === 'forward') edge.direction = 'reverse';
            else if (edge.direction === 'reverse') edge.direction = 'forward';
            else if (edge.direction === 'both') edge.direction = 'forward';
            visualHistory.push(before); visualFuture = []; markVisualDirty(); renderVisualModel();
          });
          document.getElementById('deleteVisualEdgeButton').addEventListener('click', deleteSelectedVisual);
          return;
        }
        const group = visualGroup(visualSelection.id);
        visualSelectionType.textContent = '子系统';
        inspectorBody.innerHTML = `<label>子系统标题<input id="visualGroupTitleInput" value="${escHtml(group?.title || '')}"></label><p class="inspector-empty">已包含 ${group?.nodeIds.length || 0} 个格子。第一步分组已完成；确认标题后可生成 decision-systems 下的 Markdown 文件。</p><div class="inspector-actions"><button id="convertSubsystemButton" type="button">生成子系统文件并替换为超链接格子</button><button id="deleteVisualGroupButton" type="button">取消分组</button></div>`;
        document.getElementById('visualGroupTitleInput').addEventListener('change', event => {
          const before = visualState(); group.title = event.target.value.trim() || group.id; visualHistory.push(before); visualFuture = []; markVisualDirty(); renderVisualModel();
        });
        const groupTitleInput = document.getElementById('visualGroupTitleInput');
        groupTitleInput.focus();
        groupTitleInput.select();
        document.getElementById('convertSubsystemButton').addEventListener('click', convertVisualGroupToSubsystem);
        document.getElementById('deleteVisualGroupButton').addEventListener('click', () => {
          const before = visualState();
          group.nodeIds.forEach(id => { const node = visualNode(id); if (node) node.groupId = ''; });
          visualModel.groups = visualModel.groups.filter(item => item.id !== group.id);
          visualHistory.push(before); visualFuture = []; visualSelection = null; markVisualDirty(); renderVisualModel();
        });
      }

      function markVisualDirty() {
        isDirty = true;
        setSaveStatus('未保存');
      }

      function beginVisualTextEdit() {
        if (visualTextEditBefore || visualSelection?.kind !== 'nodes') return;
        visualTextEditBefore = visualState();
        visualTextEditSelection = [...visualSelection.ids];
      }

      function finishVisualTextEdit() {
        if (!visualTextEditBefore) return;
        const before = visualTextEditBefore;
        const changed = JSON.stringify(before) !== JSON.stringify(visualModel);
        if (changed) {
          visualHistory.push(before);
          visualFuture = [];
        }
        visualTextEditBefore = null;
        visualTextEditSelection = [];
      }

      function updateSelectedVisualTextLive(text) {
        beginVisualTextEdit();
        const ids = visualTextEditSelection.length ? visualTextEditSelection : visualSelection?.ids || [];
        ids.forEach(id => {
          const node = visualNode(id);
          if (node) node.text = text;
        });
        visualModel.nodes.forEach(visualMeasure);
        markVisualDirty();
        renderVisualModel({ skipInspector: true });
      }

      function updateSelectedVisualNodes(changes) {
        finishVisualTextEdit();
        const before = visualState();
        visualSelection.ids.forEach(id => {
          const node = visualNode(id);
          if (!node) return;
          Object.assign(node, changes);
          if (Object.prototype.hasOwnProperty.call(changes, 'href') && node.subsystemRestore && changes.href !== node.subsystemRestore.href) delete node.subsystemRestore;
        });
        visualModel.nodes.forEach(visualMeasure);
        layoutVisualModel(visualModel);
        visualHistory.push(before); visualFuture = []; markVisualDirty(); renderVisualModel();
      }

      function deleteSelectedVisual() {
        finishVisualTextEdit();
        const before = visualState();
        if (visualSelection?.kind === 'nodes') {
          const ids = new Set(visualSelection.ids);
          visualModel.nodes = visualModel.nodes.filter(node => !ids.has(node.id));
          visualModel.edges = visualModel.edges.filter(edge => !ids.has(edge.source) && !ids.has(edge.target));
          visualModel.groups.forEach(group => { group.nodeIds = group.nodeIds.filter(id => !ids.has(id)); });
        } else if (visualSelection?.kind === 'edge') {
          visualModel.edges = visualModel.edges.filter(edge => edge.id !== visualSelection.id);
        }
        visualHistory.push(before); visualFuture = []; visualSelection = null; markVisualDirty(); layoutVisualModel(visualModel); renderVisualModel();
      }

      function makeVisualNode(type, x, y, groupId = '') {
        return { id: nextVisualId(type === 'diamond' ? 'D' : 'N'), type, text: type === 'diamond' ? '是否满足条件？' : '新格子', href: '', imagePath: '', imageLabel: '', x, y, width: 160, height: 64, groupId, layoutLocked: true };
      }

      function focusNewVisualNodeText() {
        window.requestAnimationFrame(() => {
          const input = document.getElementById('visualTextInput');
          if (input) { input.focus(); input.select(); }
        });
      }

      function addVisualNode(type) {
        finishVisualTextEdit();
        const before = visualState();
        const node = makeVisualNode(type, 700, 100 + visualModel.nodes.length * 36);
        visualModel.nodes.push(node); layoutVisualModel(visualModel); visualHistory.push(before); visualFuture = []; visualSelection = { kind: 'nodes', ids: [node.id] }; markVisualDirty(); renderVisualModel();
      }

      function addVisualNodeAt(point, groupId = '') {
        finishVisualTextEdit();
        const before = visualState();
        const node = makeVisualNode('rect', point.x, point.y, groupId);
        visualModel.nodes.push(node);
        const group = groupId ? visualGroup(groupId) : null;
        if (group && !group.nodeIds.includes(node.id)) group.nodeIds.push(node.id);
        visualMeasure(node);
        visualHistory.push(before); visualFuture = []; visualSelection = { kind: 'nodes', ids: [node.id] }; markVisualDirty(); renderVisualModel(); focusNewVisualNodeText();
      }

      function createVisualGroup() {
        if (!visualSelection || visualSelection.kind !== 'nodes' || visualSelection.ids.length < 2) {
          setVisualError('请先按住 Ctrl 多选或拖动框选至少两个格子。');
          return;
        }
        const before = visualState();
        const id = nextVisualId('G');
        visualModel.groups.push({ id, title: '新子系统', nodeIds: [...visualSelection.ids], href: '', linkedFile: '', collapsed: false });
        visualSelection.ids.forEach(nodeId => { const node = visualNode(nodeId); if (node) node.groupId = id; });
        visualHistory.push(before); visualFuture = []; visualSelection = { kind: 'group', id }; markVisualDirty(); setVisualError(''); setVisualStatus('已创建分组，请在右侧修改标题，或生成子系统文件。'); renderVisualModel();
      }

      async function convertVisualGroupToSubsystem() {
        const group = visualGroup(visualSelection?.id);
        if (!group || !sourceFilePath || !window.electronAPI?.createSubsystemFile) {
          setVisualError('请先打开一个本地源文件，再生成子系统文件。');
          return;
        }
        const convertButton = document.getElementById('convertSubsystemButton');
        if (convertButton) convertButton.disabled = true;
        setVisualError('');
        setVisualStatus(`正在生成子系统文件：${group.title || '新子系统'}…`);
        try {
          const before = visualState();
          const memberIds = new Set(group.nodeIds);
          const originalNodes = visualModel.nodes.filter(node => memberIds.has(node.id)).map(node => JSON.parse(JSON.stringify(node)));
          const internalEdges = visualModel.edges.filter(edge => memberIds.has(edge.source) && memberIds.has(edge.target)).map(edge => ({ ...edge }));
          const externalEdges = visualModel.edges.filter(edge => memberIds.has(edge.source) !== memberIds.has(edge.target)).map(edge => ({ ...edge }));
          const copiedNodes = visualModel.nodes.filter(node => memberIds.has(node.id)).map(node => ({ ...node, groupId: '' }));
          for (const node of copiedNodes) {
            if (!node.imagePath) continue;
            const copied = await window.electronAPI.copyImageToSource(sourceFilePath, node.imagePath, '', true);
            node.imagePath = `images/${copied.fileName}`;
          }
          const subModel = { direction: 'TB', nodes: copiedNodes, edges: visualModel.edges.filter(edge => memberIds.has(edge.source) && memberIds.has(edge.target)), groups: [] };
          const created = await window.electronAPI.createSubsystemFile(sourceFilePath, group.title, serializeVisualGraph(subModel));
          const linkId = nextVisualId('SUB');
          const bounds = groupBounds(visualModel, group);
          const linkNode = { id: linkId, type: 'rect', text: group.title, href: created.relativePath, imagePath: '', x: bounds ? bounds.left + bounds.width / 2 : 700, y: bounds ? bounds.top + bounds.height / 2 : 120, width: 180, height: 64, groupId: '', layoutLocked: true, subsystemRestore: { version: 1, linkId, href: created.relativePath, groupId: group.id, title: group.title, nodes: originalNodes, internalEdges, externalEdges } };
          visualModel.nodes = visualModel.nodes.filter(node => !memberIds.has(node.id));
          visualModel.edges = visualModel.edges.filter(edge => !(memberIds.has(edge.source) && memberIds.has(edge.target)));
          visualModel.edges.forEach(edge => { if (memberIds.has(edge.source)) edge.source = linkId; if (memberIds.has(edge.target)) edge.target = linkId; });
          visualModel.edges = visualModel.edges.filter(edge => edge.source !== edge.target);
          visualModel.groups = visualModel.groups.filter(item => item.id !== group.id);
          visualModel.nodes.push(linkNode);
          visualHistory.push(before); visualFuture = []; visualSelection = { kind: 'nodes', ids: [linkId] }; markVisualDirty(); layoutVisualModel(visualModel); renderVisualModel();
          setVisualStatus(`子系统文件已生成：${created.fileName || created.relativePath}`);
        } catch (error) {
          setVisualError(`生成子系统失败：${error?.message || error}`);
          setVisualStatus('子系统生成失败，请检查文件权限和图片路径后重试。');
        } finally {
          if (convertButton) convertButton.disabled = false;
        }
      }

      async function chooseVisualImage() {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.addEventListener('change', async () => {
          const file = input.files?.[0];
          const node = visualNode(visualSelection?.ids?.[0]);
          if (!file || !node || !window.electronAPI?.getPathForFile || !window.electronAPI?.copyImageToSource) return;
          try {
            const imagePath = window.electronAPI.getPathForFile(file);
            const copied = await window.electronAPI.copyImageToSource(sourceFilePath, imagePath);
            const before = visualState(); node.imagePath = copied.relativePath; node.imageLabel = node.imageLabel || '查看图片'; visualHistory.push(before); visualFuture = []; markVisualDirty(); layoutVisualModel(visualModel); renderVisualModel();
          } catch (error) {
            setVisualError(`插入图片失败：${error?.message || error}`);
          }
        }, { once: true });
        input.click();
      }

      async function openVisualLink(href) {
        if (!href) return;
        try {
          if (/^https?:\/\//i.test(href)) {
            if (window.electronAPI?.openExternalLink) await window.electronAPI.openExternalLink(href);
            else window.open(href, '_blank', 'noopener');
            return;
          }
          if (window.electronAPI?.openSourceWindow && sourceFilePath) await window.electronAPI.openSourceWindow(sourceFilePath, href);
          else setVisualError('本地链接只能在 Electron 桌面端打开。');
        } catch (error) { setVisualError(`打开链接失败：${error?.message || error}`); }
      }

      async function openVisualImage(imagePath) {
        if (!imagePath) return;
        try {
          const imageUrl = await resolveLocalResourceUrl(imagePath) || resolveImageLink(imagePath);
          if (imageUrl) openImageWindow(imageUrl, '图片预览');
          else setVisualError(`图片无法打开：${imagePath}`);
        } catch (error) {
          setVisualError(`打开图片失败：${error?.message || error}`);
        }
      }

      function visualUndo() {
        finishVisualTextEdit();
        const previous = visualHistory.pop();
        if (!previous) return;
        visualFuture.push(visualState()); visualModel = previous; visualSelection = null; markVisualDirty(); renderVisualModel();
      }

      function visualRedo() {
        finishVisualTextEdit();
        const next = visualFuture.pop();
        if (!next) return;
        visualHistory.push(visualState()); visualModel = next; visualSelection = null; markVisualDirty(); renderVisualModel();
      }

      function openVisualEditor() {
        finishVisualTextEdit();
        visualConnectStart = ''; visualConnectPoint = null; visualConnectTarget = ''; visualDrag = null; visualEdgeEndpointDrag = null; visualEndpointTarget = '';
        visualLastPointerPoint = null;
        visualZoom = 1;
        const code = codeInput.value.trim();
        visualOriginalSourceCode = codeInput.value;
        visualWasDirty = isDirty;
        visualModel = code ? parseVisualGraph(code) : { direction: 'TB', nodes: [], edges: [], groups: [] };
        visualModel.nodes.forEach(visualMeasure);
        visualOriginalCode = serializeVisualGraph(visualModel).trim();
        if (!visualModel.layoutMetadata) layoutVisualModel(visualModel);
        visualHistory = []; visualFuture = []; visualSelection = null; visualTextEditBefore = null; visualTextEditSelection = []; visualRestoreDraft = null; visualEditing = true;
        editing = false; editorPanel.hidden = true; visualPanel.hidden = false; visualInspector.hidden = false; workspace.classList.remove('editing'); workspace.classList.add('visualizing');
        modeBadge.textContent = '可视化编辑'; visualButton.textContent = '退出可视化'; setVisualError(''); setVisualStatus(''); renderVisualModel();
      }

      function closeVisualEditor() {
        if (!visualEditing) return;
        finishVisualTextEdit();
        const generatedCode = serializeVisualGraph(visualModel);
        const changed = generatedCode.trim() !== visualOriginalCode.trim();
        if (changed) codeInput.value = generatedCode;
        else codeInput.value = visualOriginalSourceCode;
        visualRestoreDraft = null;
        visualConnectStart = ''; visualConnectPoint = null; visualConnectTarget = ''; visualDrag = null; visualEdgeEndpointDrag = null; visualEndpointTarget = '';
        visualEditing = false; visualPanel.hidden = true; visualInspector.hidden = true; workspace.classList.remove('visualizing'); modeBadge.textContent = '阅读模式'; visualButton.textContent = '可视化编辑';
        isDirty = visualWasDirty || changed;
        if (isDirty) setSaveStatus('未保存');
        renderDiagram(codeInput.value);
      }

      function syncVisualToCode() {
        if (!visualEditing) return;
        codeInput.value = serializeVisualGraph(visualModel);
      }

      function updateVisualModeButtons() {
        visualSelect.classList.toggle('active', visualMode === 'select');
        connectButton.classList.toggle('active', visualMode === 'connect');
        visualCanvas.classList.toggle('mode-connect', visualMode === 'connect');
        visualCanvas.classList.toggle('mode-select', visualMode === 'select');
      }

      function setVisualZoom(nextZoom, clientX = null, clientY = null) {
        if (!visualCanvasWrap) return;
        const previousZoom = visualZoom;
        const boundedZoom = Math.min(3, Math.max(.25, Number(nextZoom) || 1));
        if (Math.abs(boundedZoom - previousZoom) < .001) return;
        const rect = visualCanvasWrap.getBoundingClientRect();
        const focusX = clientX === null ? rect.width / 2 : clientX - rect.left;
        const focusY = clientY === null ? rect.height / 2 : clientY - rect.top;
        const previousScrollLeft = visualCanvasWrap.scrollLeft;
        const previousScrollTop = visualCanvasWrap.scrollTop;
        visualZoom = Number(boundedZoom.toFixed(2));
        renderVisualModel({ skipInspector: true });
        const scale = visualZoom / previousZoom;
        const restoreScroll = () => {
          visualCanvasWrap.scrollLeft = Math.max(0, (previousScrollLeft + focusX) * scale - focusX);
          visualCanvasWrap.scrollTop = Math.max(0, (previousScrollTop + focusY) * scale - focusY);
        };
        restoreScroll();
        window.requestAnimationFrame(restoreScroll);
        setVisualStatus(`可视化缩放 ${Math.round(visualZoom * 100)}%`);
      }

      visualButton.addEventListener('click', () => visualEditing ? closeVisualEditor() : openVisualEditor());
      closeVisualButton.addEventListener('click', closeVisualEditor);
      visualSelect.addEventListener('click', () => { visualMode = 'select'; visualConnectStart = ''; visualConnectPoint = null; visualConnectTarget = ''; visualEdgeEndpointDrag = null; visualEndpointTarget = ''; updateVisualModeButtons(); renderVisualModel(); });
      connectButton.addEventListener('click', () => { visualMode = 'connect'; visualSelection = null; visualConnectStart = ''; visualConnectPoint = null; visualConnectTarget = ''; visualEdgeEndpointDrag = null; visualEndpointTarget = ''; updateVisualModeButtons(); renderVisualModel(); });
      addRectButton.addEventListener('click', () => addVisualNode('rect'));
      addDiamondButton.addEventListener('click', () => addVisualNode('diamond'));
      groupButton.addEventListener('click', createVisualGroup);
      layoutButton.addEventListener('click', () => { const before = visualState(); layoutVisualModel(visualModel); visualHistory.push(before); visualFuture = []; markVisualDirty(); renderVisualModel(); });
      undoButton.addEventListener('click', visualUndo);
      redoButton.addEventListener('click', visualRedo);

      visualCanvasWrap.addEventListener('wheel', event => {
        if (!visualEditing || !event.ctrlKey) return;
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        setVisualZoom(visualZoom * factor, event.clientX, event.clientY);
      }, { passive: false });

      visualCanvas.addEventListener('pointerdown', event => {
        if (!visualEditing) return;
        const point = visualPoint(event);
        visualLastPointerPoint = point;
        const target = event.target instanceof Element ? event.target : null;
        const nodeEl = target?.closest('[data-node-id]');
        const edgeEl = target?.closest('[data-edge-id]');
        const endpointEl = target?.closest('[data-edge-endpoint]');
        const groupEl = target?.closest('[data-group-id]');
        visualCanvas.setPointerCapture?.(event.pointerId);
        if (event.button === 0 && visualMode === 'select' && endpointEl && edgeEl) {
          const edge = visualEdge(edgeEl.dataset.edgeId);
          const endpointRole = endpointEl.dataset.edgeEndpoint;
          if (edge && ['forward', 'reverse'].includes(edge.direction) && ['source', 'target'].includes(endpointRole)) {
            visualSelection = { kind: 'edge', id: edge.id };
            visualEdgeEndpointDrag = { edgeId: edge.id, endpointRole, fixedNodeId: endpointRole === 'target' ? edge.source : edge.target, currentPoint: point, before: visualState() };
            visualEndpointTarget = '';
            visualDrag = null;
            renderVisualModel();
          }
          return;
        }
        if (event.button === 2 && visualMode === 'select') {
          visualDrag = null;
          visualConnectStart = ''; visualConnectPoint = null;
          visualConnectTarget = '';
          if (nodeEl) { visualConnectStart = nodeEl.dataset.nodeId; visualConnectPoint = point; renderVisualModel(); }
          return;
        }
        if (visualMode === 'connect') {
          visualConnectStart = ''; visualConnectPoint = null;
          visualConnectTarget = '';
          if (nodeEl) { visualConnectStart = nodeEl.dataset.nodeId; visualConnectPoint = point; renderVisualModel(); }
          return;
        }
        if (nodeEl) {
          const id = nodeEl.dataset.nodeId;
          const ids = visualSelection?.kind === 'nodes' ? [...visualSelection.ids] : [];
          if (event.ctrlKey || event.metaKey) ids.includes(id) ? ids.splice(ids.indexOf(id), 1) : ids.push(id);
          else if (!ids.includes(id)) ids.splice(0, ids.length, id);
          visualSelection = ids.length ? { kind: 'nodes', ids } : null;
          visualDrag = { kind: 'node', id, start: point, before: visualState(), moved: false, positions: new Map(ids.map(item => [item, { x: visualNode(item).x, y: visualNode(item).y }])) };
          renderVisualModel();
          return;
        }
        if (edgeEl) { visualSelection = { kind: 'edge', id: edgeEl.dataset.edgeId }; visualDrag = null; renderVisualModel(); return; }
        if (groupEl) {
          const group = visualGroup(groupEl.dataset.groupId);
          visualSelection = group ? { kind: 'group', id: group.id } : null;
          visualDrag = group ? { kind: 'group', id: group.id, start: point, before: visualState(), moved: false, positions: new Map(group.nodeIds.map(id => { const node = visualNode(id); return [id, node ? { x: node.x, y: node.y } : null]; }).filter(([, position]) => position)) } : null;
          renderVisualModel();
          return;
        }
        if (visualMode === 'select') { visualSelection = null; visualDrag = { kind: 'marquee', start: point, current: point }; renderVisualModel(); }
      });
      visualCanvas.addEventListener('pointermove', event => {
        if (!visualEditing) return;
        const point = visualPoint(event);
        visualLastPointerPoint = point;
        if (visualEdgeEndpointDrag) {
          visualEdgeEndpointDrag.currentPoint = point;
          const targetId = visualNodeAtClientPoint(event.clientX, event.clientY);
          visualEndpointTarget = targetId && targetId !== visualEdgeEndpointDrag.fixedNodeId ? targetId : '';
          renderVisualModel();
          return;
        }
        if (visualConnectStart) {
          visualConnectPoint = point;
          const targetId = visualNodeAtClientPoint(event.clientX, event.clientY);
          visualConnectTarget = targetId && targetId !== visualConnectStart ? targetId : '';
          renderVisualModel();
          return;
        }
        if (!visualDrag) return;
        if (visualDrag.kind === 'node') {
          const dx = point.x - visualDrag.start.x; const dy = point.y - visualDrag.start.y;
          visualDrag.moved = visualDrag.moved || Boolean(dx || dy);
          visualDrag.positions.forEach((position, id) => { const node = visualNode(id); if (node) { node.x = position.x + dx; node.y = position.y + dy; } });
        } else if (visualDrag.kind === 'group') {
          const dx = point.x - visualDrag.start.x; const dy = point.y - visualDrag.start.y;
          visualDrag.moved = visualDrag.moved || Boolean(dx || dy);
          visualDrag.positions.forEach((position, id) => { const node = visualNode(id); if (node) { node.x = position.x + dx; node.y = position.y + dy; } });
        } else { visualDrag.current = point; }
        renderVisualModel();
      });
      visualCanvas.addEventListener('pointerup', event => {
        if (!visualEditing) return;
        const point = visualPoint(event);
        if (visualEdgeEndpointDrag) {
          const drag = visualEdgeEndpointDrag;
          const targetId = visualEndpointTarget || visualNodeAtClientPoint(event.clientX, event.clientY);
          const edge = visualEdge(drag.edgeId);
          if (edge && targetId && targetId !== drag.fixedNodeId) {
            edge[drag.endpointRole] = targetId;
            visualHistory.push(drag.before); visualFuture = []; markVisualDirty();
            setVisualStatus('箭头指向已修改，请保存主图。');
          }
          visualEdgeEndpointDrag = null; visualEndpointTarget = ''; renderVisualModel(); return;
        }
        if (visualConnectStart) {
          const targetId = visualConnectTarget || visualNodeAtClientPoint(event.clientX, event.clientY);
          if (targetId && targetId !== visualConnectStart) {
            const before = visualState();
            visualModel.edges.push({ id: nextVisualId('E'), source: visualConnectStart, target: targetId, label: '', direction: 'forward' });
            visualHistory.push(before); visualFuture = []; markVisualDirty();
          }
          visualConnectStart = ''; visualConnectPoint = null; visualConnectTarget = ''; renderVisualModel(); return;
        }
        if (visualDrag?.kind === 'node') {
          const drag = visualDrag;
          if (drag.moved) {
            drag.positions.forEach((position, id) => { const node = visualNode(id); if (node) node.layoutLocked = true; });
            visualModel.layoutMetadata = true;
            visualHistory.push(drag.before); visualFuture = []; markVisualDirty();
          }
          visualDrag = null; renderVisualModel(); return;
        }
        if (visualDrag?.kind === 'group') {
          const drag = visualDrag;
          if (drag.moved) {
            drag.positions.forEach((position, id) => { const node = visualNode(id); if (node) node.layoutLocked = true; });
            visualModel.layoutMetadata = true;
            visualHistory.push(drag.before); visualFuture = []; markVisualDirty();
          }
          visualDrag = null; renderVisualModel(); return;
        }
        if (visualDrag?.kind === 'marquee') {
          const left = Math.min(visualDrag.start.x, point.x); const right = Math.max(visualDrag.start.x, point.x); const top = Math.min(visualDrag.start.y, point.y); const bottom = Math.max(visualDrag.start.y, point.y);
          const ids = visualModel.nodes.filter(node => node.x - node.width / 2 >= left && node.x + node.width / 2 <= right && node.y - node.height / 2 >= top && node.y + node.height / 2 <= bottom).map(node => node.id);
          visualDrag = null; visualSelection = ids.length ? { kind: 'nodes', ids } : null; renderVisualModel();
        }
      });
      visualCanvas.addEventListener('pointercancel', () => { visualConnectStart = ''; visualConnectPoint = null; visualConnectTarget = ''; visualEdgeEndpointDrag = null; visualEndpointTarget = ''; visualDrag = null; renderVisualModel(); });
      visualCanvas.addEventListener('contextmenu', event => event.preventDefault());
      visualCanvas.addEventListener('dblclick', event => {
        const target = event.target instanceof Element ? event.target : null;
        const nodeEl = target?.closest('[data-node-id]');
        const edgeEl = target?.closest('[data-edge-id]');
        const groupEl = target?.closest('[data-group-id]');
        if (nodeEl) { const node = visualNode(nodeEl.dataset.nodeId); const text = window.prompt('编辑格子文字：', node.text); if (text !== null) updateSelectedVisualNodes({ text }); }
        if (edgeEl) { const edge = visualEdge(edgeEl.dataset.edgeId); const label = window.prompt('编辑箭头文字：', edge.label || ''); if (label !== null) { const before = visualState(); edge.label = label; visualHistory.push(before); visualFuture = []; markVisualDirty(); renderVisualModel(); } }
        if (!nodeEl && !edgeEl && visualMode === 'select') addVisualNodeAt(visualPoint(event), groupEl?.dataset.groupId || '');
      });

      const mobileReadingQuery = window.matchMedia('(max-width: 760px) and (pointer: coarse)');
      const isMobileReadingMode = () => mobileReadingQuery.matches && !window.electronAPI;

      if (!window.mermaid) {
        showError('Mermaid 加载失败。请检查网络连接后重新打开此 HTML 文件。');
        return;
      }

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        htmlLabels: true,
        flowchart: {
          useMaxWidth: false,
          htmlLabels: true,
          curve: 'basis'
        },
        themeVariables: {
          fontFamily: 'Microsoft YaHei, Noto Sans SC, sans-serif',
          fontSize: '18px',
          primaryColor: '#eeecff',
          primaryTextColor: '#25304a',
          primaryBorderColor: '#8f80ee',
          lineColor: '#4a4f5d',
          secondaryColor: '#f8f9fd',
          tertiaryColor: '#ffffff'
        }
      });

      openButton.addEventListener('click', async () => {
        if (window.electronAPI?.openSourceFile) {
          try {
            const source = await window.electronAPI.openSourceFile();
            if (source) loadSource(source);
          } catch (error) {
            showError(`打开文件失败：\n${error && error.message ? error.message : error}`);
          }
          return;
        }
        fileInput.click();
      });
      fileInput.addEventListener('change', event => {
        const [file] = event.target.files;
        if (file) readFile(file);
        fileInput.value = '';
      });

      editButton.addEventListener('click', () => {
        if (visualEditing) closeVisualEditor();
        editing = !editing;
        editorPanel.hidden = !editing;
        workspace.classList.toggle('editing', editing);
        modeBadge.textContent = editing ? '编辑模式' : '阅读模式';
        editButton.textContent = editing ? '返回阅读' : '编辑模式';
        if (editing) codeInput.focus();
      });

      codeInput.addEventListener('input', () => {
        isDirty = true;
        setSaveStatus('未保存');
        window.clearTimeout(renderTimer);
        renderTimer = window.setTimeout(() => renderDiagram(codeInput.value), 180);
      });

      if (window.electronAPI?.onCloseRequest) {
        window.electronAPI.onCloseRequest(handleCloseRequest);
      }
      if (window.electronAPI?.onSourceFileChanged) {
        window.electronAPI.onSourceFileChanged(handleSourceFileChanged);
      }
      loadInitialSource();

      saveButton.addEventListener('click', saveSourceFile);
      saveAsButton.addEventListener('click', saveSourceFileAs);
      reloadFileButton.addEventListener('click', reloadChangedSourceFile);
      ignoreFileButton.addEventListener('click', () => {
        fileChangeNotice.hidden = true;
      });
      document.addEventListener('keydown', event => {
        const editingTextField = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target?.isContentEditable;
        if (visualEditing && !editingTextField && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
          event.preventDefault();
          visualCopySelection();
          return;
        }
        if (visualEditing && !editingTextField && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
          event.preventDefault();
          pasteVisualNodes();
          return;
        }
        if (visualEditing && !editingTextField && (event.key === 'Delete' || event.key === 'Backspace') && visualSelection) {
          event.preventDefault();
          deleteSelectedVisual();
          return;
        }
        if (visualEditing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          event.shiftKey ? visualRedo() : visualUndo();
          return;
        }
        if (visualEditing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
          event.preventDefault();
          visualRedo();
          return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          saveSourceFile();
        }
      });

      ['dragenter', 'dragover'].forEach(type => {
        dropzone.addEventListener(type, event => {
          event.preventDefault();
          dropzone.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach(type => {
        dropzone.addEventListener(type, event => {
          event.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });
      dropzone.addEventListener('drop', event => {
        event.stopPropagation();
        const [file] = event.dataTransfer.files;
        if (file) readFile(file);
      });
      document.addEventListener('dragover', event => event.preventDefault());
      document.addEventListener('drop', event => {
        event.preventDefault();
        const [file] = event.dataTransfer.files;
        if (file) readFile(file);
      });

      zoomIn.addEventListener('click', () => setZoom(zoom * 1.25));
      zoomOut.addEventListener('click', () => setZoom(Math.max(.25, zoom / 1.25)));
      zoomReset.addEventListener('click', () => setZoom(1));
      diagramScroll.addEventListener('wheel', event => {
        event.preventDefault();
        if (!event.ctrlKey) {
          diagramScroll.scrollTop += event.deltaY;
          diagramScroll.scrollLeft += event.deltaX;
          return;
        }
        const rect = diagramScroll.getBoundingClientRect();
        const focusX = event.clientX - rect.left;
        const focusY = event.clientY - rect.top;
        const nextZoom = event.deltaY < 0 ? zoom * 1.1 : Math.max(.25, zoom / 1.1);
        setZoom(nextZoom, focusX, focusY);
      }, { passive: false });
      diagramScroll.addEventListener('scroll', updatePositionIndicator, { passive: true });

      diagramScroll.addEventListener('pointerdown', event => {
        if (!isMobileReadingMode() || event.pointerType === 'mouse') return;
        mobilePointers.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
          lastX: event.clientX,
          lastY: event.clientY
        });
        diagramScroll.setPointerCapture?.(event.pointerId);
        if (mobilePointers.size === 2) {
          const [first, second] = [...mobilePointers.values()];
          pinchStartDistance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
          pinchStartZoom = zoom;
        }
      });
      diagramScroll.addEventListener('pointermove', event => {
        if (!isMobileReadingMode() || event.pointerType === 'mouse' || !mobilePointers.has(event.pointerId)) return;
        const point = mobilePointers.get(event.pointerId);
        point.x = event.clientX;
        point.y = event.clientY;

        if (mobilePointers.size >= 2) {
          const [first, second] = [...mobilePointers.values()];
          const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
          const rect = diagramScroll.getBoundingClientRect();
          const centerX = (first.x + second.x) / 2 - rect.left;
          const centerY = (first.y + second.y) / 2 - rect.top;
          const nextZoom = Math.max(.25, Math.min(4, pinchStartZoom * distance / pinchStartDistance));
          if (Math.abs(nextZoom - zoom) > .005) {
            event.preventDefault();
            mobileAutoFit = false;
            setZoom(nextZoom, centerX, centerY);
          }
          return;
        }

        const dx = point.x - point.lastX;
        const dy = point.y - point.lastY;
        point.lastX = point.x;
        point.lastY = point.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        event.preventDefault();
        diagramScroll.scrollLeft -= dx;
        diagramScroll.scrollTop -= dy;
        updatePositionIndicator();
      }, { passive: false });
      const clearMobilePointer = event => {
        if (!mobilePointers.has(event.pointerId)) return;
        mobilePointers.delete(event.pointerId);
        if (mobilePointers.size < 2) pinchStartDistance = 0;
        if (mobilePointers.size === 1) {
          const point = [...mobilePointers.values()][0];
          point.lastX = point.x;
          point.lastY = point.y;
        }
      };
      diagramScroll.addEventListener('pointerup', clearMobilePointer);
      diagramScroll.addEventListener('pointercancel', clearMobilePointer);

      diagramOutput.addEventListener('click', async event => {
        const target = event.target;
        const link = target instanceof Element ? target.closest('a[href]') : null;
        if (!link || !diagramOutput.contains(link)) return;
        const href = link.getAttribute('href') || '';
        const isImageLink = /\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#].*)?$/i.test(href);
        if (isImageLink) {
          event.preventDefault();
          event.stopPropagation();
          const imageUrl = await resolveImageResourceUrl(href);
          if (imageUrl) await openImageWindow(imageUrl, link.textContent.trim() || '图片预览');
          else showError(`图片无法打开：${href}`);
          return;
        }

        const sourceUrl = resolveSourceLink(href);
        if (!sourceUrl && /^https?:\/\//i.test(href)) {
          event.preventDefault();
          event.stopPropagation();
          openVisualLink(href);
          return;
        }
        if (!sourceUrl) return;
        event.preventDefault();
        event.stopPropagation();
        try {
          if (window.electronAPI?.openSourceWindow && sourceFilePath) {
            await window.electronAPI.openSourceWindow(sourceFilePath, href);
          } else {
            const viewerUrl = new URL(window.location.href);
            viewerUrl.search = `source=${encodeURIComponent(sourceUrl)}`;
            const sourceWindow = window.open(viewerUrl.href, '_blank', 'popup=yes,width=1440,height=960,resizable=yes,scrollbars=yes');
            if (!sourceWindow) showError('源文件窗口被浏览器拦截，请允许当前页面打开弹出窗口。');
          }
        } catch (error) {
          showError(`打开源文件失败：\n${error && error.message ? error.message : error}`);
        }
      });

      diagramOutput.addEventListener('error', async event => {
        const image = event.target instanceof HTMLImageElement ? event.target : null;
        if (!image) return;
        const href = image.getAttribute('src') || image.src || '';
        const fallbackUrl = await resolveLocalResourceUrl(href);
        if (fallbackUrl && image.src !== fallbackUrl) image.src = fallbackUrl;
      }, true);

      positionIndicator.addEventListener('mousedown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const thumbRect = positionThumb.getBoundingClientRect();
        progressDragOffset = positionThumb.contains(event.target)
          ? event.clientY - thumbRect.top
          : thumbRect.height / 2;
        isProgressDragging = true;
        updateProgressFromPointer(event.clientY);
      });

      diagramScroll.addEventListener('contextmenu', event => event.preventDefault());
      diagramScroll.addEventListener('dragstart', event => event.preventDefault());
      diagramScroll.addEventListener('mousedown', event => {
        if (event.button !== 2) return;
        isPanning = true;
        panStartX = event.clientX;
        panStartY = event.clientY;
        panScrollLeft = diagramScroll.scrollLeft;
        panScrollTop = diagramScroll.scrollTop;
        diagramScroll.classList.add('panning');
        event.preventDefault();
      });
      window.addEventListener('mousemove', event => {
        if (isProgressDragging) {
          updateProgressFromPointer(event.clientY);
          return;
        }
        if (!isPanning) return;
        diagramScroll.scrollLeft = panScrollLeft - (event.clientX - panStartX);
        diagramScroll.scrollTop = panScrollTop - (event.clientY - panStartY);
      });
      window.addEventListener('mouseup', event => {
        if (event.button === 0 && isProgressDragging) {
          isProgressDragging = false;
          progressDragOffset = 0;
          return;
        }
        if (event.button !== 2 || !isPanning) return;
        isPanning = false;
        diagramScroll.classList.remove('panning');
      });

      async function readFile(file) {
        if (window.electronAPI?.getPathForFile && window.electronAPI?.readSourceFile) {
          try {
            const filePath = window.electronAPI.getPathForFile(file);
            if (filePath) {
              const source = await window.electronAPI.readSourceFile(filePath);
              if (source) {
                loadSource(source);
                return;
              }
            }
          } catch {
            // 如果无法取得本地路径，则回退到浏览器的 FileReader。
          }
        }
        const reader = new FileReader();
        reader.onload = () => {
          loadSource({
            fileName: file.name || 'diagram.mmd',
            content: String(reader.result || '')
          });
        };
        reader.onerror = () => showError('文件读取失败，请重试。');
        reader.readAsText(file, 'UTF-8');
      }

      async function loadInitialSource() {
        const sourceParam = new URLSearchParams(window.location.search).get('source');
        if (sourceParam && window.electronAPI?.getInitialSource) {
          try {
            const source = await window.electronAPI.getInitialSource(sourceParam);
            if (source) loadSource(source);
          } catch (error) {
            showError(`打开源文件失败：\n${error && error.message ? error.message : error}`);
          }
          return;
        }

        if (window.electronAPI?.getInitialSource) return;

        const sourceUrl = new URL(sourceParam || '图形推理决策树.md', window.location.href);
        try {
          const response = await fetch(sourceUrl.href);
          if (!response.ok) throw new Error(`文件加载失败：${response.status}`);
          loadSource({
            fileName: decodeURIComponent(sourceUrl.pathname.split('/').pop() || 'diagram.md'),
            content: await response.text(),
            directoryUrl: new URL('.', sourceUrl.href).href
          });
        } catch (error) {
          showError(`打开源文件失败：\n${error && error.message ? error.message : error}`);
        }
      }

      function loadSource(source) {
        if (visualEditing) {
          visualEditing = false;
          visualPanel.hidden = true;
          visualInspector.hidden = true;
          workspace.classList.remove('visualizing');
          visualButton.textContent = '可视化编辑';
        }
        currentFileName = source.fileName || 'diagram.mmd';
        sourceText = String(source.content || '');
        sourceFilePath = source.filePath || '';
        sourceDirectoryUrl = source.directoryUrl || '';
        isDirty = false;
        mobileAutoFit = true;
        fileChangeNotice.hidden = true;
        watchSourceFile();
        fileName.textContent = currentFileName;
        brandSubtitle.textContent = currentFileName;
        document.body.classList.add('has-file');
        saveButton.disabled = false;
        saveAsButton.disabled = false;
        setSaveStatus('已打开源文件');
        const code = extractMermaid(sourceText);
        if (!code) {
          showError('没有找到 Mermaid 代码。请确认文件中包含 ```mermaid 代码块，或直接拖入 .mmd 文件。');
          return;
        }
        codeInput.value = code;
        setZoom(1, null, null, false);
        renderDiagram(code);
      }

      async function watchSourceFile() {
        if (!window.electronAPI?.watchSourceFile) return;
        try {
          if (sourceFilePath) {
            await window.electronAPI.watchSourceFile(sourceFilePath);
          } else if (window.electronAPI.unwatchSourceFile) {
            await window.electronAPI.unwatchSourceFile();
          }
        } catch {
          // 文件监听失败不影响当前文件的查看和编辑。
        }
      }

      async function handleSourceFileChanged(change) {
        if (isReloadingExternalFile || !sourceFilePath || change?.filePath !== sourceFilePath) return;
        try {
          const latestSource = await window.electronAPI.readSourceFile(sourceFilePath);
          if (latestSource?.content !== sourceText) fileChangeNotice.hidden = false;
        } catch {
          // 文件可能正在被外部编辑器替换，等待下一次文件变化通知再检查。
        }
      }

      async function reloadChangedSourceFile() {
        if (!sourceFilePath || isReloadingExternalFile) return;
        isReloadingExternalFile = true;
        reloadFileButton.disabled = true;
        try {
          const source = await window.electronAPI.readSourceFile(sourceFilePath);
          if (source) loadSource(source);
        } catch (error) {
          showError(`更新文件失败：\n${error && error.message ? error.message : error}`);
        } finally {
          isReloadingExternalFile = false;
          reloadFileButton.disabled = false;
        }
      }

      function buildSavedContent() {
        syncVisualToCode();
        const code = codeInput.value.replace(/\r\n/g, '\n');
        const blockPattern = /(```(?:mermaid|mmd)\s*\r?\n)[\s\S]*?(```)/i;
        const match = sourceText.match(blockPattern);
        if (!match) return code;
        const lineEnding = sourceText.includes('\r\n') ? '\r\n' : '\n';
        const normalizedCode = code.replace(/\r?\n/g, lineEnding);
        return sourceText.replace(blockPattern, () => `${match[1]}${normalizedCode}${lineEnding}${match[2]}`);
      }

      async function saveSourceFile() {
        if (!sourceText && !codeInput.value.trim()) return;
        const content = buildSavedContent();
        if (window.electronAPI?.saveSourceFile && sourceFilePath) {
          try {
            await window.electronAPI.saveSourceFile(sourceFilePath, content);
            sourceText = content;
            isDirty = false;
            fileChangeNotice.hidden = true;
            setSaveStatus('已保存');
            return true;
          } catch (error) {
            setSaveStatus('保存失败', true);
            showError(`保存文件失败：\n${error && error.message ? error.message : error}`);
            return false;
          }
        }
        downloadContent(content, currentFileName);
        isDirty = false;
        setSaveStatus('已下载副本');
        return true;
      }

      async function saveSourceFileAs() {
        const content = buildSavedContent();
        if (window.electronAPI?.saveSourceFileAs) {
          try {
            const result = await window.electronAPI.saveSourceFileAs(currentFileName, content);
            if (!result || result.canceled) return;
            sourceFilePath = result.filePath || '';
            currentFileName = result.fileName || currentFileName;
            sourceDirectoryUrl = result.directoryUrl || sourceDirectoryUrl;
            sourceText = content;
            isDirty = false;
            fileChangeNotice.hidden = true;
            fileName.textContent = currentFileName;
            brandSubtitle.textContent = currentFileName;
            setSaveStatus('已另存为');
            return true;
          } catch (error) {
            setSaveStatus('另存失败', true);
            showError(`另存文件失败：\n${error && error.message ? error.message : error}`);
            return false;
          }
        }
        downloadContent(content, currentFileName);
        isDirty = false;
        setSaveStatus('已下载副本');
        return true;
      }

      async function handleCloseRequest() {
        if (!isDirty) {
          window.electronAPI.closeWindow();
          return;
        }
        const choice = await window.electronAPI.confirmClose();
        if (choice === 'save') {
          if (await saveSourceFile()) window.electronAPI.closeWindow();
          return;
        }
        if (choice === 'discard') {
          isDirty = false;
          window.electronAPI.closeWindow();
        }
      }

      function downloadContent(content, fileNameToUse) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileNameToUse || 'diagram.md';
        link.click();
        URL.revokeObjectURL(url);
      }

      function setSaveStatus(message, isError = false) {
        saveStatus.textContent = message;
        saveStatus.style.color = isError ? 'var(--danger)' : '';
      }

      function extractMermaid(text) {
        const block = text.match(/```(?:mermaid|mmd)\s*\r?\n([\s\S]*?)```/i);
        if (block) return block[1].trim();
        const rawStart = /^\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|gantt|pie|mindmap|timeline|journey|quadrantChart|xychart(?:-beta)?|gitGraph)\b/i;
        return rawStart.test(text) ? text.trim() : '';
      }

      function normalizeEmptyMermaidLabels(code) {
        return String(code)
          .replace(/(\b[A-Za-z][\w-]*\s*\[\s*)"\s*"(\s*\])/g, '$1"&nbsp;"$2')
          .replace(/(\b[A-Za-z][\w-]*\s*\{\s*)"\s*"(\s*\})/g, '$1"&nbsp;"$2')
          .replace(/(\b[A-Za-z][\w-]*\s*)\[\s*\]/g, '$1["&nbsp;"]')
          .replace(/(\b[A-Za-z][\w-]*\s*)\{\s*\}/g, '$1{"&nbsp;"}');
      }

      function resolveImageLink(href) {
        if (!href || href.startsWith('#')) return '';
        try {
          const imageUrl = new URL(href, sourceDirectoryUrl || window.location.href);
          const pathname = imageUrl.pathname.toLowerCase();
          if (!/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(pathname)) return '';
          return imageUrl.href;
        } catch {
          return '';
        }
      }

      function resolveSourceLink(href) {
        if (!href || href.startsWith('#')) return '';
        try {
          const sourceUrl = new URL(href, sourceDirectoryUrl || window.location.href);
          const pathname = sourceUrl.pathname.toLowerCase();
          if (!/\.(md|markdown|mmd|mermaid|txt)$/.test(pathname)) return '';
          return sourceUrl.href;
        } catch {
          return '';
        }
      }

      async function resolveLocalResourceUrl(href) {
        if (!href || href.startsWith('#')) return '';
        if (window.electronAPI?.resolveLocalResource && sourceFilePath) {
          try {
            const resource = await window.electronAPI.resolveLocalResource(sourceFilePath, href);
            if (resource?.fileUrl) return resource.fileUrl;
          } catch {
            // Fall back to the browser URL when the resource cannot be resolved.
          }
        }
        return '';
      }

      async function resolveImageResourceUrl(href) {
        if (!/\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#].*)?$/i.test(String(href || ''))) return '';
        return await resolveLocalResourceUrl(href) || resolveImageLink(href);
      }

      async function openImageWindow(imageUrl, title) {
        if (window.electronAPI?.openImageWindow) {
          try {
            await window.electronAPI.openImageWindow(imageUrl, title || '图片预览');
          } catch (error) {
            showError(`打开图片失败：\n${error?.message || error}`);
          }
          return;
        }
        const noteWindow = window.open(imageUrl, '_blank', 'popup=yes,width=900,height=680,resizable=yes,scrollbars=yes');
        if (!noteWindow) showError('图片预览窗口被浏览器拦截，请允许当前页面打开弹出窗口。');
      }

      async function renderDiagram(code) {
        if (!code.trim()) {
          showError('Mermaid 代码为空。');
          return;
        }
        try {
          const id = `mermaid-diagram-${++renderId}`;
          const result = await mermaid.render(id, normalizeEmptyMermaidLabels(code));
          diagramOutput.innerHTML = result.svg;
          if (typeof result.bindFunctions === 'function') result.bindFunctions(diagramOutput);
          const svg = diagramOutput.querySelector('svg');
          if (!svg) throw new Error('Mermaid 没有生成 SVG。');
          alignReadingSubsystemLabels(svg);
          baseSvgWidth = getSvgWidth(svg);
          if (isMobileReadingMode() && mobileAutoFit) {
            setZoom(getMobileFitZoom(), null, null, false);
          } else {
            applyZoom();
          }
          centerDiagram();
          updatePositionIndicator();
        } catch (error) {
          showError(`Mermaid 代码有误：\n${error && error.message ? error.message : error}`);
        }
      }

      function alignReadingSubsystemLabels(svg) {
        svg.querySelectorAll('.cluster').forEach(cluster => {
          const rect = [...cluster.children].find(child => child.tagName?.toLowerCase() === 'rect');
          const label = [...cluster.children].find(child => child.classList?.contains('cluster-label'));
          if (!rect || !label) return;
          const x = Number(rect.getAttribute('x')) || 0;
          const y = Number(rect.getAttribute('y')) || 0;
          const width = Number(rect.getAttribute('width')) || 0;
          rect.setAttribute('fill', '#f7f7ff');
          rect.setAttribute('stroke', '#9b91ef');
          rect.setAttribute('stroke-width', '1.5');
          rect.setAttribute('rx', '13');
          rect.setAttribute('ry', '13');
          label.setAttribute('transform', `translate(${x + 14} ${y + 8})`);
          const foreignObject = [...label.children].find(child => child.tagName?.toLowerCase() === 'foreignobject');
          if (foreignObject) {
            foreignObject.setAttribute('x', '0');
            foreignObject.setAttribute('y', '0');
            foreignObject.setAttribute('width', String(Math.max(100, width - 28)));
            foreignObject.setAttribute('height', '28');
          }
          const text = [...label.children].find(child => child.tagName?.toLowerCase() === 'text');
          if (text) {
            text.setAttribute('x', '0');
            text.setAttribute('y', '18');
            text.setAttribute('text-anchor', 'start');
            text.setAttribute('fill', '#69728a');
            text.setAttribute('font-size', '14px');
            text.setAttribute('font-weight', '600');
          }
          label.querySelectorAll('*').forEach(element => {
            element.style.setProperty('color', '#69728a', 'important');
            element.style.setProperty('font-size', '14px', 'important');
            element.style.setProperty('font-weight', '600', 'important');
            element.style.setProperty('text-align', 'left', 'important');
          });
        });
      }

      function getSvgWidth(svg) {
        const declared = parseFloat(svg.getAttribute('width'));
        if (Number.isFinite(declared) && declared > 0) return declared;
        const viewBox = svg.getAttribute('viewBox');
        const parts = viewBox ? viewBox.trim().split(/\s+/).map(Number) : [];
        return parts.length === 4 && Number.isFinite(parts[2]) ? parts[2] : 900;
      }

      function setZoom(nextZoom, focusX = null, focusY = null, userInitiated = true) {
        if (userInitiated && isMobileReadingMode()) mobileAutoFit = false;
        const previousZoom = zoom;
        const previousScrollLeft = diagramScroll.scrollLeft;
        const previousScrollTop = diagramScroll.scrollTop;
        zoom = Number(nextZoom.toFixed(2));
        applyZoom();
        window.requestAnimationFrame(() => {
          if (focusX !== null && focusY !== null) {
            const scale = zoom / previousZoom;
            const styles = getComputedStyle(diagramScroll);
            const paddingLeft = parseFloat(styles.paddingLeft) || 0;
            const paddingTop = parseFloat(styles.paddingTop) || 0;
            diagramScroll.scrollLeft = paddingLeft + (previousScrollLeft + focusX - paddingLeft) * scale - focusX;
            diagramScroll.scrollTop = paddingTop + (previousScrollTop + focusY - paddingTop) * scale - focusY;
            return;
          }
          centerDiagram();
        });
      }

      function applyZoom() {
        zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
        const svg = diagramOutput.querySelector('svg');
        if (!svg || !baseSvgWidth) return;
        svg.style.setProperty('width', `${baseSvgWidth * zoom}px`, 'important');
        svg.style.setProperty('max-width', 'none', 'important');
      }

      function getMobileFitZoom() {
        if (!baseSvgWidth) return 1;
        const styles = getComputedStyle(diagramScroll);
        const horizontalPadding = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
        const availableWidth = Math.max(1, diagramScroll.clientWidth - horizontalPadding);
        return Math.max(.25, Math.min(1, availableWidth / baseSvgWidth));
      }

      function centerDiagram() {
        window.requestAnimationFrame(() => {
          const maxScrollLeft = Math.max(0, diagramScroll.scrollWidth - diagramScroll.clientWidth);
          diagramScroll.scrollLeft = maxScrollLeft / 2;
          updatePositionIndicator();
        });
      }

      function updatePositionIndicator() {
        const visibleHeight = diagramScroll.clientHeight;
        const contentHeight = diagramScroll.scrollHeight;
        const trackHeight = positionIndicator.clientHeight;
        if (!trackHeight || contentHeight <= visibleHeight + 1) {
          positionIndicator.hidden = true;
          return;
        }
        positionIndicator.hidden = false;
        const thumbHeight = Math.max(24, trackHeight * visibleHeight / contentHeight);
        const maxTop = trackHeight - thumbHeight;
        const maxScrollTop = contentHeight - visibleHeight;
        const top = maxScrollTop > 0 ? maxTop * diagramScroll.scrollTop / maxScrollTop : 0;
        positionThumb.style.height = `${thumbHeight}px`;
        positionThumb.style.top = `${top}px`;
      }

      function updateProgressFromPointer(clientY) {
        const trackRect = positionIndicator.getBoundingClientRect();
        const trackHeight = positionIndicator.clientHeight;
        const thumbHeight = positionThumb.clientHeight;
        const maxTop = Math.max(0, trackHeight - thumbHeight);
        const top = Math.max(0, Math.min(maxTop, clientY - trackRect.top - progressDragOffset));
        const maxScrollTop = Math.max(0, diagramScroll.scrollHeight - diagramScroll.clientHeight);
        diagramScroll.scrollTop = maxTop > 0 ? maxScrollTop * top / maxTop : 0;
        updatePositionIndicator();
      }

      function showError(message) {
        diagramOutput.innerHTML = `<div class="empty-state"><div class="error"></div></div>`;
        diagramOutput.querySelector('.error').textContent = message;
      }
    })();

