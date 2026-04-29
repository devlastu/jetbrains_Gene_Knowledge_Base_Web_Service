import * as THREE from "three";
import CameraControls from "camera-controls";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { nodes, edges, modelPaths, LAYER_COLORS, LAYER_LABELS, LAYER_ORDER, LAYER_DESCRIPTIONS, DEVICE_CONFIGS, MODEL_DEVICE_DEFAULTS } from "./graph-data.js";

CameraControls.install({ THREE });

// ─── Constants ───
const BG_COLOR = 0x0d0d0d;
const EDGE_DEFAULT_COLOR = new THREE.Color(140 / 255, 48 / 255, 97 / 255);
const EDGE_HIGHLIGHT_COLOR = new THREE.Color(211 / 255, 144 / 255, 75 / 255);
const EDGE_DEFAULT_OPACITY = 0.2;
const EDGE_HIGHLIGHT_OPACITY = 0.92;
const DIMMED_OPACITY = 0.08;
const NODE_HEIGHT = 8;
const NODE_RADIUS = 1.4;
const CHAR_WIDTH = 1.35;
const NODE_PAD_X = 4.5;
const MIN_NODE_WIDTH = 22;
const ITEM_GAP_X = 34;
const GROUP_GAP_X = 22;
const LAYER_GAP_Y = 36;
const DOMAIN_OFFSET_X = 55;
const TAG_OFFSET_Y = 2.8;

// ─── State ───
let scene, camera, renderer, labelRenderer, controls;
const clock = new THREE.Clock();
const nodeMeshes = {};
const nodeBorders = {};
const nodeLabels = {};
const nodeTags = {};
const edgeLines = [];
const edgeCurves = {};
const nodeMap = {};
let activeModel = null;
let hoveredNode = null;
let activeDeviceType = "n150";
const chipMeshes = [];
const chipLines = [];
const chipLabelObjects = [];
let isAnimating = false;
let ballGroup = null;
let ballTimeline = null;
let layoutPositions = {};

const SPEED_LEVELS = [1, 0.75, 0.5, 0.25];
let speedIdx = 0;
let speedMultiplier = 1;
let forwardPath = [];
let isPaused = false;
let resumeResolve = null;
let cameraFollowsBall = true;
let autoExploreEnabled = false;
let currentAnimNodeId = null;

let animPath = [];
let animPathIdx = 0;
let animForwardIdx = 0;
let jumpTarget = null;

let isInsideNode = false;
let insideNodeId = null;
let insideObjects = [];
let savedCameraState = null;
let autoExplorePrevZoom = null;
let autoExploreNodePos = null;
let autoExploreId = 0;
let autoExploreCurrentStep = 0;
let activeInsideTokenTween = null;
let activeInsideTokenResolve = null;

let isTransitioning = false;
let transitionTimer = null;
let transitionResolve = null;
let overviewZoom = null;

let manualInsideActive = false;
let manualInsideStepIdx = -1;
let manualInsidePrevZoom = null;
let manualInsideNodePos = null;
let manualInsideCx = 0;

// ─── Overview Mode State ───
let overviewActive = false;
const overviewZoneMeshes = {};
const overviewZoneLabels = {};
const overviewZoneEdges = [];
const expandedLayers = new Set();

const nodeWidths = {};
nodes.forEach(n => {
  nodeMap[n.id] = n;
  nodeWidths[n.id] = Math.max(MIN_NODE_WIDTH, n.label.length * CHAR_WIDTH + NODE_PAD_X * 2);
});

// ─── Scene ───
function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);

  const aspect = window.innerWidth / window.innerHeight;
  const frustum = 80;
  camera = new THREE.OrthographicCamera(
    -frustum * aspect, frustum * aspect,
    frustum, -frustum, -2000, 2000
  );
  camera.position.set(0, 0, 100);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("canvas-container").appendChild(renderer.domElement);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.id = "label-renderer";
  document.getElementById("canvas-container").appendChild(labelRenderer.domElement);

  controls = new CameraControls(camera, renderer.domElement);
  controls.dollyToCursor = true;
  controls.minZoom = 0.2;
  controls.maxZoom = 5;
  controls.mouseButtons.left = CameraControls.ACTION.NONE;
  controls.mouseButtons.right = CameraControls.ACTION.NONE;
  controls.mouseButtons.wheel = CameraControls.ACTION.ZOOM;
  controls.touches.one = CameraControls.ACTION.NONE;
  controls.touches.two = CameraControls.ACTION.TOUCH_ZOOM;
  controls.draggingSmoothTime = 0.12;

  window.addEventListener("keydown", (e) => {
    if (e.key === "Control") {
      controls.mouseButtons.left = CameraControls.ACTION.TRUCK;
      controls.touches.one = CameraControls.ACTION.TRUCK;
      renderer.domElement.style.cursor = "grab";
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Control") {
      controls.mouseButtons.left = CameraControls.ACTION.NONE;
      controls.touches.one = CameraControls.ACTION.NONE;
      renderer.domElement.style.cursor = "default";
    }
  });
}

// ─── Rounded Rect ───
function createRoundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function createRoundedRectOutline(w, h, r, segments) {
  const pts = [];
  const x = -w / 2, y = -h / 2;
  const n = segments || 6;
  pts.push(new THREE.Vector3(x + r, y, 0.05));
  pts.push(new THREE.Vector3(x + w - r, y, 0.05));
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / n);
    pts.push(new THREE.Vector3(x + w - r + r * Math.cos(a), y + r + r * Math.sin(a), 0.05));
  }
  pts.push(new THREE.Vector3(x + w, y + h - r, 0.05));
  for (let i = 0; i <= n; i++) {
    const a = 0 + (Math.PI / 2) * (i / n);
    pts.push(new THREE.Vector3(x + w - r + r * Math.cos(a), y + h - r + r * Math.sin(a), 0.05));
  }
  pts.push(new THREE.Vector3(x + r, y + h, 0.05));
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (Math.PI / 2) * (i / n);
    pts.push(new THREE.Vector3(x + r + r * Math.cos(a), y + h - r + r * Math.sin(a), 0.05));
  }
  pts.push(new THREE.Vector3(x, y + r, 0.05));
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (Math.PI / 2) * (i / n);
    pts.push(new THREE.Vector3(x + r + r * Math.cos(a), y + r + r * Math.sin(a), 0.05));
  }
  pts.push(pts[0].clone());
  return pts;
}

// ─── Layout (row-based, domain to the side, base above derived) ───
function computeLayout() {
  const rowBuckets = {};
  const sideNodes = [];
  const leftSideNodes = [];

  nodes.forEach(n => {
    if (n.side === "right") {
      sideNodes.push(n);
    } else if (n.side === "left") {
      leftSideNodes.push(n);
    } else {
      const r = n.row;
      if (!rowBuckets[r]) rowBuckets[r] = [];
      rowBuckets[r].push(n);
    }
  });

  const positions = {};

  const rowKeys = Object.keys(rowBuckets).map(Number).sort((a, b) => a - b);
  rowKeys.forEach(rowIdx => {
    const nodesInRow = rowBuckets[rowIdx];

    const groupOrder = [];
    const groupMap = {};
    nodesInRow.forEach(n => {
      if (!groupMap[n.group]) { groupMap[n.group] = []; groupOrder.push(n.group); }
      groupMap[n.group].push(n);
    });

    const flat = [];
    const gapsBefore = new Set();
    groupOrder.forEach((g, gi) => {
      if (gi > 0) gapsBefore.add(flat.length);
      groupMap[g].forEach(n => flat.push(n));
    });

    let totalW = 0;
    flat.forEach((n, i) => {
      if (i === 0) {
        totalW = nodeWidths[n.id];
      } else {
        const gap = gapsBefore.has(i) ? GROUP_GAP_X : ITEM_GAP_X;
        totalW += gap + nodeWidths[n.id];
      }
    });

    let cursor = -totalW / 2 + nodeWidths[flat[0].id] / 2;
    flat.forEach((node, i) => {
      if (i > 0) {
        const prevW = nodeWidths[flat[i - 1].id];
        const curW = nodeWidths[node.id];
        const gap = gapsBefore.has(i) ? GROUP_GAP_X : ITEM_GAP_X;
        cursor += prevW / 2 + gap + curW / 2;
      }
      positions[node.id] = { x: cursor, y: -(rowIdx * LAYER_GAP_Y) };
    });
  });

  const allXs = Object.values(positions).map(p => p.x);
  const maxMainX = Math.max(...allXs) + DOMAIN_OFFSET_X;
  const sideGap = NODE_HEIGHT + TAG_OFFSET_Y + 5;

  sideNodes.forEach((n, i) => {
    positions[n.id] = {
      x: maxMainX + nodeWidths[n.id] / 2,
      y: -(2 * LAYER_GAP_Y) + (sideNodes.length - 1) * sideGap / 2 - i * sideGap,
    };
  });

  const minMainX = Math.min(...allXs) - DOMAIN_OFFSET_X;
  const allYs = Object.values(positions).map(p => p.y);
  const midY = (Math.max(...allYs) + Math.min(...allYs)) / 2;
  leftSideNodes.forEach((n, i) => {
    positions[n.id] = {
      x: minMainX - nodeWidths[n.id] / 2,
      y: midY + (leftSideNodes.length - 1) * sideGap / 2 - i * sideGap,
    };
  });

  return positions;
}

// ─── Nodes ───
function createNodes(positions) {
  nodes.forEach(n => {
    const w = nodeWidths[n.id];
    const fillShape = createRoundedRectShape(w, NODE_HEIGHT, NODE_RADIUS);
    const fillGeo = new THREE.ShapeGeometry(fillShape);

    const color = new THREE.Color(LAYER_COLORS[n.layer]);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
    const mesh = new THREE.Mesh(fillGeo, mat);
    const pos = positions[n.id];
    mesh.position.set(pos.x, pos.y, 0);
    mesh.userData = { nodeId: n.id, baseColor: color.clone() };
    scene.add(mesh);
    nodeMeshes[n.id] = mesh;

    const outlinePts = createRoundedRectOutline(w, NODE_HEIGHT, NODE_RADIUS, 6);
    const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts);
    const outlineMat = new THREE.LineBasicMaterial({
      color: color.clone().multiplyScalar(0.5),
      transparent: true, opacity: 0.5,
    });
    const outlineLine = new THREE.Line(outlineGeo, outlineMat);
    mesh.add(outlineLine);
    nodeBorders[n.id] = outlineLine;

    const tagDiv = document.createElement("div");
    tagDiv.className = "node-tag";
    tagDiv.textContent = n.label;
    tagDiv.style.color = "#" + color.getHexString();
    const tagObj = new CSS2DObject(tagDiv);
    tagObj.position.set(0, NODE_HEIGHT / 2 + TAG_OFFSET_Y, 0.1);
    mesh.add(tagObj);
    nodeTags[n.id] = tagDiv;
    nodeLabels[n.id] = tagDiv;
  });
}

// ─── Edges ───
function createEdges(positions) {
  edges.forEach(e => {
    const src = positions[e.source];
    const tgt = positions[e.target];
    if (!src || !tgt) return;

    const srcNode = nodeMap[e.source];
    const tgtNode = nodeMap[e.target];
    const srcRow = srcNode?.row ?? 0;
    const tgtRow = tgtNode?.row ?? 0;
    const isSide = !!srcNode?.side || !!tgtNode?.side;
    const sameRow = srcRow === tgtRow && !isSide;

    let startX, startY, endX, endY, cpX, cpY;

    const srcW = nodeWidths[e.source] || MIN_NODE_WIDTH;
    const tgtW = nodeWidths[e.target] || MIN_NODE_WIDTH;

    if (isSide) {
      startX = src.x + (tgt.x > src.x ? srcW / 2 : -srcW / 2);
      startY = src.y;
      endX = tgt.x + (src.x > tgt.x ? tgtW / 2 : -tgtW / 2);
      endY = tgt.y;
      cpX = (startX + endX) / 2;
      cpY = (startY + endY) / 2;
    } else if (sameRow) {
      startX = src.x;
      startY = src.y - NODE_HEIGHT / 2;
      endX = tgt.x;
      endY = tgt.y - NODE_HEIGHT / 2;
      cpX = (startX + endX) / 2;
      cpY = startY - NODE_HEIGHT * 2;
    } else {
      const goingDown = tgtRow > srcRow;
      startX = src.x;
      startY = src.y + (goingDown ? -NODE_HEIGHT / 2 : NODE_HEIGHT / 2);
      endX = tgt.x;
      endY = tgt.y + (goingDown ? NODE_HEIGHT / 2 : -NODE_HEIGHT / 2);
      cpX = (startX + endX) / 2;
      cpY = (startY + endY) / 2;
    }

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(startX, startY, -0.1),
      new THREE.Vector3(cpX, cpY, -0.1),
      new THREE.Vector3(endX, endY, -0.1)
    );
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32));

    let mat;
    if (e.type === "inheritance") {
      mat = new THREE.LineDashedMaterial({
        color: EDGE_DEFAULT_COLOR, transparent: true,
        opacity: EDGE_DEFAULT_OPACITY, dashSize: 0.6, gapSize: 0.4,
      });
    } else if (e.type === "dependency") {
      mat = new THREE.LineDashedMaterial({
        color: new THREE.Color(0x555050), transparent: true,
        opacity: EDGE_DEFAULT_OPACITY * 0.7, dashSize: 0.4, gapSize: 0.5,
      });
    } else {
      mat = new THREE.LineBasicMaterial({
        color: EDGE_DEFAULT_COLOR, transparent: true, opacity: EDGE_DEFAULT_OPACITY,
      });
    }

    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    line.userData = { source: e.source, target: e.target, type: e.type };
    scene.add(line);
    edgeLines.push(line);
    edgeCurves[`${e.source}->${e.target}`] = curve;
  });
}

// ─── Chip Mesh Visualization ───
const CHIP_W = 10;
const CHIP_H = 7;
const CHIP_GAP_X = 5;
const CHIP_GAP_Y = 5;
const CHIP_COLOR = new THREE.Color(0x06b6d4);
const CHIP_BORDER_COLOR = new THREE.Color(0x0891b2);
const CHIP_INACTIVE_COLOR = new THREE.Color(0x1a1a2e);
const LINK_COLOR = new THREE.Color(0x0e7490);

let currentMeshShape = [1, 1];
let currentDeviceIds = [0];

function clearChipMesh() {
  chipMeshes.forEach(m => { scene.remove(m); });
  chipLines.forEach(l => { scene.remove(l); });
  chipLabelObjects.forEach(o => { scene.remove(o); });
  chipMeshes.length = 0;
  chipLines.length = 0;
  chipLabelObjects.length = 0;
}

function hideDevActiveNode() {
  const mesh = nodeMeshes["dev_active"];
  if (mesh) mesh.visible = false;
  const border = nodeBorders["dev_active"];
  if (border) border.visible = false;
  const tag = nodeTags["dev_active"];
  if (tag) tag.style.display = "none";
}

function buildChipMesh(meshShape, deviceIds) {
  clearChipMesh();
  hideDevActiveNode();
  const anchor = layoutPositions["dev_active"];
  if (!anchor) return;

  const [rows, cols] = meshShape;
  if (rows < 1 || cols < 1) return;

  const activeSet = new Set(deviceIds);
  const totalSlots = rows * cols;
  const totalW = cols * CHIP_W + (cols - 1) * CHIP_GAP_X;
  const totalH = rows * CHIP_H + (rows - 1) * CHIP_GAP_Y;
  const originX = anchor.x - totalW / 2 + CHIP_W / 2;
  const originY = anchor.y - totalH / 2 + CHIP_H / 2;

  const chipPositions = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = originX + c * (CHIP_W + CHIP_GAP_X);
      const cy = originY + (rows - 1 - r) * (CHIP_H + CHIP_GAP_Y);
      const slotIdx = r * cols + c;
      const isActive = activeSet.has(slotIdx);
      chipPositions.push({ x: cx, y: cy, idx: slotIdx, active: isActive });

      const fillColor = isActive
        ? CHIP_COLOR.clone().multiplyScalar(0.35)
        : CHIP_INACTIVE_COLOR.clone();
      const shape = createRoundedRectShape(CHIP_W, CHIP_H, 1.2);
      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshBasicMaterial({
        color: fillColor, transparent: true,
        opacity: isActive ? 0.85 : 0.35,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, cy, -0.05);
      scene.add(mesh);
      chipMeshes.push(mesh);

      const borderColor = isActive
        ? CHIP_BORDER_COLOR.clone()
        : CHIP_BORDER_COLOR.clone().multiplyScalar(0.3);
      const outline = createRoundedRectOutline(CHIP_W, CHIP_H, 1.2, 6);
      const outGeo = new THREE.BufferGeometry().setFromPoints(outline);
      const outMat = new THREE.LineBasicMaterial({
        color: borderColor, transparent: true,
        opacity: isActive ? 0.6 : 0.2,
      });
      const outLine = new THREE.Line(outGeo, outMat);
      mesh.add(outLine);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const from = chipPositions[r * cols + c];
      if (c < cols - 1) {
        const to = chipPositions[r * cols + c + 1];
        const isOnBoardPair = (c % 2 === 0);
        addChipLink(from, to, isOnBoardPair);
      }
      if (r < rows - 1) {
        const to = chipPositions[(r + 1) * cols + c];
        addChipLink(from, to, false);
      }
    }
  }

  const frameW = totalW + 10;
  const frameH = totalH + 10;
  const framePts = createRoundedRectOutline(frameW, frameH, 2, 6);
  const frameGeo = new THREE.BufferGeometry().setFromPoints(framePts);
  const frameMat = new THREE.LineBasicMaterial({
    color: CHIP_BORDER_COLOR, transparent: true, opacity: 0.15,
  });
  const frameLine = new THREE.Line(frameGeo, frameMat);
  frameLine.position.set(anchor.x, anchor.y, -0.15);
  scene.add(frameLine);
  chipLines.push(frameLine);

  const cfg = DEVICE_CONFIGS[activeDeviceType];
  const deviceLabel = cfg ? cfg.label : `${rows}x${cols}`;
  const titleDiv = document.createElement("div");
  titleDiv.className = "chip-mesh-title";
  titleDiv.textContent = deviceLabel;
  const titleObj = new CSS2DObject(titleDiv);
  titleObj.position.set(anchor.x, anchor.y + totalH / 2 + 4, 0.1);
  scene.add(titleObj);
  chipLabelObjects.push(titleObj);
}

function addChipLink(from, to, isIntraCard) {
  const bothActive = from.active && to.active;
  const pts = [
    new THREE.Vector3(from.x, from.y, -0.08),
    new THREE.Vector3(to.x, to.y, -0.08),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({
    color: isIntraCard ? CHIP_COLOR : LINK_COLOR,
    transparent: true,
    opacity: bothActive ? (isIntraCard ? 0.5 : 0.3) : 0.1,
    dashSize: 0.8, gapSize: 0.5,
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  scene.add(line);
  chipLines.push(line);
}

function switchDevice(deviceType) {
  const cfg = DEVICE_CONFIGS[deviceType];
  if (!cfg) return;
  activeDeviceType = deviceType;
  currentMeshShape = [...cfg.meshShape];
  currentDeviceIds = [...cfg.deviceIds];

  const devNode = nodeMap["dev_active"];
  if (devNode) {
    devNode.label = cfg.label;
    devNode.description = cfg.description;
    devNode.func = cfg.func;
    devNode.file = cfg.file;
    devNode.internals = cfg.internals;
  }

  const tag = nodeTags["dev_active"];
  if (tag) tag.textContent = cfg.label;

  buildChipMesh(currentMeshShape, currentDeviceIds);
  syncDeviceInputs();
  syncDeviceButtons();
}

function syncDeviceInputs() {
  const idsInput = document.getElementById("device-ids-input");
  const meshInput = document.getElementById("mesh-shape-input");
  if (idsInput) idsInput.value = JSON.stringify(currentDeviceIds);
  if (meshInput) meshInput.value = currentMeshShape.join("x");
}

function syncDeviceButtons() {
  document.querySelectorAll(".dev-type-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === activeDeviceType);
  });
}

function validateMeshShapeInput() {
  const cfg = DEVICE_CONFIGS[activeDeviceType];
  if (!cfg) return;

  const meshInput = document.getElementById("mesh-shape-input");
  if (!meshInput) return;

  const raw = meshInput.value.replace(/[^0-9,x×]/gi, "");
  const parts = raw.split(/[,x×]/i).map(Number).filter(n => n > 0 && Number.isFinite(n));

  const validShape = cfg.meshShape;
  const validProduct = validShape[0] * validShape[1];

  if (parts.length >= 2 && parts[0] * parts[1] === validProduct) {
    currentMeshShape = [parts[0], parts[1]];
  } else {
    currentMeshShape = [...validShape];
  }

  syncDeviceInputs();
  buildChipMesh(currentMeshShape, currentDeviceIds);
}

function validateDeviceIdsInput() {
  const cfg = DEVICE_CONFIGS[activeDeviceType];
  if (!cfg) return;

  const idsInput = document.getElementById("device-ids-input");
  if (!idsInput) return;

  let parsed = [];
  try {
    const arr = JSON.parse(idsInput.value);
    if (Array.isArray(arr)) parsed = arr.filter(n => typeof n === "number" && Number.isFinite(n));
  } catch {
    const nums = idsInput.value.replace(/[\[\]]/g, "").split(/[,\s]+/).map(Number).filter(n => Number.isFinite(n));
    parsed = nums;
  }

  const maxId = cfg.chipCount - 1;
  const valid = parsed.filter(id => id >= 0 && id <= maxId);

  if (valid.length > 0 && valid.length <= cfg.chipCount) {
    currentDeviceIds = valid;
  } else {
    currentDeviceIds = [...cfg.deviceIds];
  }

  syncDeviceInputs();
  buildChipMesh(currentMeshShape, currentDeviceIds);
}

function setupDeviceConfig() {
  const container = document.getElementById("device-type-buttons");
  if (!container) return;

  const types = ["n150", "n300", "t3k", "galaxy"];
  const labels = { n150: "n150", n300: "n300", t3k: "T3K", galaxy: "Galaxy" };

  types.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "dev-type-btn" + (t === activeDeviceType ? " active" : "");
    btn.dataset.type = t;
    btn.textContent = labels[t];
    btn.addEventListener("click", () => switchDevice(t));
    container.appendChild(btn);
  });

  const meshInput = document.getElementById("mesh-shape-input");
  if (meshInput) meshInput.addEventListener("change", validateMeshShapeInput);

  const idsInput = document.getElementById("device-ids-input");
  if (idsInput) idsInput.addEventListener("change", validateDeviceIdsInput);

  const defaultCfg = DEVICE_CONFIGS[activeDeviceType];
  currentMeshShape = [...defaultCfg.meshShape];
  currentDeviceIds = [...defaultCfg.deviceIds];
  syncDeviceInputs();
}

// ─── Ball ───
let cachedGlowTexture = null;

function generateGlowTexture() {
  if (cachedGlowTexture) return cachedGlowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(211,144,75,0.9)");
  grad.addColorStop(0.3, "rgba(211,144,75,0.4)");
  grad.addColorStop(0.7, "rgba(242,5,135,0.12)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  cachedGlowTexture = new THREE.CanvasTexture(canvas);
  cachedGlowTexture.needsUpdate = true;
  return cachedGlowTexture;
}

function createBall() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xd3904b, transparent: true, opacity: 0 })
  );
  group.add(core);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: generateGlowTexture(),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    })
  );
  glow.scale.set(8, 8, 1);
  group.add(glow);
  group.position.z = 1;
  return group;
}

function removeBall() {
  currentAnimNodeId = null;
  animPath = [];
  animPathIdx = 0;
  animForwardIdx = 0;
  jumpTarget = null;
  cancelWait();
  cancelCurveAnimation();
  cancelFallbackTravel();
  cancelInsideWait();
  cancelInsideTokenTween();
  cancelTransition();
  overviewZoom = null;
  autoExploreId++;
  closeExplainPanel();
  if (manualInsideActive) exitNodeManual();
  if (ballGroup) {
    gsap.killTweensOf(ballGroup.position);
    scene.remove(ballGroup);
    ballGroup = null;
  }
  if (ballTimeline) {
    ballTimeline.kill();
    ballTimeline = null;
  }
  isAnimating = false;
  isPaused = false;
  if (resumeResolve) { resumeResolve(); resumeResolve = null; }

  if (isInsideNode || insideObjects.length > 0) {
    exitInside();
  }

  updatePauseButton();
  updateSendButtons();
  const bottomBar = document.getElementById("bottom-bar");
  if (bottomBar) bottomBar.classList.remove("visible");
  const callStack = document.getElementById("call-stack");
  if (callStack) callStack.classList.remove("visible");
}

function buildAnimationPath(modelName) {
  const pathIds = modelPaths[modelName];
  if (!pathIds || pathIds.length === 0) return [];

  const hasEdge = (a, b) =>
    !!edgeCurves[`${a}->${b}`] || !!edgeCurves[`${b}->${a}`];

  const result = [];

  for (const nodeId of pathIds) {
    if (!nodeMap[nodeId]) continue;

    if (result.length === 0) {
      result.push({ id: nodeId, isBacktrack: false });
      continue;
    }

    const lastId = result[result.length - 1].id;

    if (hasEdge(lastId, nodeId)) {
      result.push({ id: nodeId, isBacktrack: false });
      continue;
    }

    let bridgeIdx = -1;
    for (let k = result.length - 2; k >= 0; k--) {
      if (hasEdge(result[k].id, nodeId)) {
        bridgeIdx = k;
        break;
      }
    }

    if (bridgeIdx >= 0) {
      for (let j = result.length - 1; j > bridgeIdx; j--) {
        result.push({ id: result[j - 1].id, isBacktrack: true });
      }
      result.push({ id: nodeId, isBacktrack: false });
    } else {
      result.push({ id: nodeId, isBacktrack: false });
    }
  }

  return result;
}

function getCurveForHop(fromId, toId) {
  const direct = edgeCurves[`${fromId}->${toId}`];
  if (direct) return { curve: direct, reversed: false };

  const reverse = edgeCurves[`${toId}->${fromId}`];
  if (reverse) return { curve: reverse, reversed: true };

  const fromPos = layoutPositions[fromId];
  const toPos = layoutPositions[toId];
  if (!fromPos || !toPos) return null;

  const midX = (fromPos.x + toPos.x) / 2;
  const midY = (fromPos.y + toPos.y) / 2;
  const fallback = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(fromPos.x, fromPos.y, 1),
    new THREE.Vector3(midX, midY, 1),
    new THREE.Vector3(toPos.x, toPos.y, 1)
  );
  return { curve: fallback, reversed: false };
}

function pulseNode(nodeId) {
  const mesh = nodeMeshes[nodeId];
  if (!mesh) return;
  gsap.to(mesh.scale, { x: 1.2, y: 1.2, duration: 0.25, ease: "power2.out",
    onComplete: () => gsap.to(mesh.scale, { x: 1, y: 1, duration: 0.4, ease: "elastic.out(1,0.4)" })
  });
  const border = nodeBorders[nodeId];
  if (border) {
    gsap.to(border.material, { opacity: 1.0, duration: 0.2 });
    gsap.to(border.material.color, { r: 1, g: 0.9, b: 0.5, duration: 0.2 });
    gsap.to(border.material, { opacity: 0.6, duration: 0.6, delay: 0.5 });
  }
}

function tweenTo(target, vars) {
  return new Promise(resolve => gsap.to(target, { ...vars, onComplete: resolve }));
}

let activeWaitTimer = null;
let activeWaitResolve = null;

function wait(ms) {
  return new Promise(resolve => {
    activeWaitResolve = resolve;
    activeWaitTimer = setTimeout(() => {
      activeWaitTimer = null;
      activeWaitResolve = null;
      resolve();
    }, ms);
  });
}

function cancelWait() {
  if (activeWaitTimer) { clearTimeout(activeWaitTimer); activeWaitTimer = null; }
  if (activeWaitResolve) { activeWaitResolve(); activeWaitResolve = null; }
}

function buildTimeline(animPath) {
  const track = document.getElementById("timeline-track");
  if (!track) return;
  track.innerHTML = "";

  forwardPath = animPath.filter(step => !step.isBacktrack);

  forwardPath.forEach((step, idx) => {
    if (idx > 0) {
      const arrow = document.createElement("span");
      arrow.className = "tl-arrow";
      arrow.textContent = "→";
      track.appendChild(arrow);
    }
    const el = document.createElement("span");
    el.className = "tl-node";
    el.textContent = nodeMap[step.id]?.label || step.id;
    el.dataset.idx = idx;
    track.appendChild(el);
  });
}

function updateTimeline(activeIdx) {
  const nodes = document.querySelectorAll(".tl-node");
  const arrows = document.querySelectorAll(".tl-arrow");

  nodes.forEach((el, i) => {
    el.classList.toggle("active", i === activeIdx);
    el.classList.toggle("visited", i < activeIdx);
  });

  arrows.forEach((el, i) => {
    el.classList.toggle("active", i === activeIdx - 1);
    el.classList.toggle("visited", i < activeIdx - 1);
  });

  const activeEl = nodes[activeIdx];
  if (activeEl) {
    const container = document.getElementById("timeline-container");
    if (!container) return;
    const itemLeft = activeEl.offsetLeft;
    const itemWidth = activeEl.offsetWidth;
    const containerWidth = container.offsetWidth;
    container.scrollTo({
      left: itemLeft - containerWidth / 2 + itemWidth / 2,
      behavior: "smooth"
    });
  }
}

function buildCallStack() {
  const track = document.getElementById("call-stack-track");
  if (!track) return;
  track.innerHTML = "";

  forwardPath.forEach((step) => {
    const nd = nodeMap[step.id];
    const item = document.createElement("div");
    item.className = "cs-item";

    const funcName = nd?.func || nd?.label || step.id;
    const compName = nd?.label || "";
    const desc = nd?.description || "";
    const file = nd?.file || "";
    const layerHex = nd ? "#" + new THREE.Color(LAYER_COLORS[nd.layer]).getHexString() : "#666";

    const header = document.createElement("div");
    header.className = "cs-header";

    const dot = document.createElement("span");
    dot.className = "cs-dot";
    dot.style.background = layerHex;
    header.appendChild(dot);

    const funcEl = document.createElement("span");
    funcEl.className = "cs-func";
    funcEl.textContent = funcName;
    header.appendChild(funcEl);
    item.appendChild(header);

    if (compName && compName !== funcName) {
      const compEl = document.createElement("div");
      compEl.className = "cs-comp";
      compEl.textContent = compName;
      item.appendChild(compEl);
    }

    const details = document.createElement("div");
    details.className = "cs-details";

    if (file) {
      const fileEl = document.createElement("div");
      fileEl.className = "cs-file";
      fileEl.textContent = file;
      details.appendChild(fileEl);
    }

    if (desc) {
      const descEl = document.createElement("div");
      descEl.className = "cs-desc";
      descEl.textContent = desc;
      details.appendChild(descEl);
    }

    const internals = nd?.internals;
    if (internals && internals.length > 0) {
      const stepsWrap = document.createElement("div");
      stepsWrap.className = "cs-internals";

      internals.forEach((s) => {
        const row = document.createElement("div");
        row.className = "cs-int-step";

        const badge = document.createElement("span");
        badge.className = `cs-int-type cs-int-type--${s.type}`;
        badge.textContent = s.type;
        row.appendChild(badge);

        const name = document.createElement("span");
        name.className = "cs-int-name";
        name.textContent = s.name;
        row.appendChild(name);

        stepsWrap.appendChild(row);
      });

      details.appendChild(stepsWrap);
    }

    item.appendChild(details);
    track.appendChild(item);
  });
}

function updateCallStack(activeIdx) {
  const items = document.querySelectorAll(".cs-item");
  const track = document.getElementById("call-stack-track");
  if (!track || items.length === 0) return;

  items.forEach((item, i) => {
    item.classList.remove("cs-active", "cs-near", "cs-far", "cs-visited");
    if (i === activeIdx) {
      item.classList.add("cs-active");
    } else if (i < activeIdx) {
      item.classList.add("cs-visited");
    } else if (Math.abs(i - activeIdx) <= 2) {
      item.classList.add("cs-near");
    } else {
      item.classList.add("cs-far");
    }
  });

  const container = document.getElementById("call-stack");
  const containerH = container ? container.offsetHeight : 400;

  requestAnimationFrame(() => {
    let offsetTop = 0;
    for (let i = 0; i < activeIdx && i < items.length; i++) {
      offsetTop += items[i].offsetHeight;
    }
    const activeH = items[activeIdx] ? items[activeIdx].offsetHeight : 44;
    const centerOffset = containerH / 2 - activeH / 2;
    track.style.transform = `translateY(${-offsetTop + centerOffset}px)`;
  });
}

function updateSpeedDisplay() {
  const label = document.getElementById("speed-label");
  if (label) label.textContent = `${speedMultiplier}×`;
}

function slowDown() {
  speedIdx = Math.min(speedIdx + 1, SPEED_LEVELS.length - 1);
  speedMultiplier = SPEED_LEVELS[speedIdx];
  updateSpeedDisplay();
}

function speedUp() {
  speedIdx = Math.max(speedIdx - 1, 0);
  speedMultiplier = SPEED_LEVELS[speedIdx];
  updateSpeedDisplay();
}

function resetSpeed() {
  speedIdx = 0;
  speedMultiplier = SPEED_LEVELS[0];
  updateSpeedDisplay();
}

function togglePause() {
  if (manualInsideActive) exitNodeManual();
  if (isPaused) {
    isPaused = false;
    if (resumeResolve) {
      resumeResolve();
      resumeResolve = null;
    }
  } else {
    isPaused = true;
  }
  updatePauseButton();
}

function waitForResume() {
  if (jumpTarget !== null) return Promise.resolve();
  if (!isPaused) return Promise.resolve();
  return new Promise(resolve => { resumeResolve = resolve; });
}

function updatePauseButton() {
  const btn = document.getElementById("btn-pause");
  if (!btn) return;
  btn.textContent = isPaused ? "▶" : "⏸";
  btn.title = isPaused ? "Resume" : "Pause";
}

function toggleCameraFollow() {
  cameraFollowsBall = !cameraFollowsBall;
  updateFollowButton();
}

function updateFollowButton() {
  const btn = document.getElementById("btn-follow");
  if (!btn) return;
  btn.textContent = cameraFollowsBall ? "🔒 Follow" : "🔓 Free";
  btn.title = cameraFollowsBall ? "Camera follows ball (click to unlock)" : "Free camera (click to lock on ball)";
  btn.classList.toggle("active", cameraFollowsBall);
}

let activeCurveTween = null;
let activeCurveResolve = null;

function cancelCurveAnimation() {
  if (activeCurveTween) { activeCurveTween.kill(); activeCurveTween = null; }
  if (activeCurveResolve) { activeCurveResolve(); activeCurveResolve = null; }
}

function animateAlongCurve(curve, reversed, durationMs) {
  return new Promise(resolve => {
    activeCurveResolve = resolve;
    const proxy = { p: 0 };
    const tw = gsap.to(proxy, {
      p: 1,
      duration: durationMs / 1000,
      ease: "power2.inOut",
      onUpdate: () => {
        if (!ballGroup) { tw.kill(); activeCurveTween = null; activeCurveResolve = null; resolve(); return; }
        const t = reversed ? (1 - proxy.p) : proxy.p;
        const pt = curve.getPoint(t);
        ballGroup.position.set(pt.x, pt.y, 1);
        if (cameraFollowsBall) controls.moveTo(pt.x, pt.y, 0, true);
      },
      onComplete: () => { activeCurveTween = null; activeCurveResolve = null; resolve(); },
    });
    activeCurveTween = tw;
  });
}

let activeFallbackTween = null;
let activeFallbackResolve = null;

function cancelFallbackTravel() {
  if (activeFallbackTween) { activeFallbackTween.kill(); activeFallbackTween = null; }
  if (activeFallbackResolve) { activeFallbackResolve(); activeFallbackResolve = null; }
}

function cancelActiveOperations() {
  cancelWait();
  cancelCurveAnimation();
  cancelFallbackTravel();
  cancelInsideWait();
  cancelInsideTokenTween();
  if (insideToken) gsap.killTweensOf(insideToken.position);
  if (isInsideNode && !manualInsideActive) {
    autoExploreId++;
    disposeInsideObjects(insideObjects);
    insideObjects = [];
    insideToken = null;
    insideStepPositions = [];
    insideStepMeshes = [];
    insideStepBorders = [];
    isInsideNode = false;
    insideNodeId = null;
    insideAnimating = false;
    autoExplorePrevZoom = null;
    autoExploreNodePos = null;
    restoreMainGraph();
    if (ballGroup) ballGroup.visible = true;
  }
}

function interruptLoop() {
  cancelActiveOperations();
  if (resumeResolve) { resumeResolve(); resumeResolve = null; }
}

const FORWARD_PAUSE = 1200;
const BACKTRACK_PAUSE = 200;
const FORWARD_TRAVEL = 1000;
const BACKTRACK_TRAVEL = 500;

function arriveAtNode(nodeId, isBacktrack, statusText) {
  const nd = nodeMap[nodeId];
  const mesh = nodeMeshes[nodeId];

  if (mesh && ballGroup) {
    ballGroup.visible = true;
    ballGroup.position.set(mesh.position.x, mesh.position.y, 1);
    if (cameraFollowsBall) controls.moveTo(mesh.position.x, mesh.position.y, 0, true);
  }

  if (!isBacktrack) {
    currentAnimNodeId = nodeId;
    updateTimeline(animForwardIdx);
    updateCallStack(animForwardIdx);
    pulseNode(nodeId);
    if (nd) showInfoPanel(nd);
    if (statusText && nd) statusText.textContent = nd.label;
  } else {
    if (statusText) statusText.textContent = `↩ ${nd ? nd.label : nodeId}`;
  }
}

async function launchBall(modelName) {
  if (isAnimating) return;
  exitOverviewForAction();

  const path = buildAnimationPath(modelName);
  if (path.length < 2) return;

  if (!activeModel || activeModel !== modelName) {
    highlightPath(modelName);
  }

  removeBall();

  animPath = path;
  animPathIdx = 0;
  animForwardIdx = 0;
  jumpTarget = null;
  isAnimating = true;
  updateSendButtons();

  overviewZoom = camera.zoom;

  ballGroup = createBall();
  scene.add(ballGroup);

  const startPos = layoutPositions[path[0].id];
  if (!startPos) { removeBall(); return; }
  ballGroup.position.set(startPos.x, startPos.y, 1);

  const coreMat = ballGroup.children[0].material;
  const glowMat = ballGroup.children[1].material;

  buildTimeline(path);
  buildCallStack();
  cameraFollowsBall = true;
  updateFollowButton();
  updateSpeedDisplay();

  const bottomBar = document.getElementById("bottom-bar");
  const callStack = document.getElementById("call-stack");
  const statusText = document.getElementById("ball-status-text");
  if (bottomBar) bottomBar.classList.add("visible");
  if (callStack) callStack.classList.add("visible");

  gsap.to(coreMat, { opacity: 0.95, duration: 0.3 });
  await tweenTo(glowMat, { opacity: 0.6, duration: 0.3 });

  animPathIdx = 0;
  while (animPathIdx < animPath.length) {
    await waitForResume();
    if (!ballGroup) return;

    if (jumpTarget !== null) {
      animPathIdx = jumpTarget.pathIdx;
      animForwardIdx = jumpTarget.forwardIdx;
      jumpTarget = null;
      continue;
    }

    const { id: nodeId, isBacktrack } = animPath[animPathIdx];
    arriveAtNode(nodeId, isBacktrack, statusText);

    if (isBacktrack) {
      await wait(BACKTRACK_PAUSE / speedMultiplier);
      if (!ballGroup) return;
      if (jumpTarget !== null) continue;
    } else {
      animForwardIdx++;
      await wait(FORWARD_PAUSE / speedMultiplier);
      if (!ballGroup) return;
      if (jumpTarget !== null) continue;

      const nd = nodeMap[nodeId];
      if (autoExploreEnabled && nd && nd.internals && nd.internals.length && ballGroup) {
        await autoExploreNode(nd);
        if (!ballGroup) return;
        if (jumpTarget !== null) continue;
      }
    }

    await waitForResume();
    if (!ballGroup) return;
    if (jumpTarget !== null) continue;

    if (animPathIdx < animPath.length - 1) {
      const nextId = animPath[animPathIdx + 1].id;
      const nextIsBacktrack = animPath[animPathIdx + 1].isBacktrack;
      const isBack = animPath[animPathIdx].isBacktrack || nextIsBacktrack;
      const travelMs = (isBack ? BACKTRACK_TRAVEL : FORWARD_TRAVEL) / speedMultiplier;

      const hop = getCurveForHop(nodeId, nextId);
      if (hop) {
        await animateAlongCurve(hop.curve, hop.reversed, travelMs);
      } else {
        const targetPos = layoutPositions[nextId];
        if (targetPos && ballGroup) {
          await new Promise(resolve => {
            activeFallbackResolve = resolve;
            activeFallbackTween = gsap.to(ballGroup.position, {
              x: targetPos.x, y: targetPos.y,
              duration: travelMs / 1000, ease: "power2.inOut",
              onComplete: () => { activeFallbackTween = null; activeFallbackResolve = null; resolve(); },
            });
          });
        }
      }
      if (!ballGroup) return;
      if (jumpTarget !== null) continue;
    }

    animPathIdx++;
  }

  if (!ballGroup) return;
  currentAnimNodeId = null;
  if (statusText) statusText.textContent = "Request complete";
  updateTimeline(forwardPath.length - 1);
  updateCallStack(forwardPath.length - 1);
  gsap.to(coreMat, { opacity: 0, duration: 0.5 });
  await tweenTo(glowMat, { opacity: 0, duration: 0.5 });
  removeBall();
  if (bottomBar) setTimeout(() => bottomBar.classList.remove("visible"), 1500);
  if (callStack) setTimeout(() => callStack.classList.remove("visible"), 1500);
}

// ─── Manual Navigation ───
function ensurePaused() {
  if (!isPaused && isAnimating) {
    isPaused = true;
    updatePauseButton();
  }
}

function findForwardIdxAtPathIdx(pathIdx) {
  let count = 0;
  for (let i = 0; i <= pathIdx && i < animPath.length; i++) {
    if (!animPath[i].isBacktrack) count++;
  }
  return Math.max(0, count - 1);
}

function findPathIdxForForwardIdx(fwdIdx) {
  let count = 0;
  for (let i = 0; i < animPath.length; i++) {
    if (!animPath[i].isBacktrack) {
      if (count === fwdIdx) return i;
      count++;
    }
  }
  return animPath.length - 1;
}

function manualJump(targetPathIdx) {
  if (!isAnimating || !ballGroup) return;
  if (targetPathIdx < 0 || targetPathIdx >= animPath.length) return;

  if (manualInsideActive) exitNodeManual();
  closeExplainPanel();

  const step = animPath[targetPathIdx];
  const fwdIdx = findForwardIdxAtPathIdx(targetPathIdx);

  isPaused = true;
  updatePauseButton();
  jumpTarget = { pathIdx: targetPathIdx, forwardIdx: fwdIdx };
  animForwardIdx = fwdIdx;
  animPathIdx = targetPathIdx;

  arriveAtNode(step.id, step.isBacktrack, document.getElementById("ball-status-text"));

  interruptLoop();
}

async function animatedNodeTransition(nextPathIdx, startStep) {
  if (isTransitioning || !isAnimating || !ballGroup) return;
  if (nextPathIdx < 0 || nextPathIdx >= animPath.length) return;
  isTransitioning = true;

  const prevNodeId = animPath[animPathIdx]?.id;
  const prevPos = layoutPositions[prevNodeId];
  if (manualInsideActive) exitNodeManual();

  const step = animPath[nextPathIdx];
  const fwdIdx = findForwardIdxAtPathIdx(nextPathIdx);
  isPaused = true;
  updatePauseButton();
  jumpTarget = { pathIdx: nextPathIdx, forwardIdx: fwdIdx };
  animForwardIdx = fwdIdx;
  animPathIdx = nextPathIdx;
  closeExplainPanel();
  interruptLoop();

  const nextNodeId = step.id;
  const nextPos = layoutPositions[nextNodeId];
  const nextNd = nodeMap[nextNodeId];

  if (ballGroup && prevPos) {
    ballGroup.visible = true;
    ballGroup.position.set(prevPos.x, prevPos.y, 1);
    if (cameraFollowsBall) controls.moveTo(prevPos.x, prevPos.y, 0, true);
  }

  const targetZoom = overviewZoom || camera.zoom;
  const speed = speedMultiplier || 1;
  controls.zoomTo(targetZoom, true);
  await transitionWait(350 / speed);
  if (!ballGroup || !isTransitioning) { isTransitioning = false; return; }

  if (prevNodeId !== nextNodeId) {
    const hop = getCurveForHop(prevNodeId, nextNodeId);
    const hopMs = 500 / speed;
    if (hop && ballGroup) {
      await animateAlongCurve(hop.curve, hop.reversed, hopMs);
    } else if (nextPos && ballGroup) {
      const hopSec = hopMs / 1000;
      await new Promise(resolve => {
        activeFallbackResolve = resolve;
        activeFallbackTween = gsap.to(ballGroup.position, {
          x: nextPos.x, y: nextPos.y,
          duration: hopSec, ease: "power2.inOut",
          onComplete: () => { activeFallbackTween = null; activeFallbackResolve = null; resolve(); },
        });
      });
    }
  }
  if (!ballGroup || !isTransitioning) { isTransitioning = false; return; }

  currentAnimNodeId = nextNodeId;
  if (ballGroup && nextPos) {
    ballGroup.position.set(nextPos.x, nextPos.y, 1);
    if (cameraFollowsBall) controls.moveTo(nextPos.x, nextPos.y, 0, true);
  }
  if (!step.isBacktrack) {
    updateTimeline(animForwardIdx);
    updateCallStack(animForwardIdx);
    pulseNode(nextNodeId);
    if (nextNd) showInfoPanel(nextNd);
  }

  if (nextNd && nextNd.internals && nextNd.internals.length && !step.isBacktrack) {
    await transitionWait(200 / speed);
    if (!ballGroup || !isTransitioning) { isTransitioning = false; return; }
    enterNodeManual(nextNodeId, startStep);
  }

  isTransitioning = false;
}

function manualStepNext() {
  if (!isAnimating || !ballGroup || isTransitioning) return;

  if (manualInsideActive) {
    const nd = nodeMap[animPath[animPathIdx]?.id];
    const maxStep = nd && nd.internals ? nd.internals.length - 1 : 0;
    if (manualInsideStepIdx < maxStep) {
      highlightInsideStep(manualInsideStepIdx + 1);
    } else {
      const nextIdx = animPathIdx + 1;
      if (nextIdx >= animPath.length) return;
      animatedNodeTransition(nextIdx);
    }
    return;
  }

  const currentStep = animPath[animPathIdx];
  if (!currentStep) return;
  const nd = nodeMap[currentStep.id];
  if (nd && nd.internals && nd.internals.length && !currentStep.isBacktrack) {
    isPaused = true;
    updatePauseButton();
    jumpTarget = { pathIdx: animPathIdx, forwardIdx: animForwardIdx };
    const resumeStep = (isInsideNode && !manualInsideActive) ? autoExploreCurrentStep : undefined;
    cancelActiveOperations();
    if (enterNodeManual(currentStep.id, resumeStep)) return;
  }

  const nextIdx = animPathIdx + 1;
  if (nextIdx >= animPath.length) return;
  animatedNodeTransition(nextIdx);
}

function manualStepPrev() {
  if (!isAnimating || !ballGroup || isTransitioning) return;

  if (manualInsideActive) {
    if (manualInsideStepIdx > 0) {
      highlightInsideStep(manualInsideStepIdx - 1);
    } else {
      exitNodeManual();
    }
    return;
  }

  const prevIdx = animPathIdx - 1;
  if (prevIdx < 0) return;

  const prevStep = animPath[prevIdx];
  const prevNd = nodeMap[prevStep?.id];
  if (prevNd && prevNd.internals && prevNd.internals.length && !prevStep.isBacktrack) {
    animatedNodeTransition(prevIdx, prevNd.internals.length - 1);
    return;
  }

  animatedNodeTransition(prevIdx);
}

function manualNodeNext() {
  if (!isAnimating || !ballGroup || isTransitioning) return;
  const curFwd = findForwardIdxAtPathIdx(animPathIdx);
  const nextFwd = curFwd + 1;
  if (nextFwd >= forwardPath.length) return;
  animatedNodeTransition(findPathIdxForForwardIdx(nextFwd));
}

function manualNodePrev() {
  if (!isAnimating || !ballGroup || isTransitioning) return;
  const curFwd = findForwardIdxAtPathIdx(animPathIdx);
  const prevFwd = curFwd - 1;
  if (prevFwd < 0) return;
  animatedNodeTransition(findPathIdxForForwardIdx(prevFwd));
}

// ─── Highlighting (fixed: set-membership, not consecutive pairs) ───
function highlightPath(modelName) {
  exitOverviewForAction();
  activeModel = modelName;
  const pathIds = modelPaths[modelName];
  if (!pathIds) return;

  const modelNodeId = pathIds.find(id => id.startsWith("model_"));
  if (modelNodeId && MODEL_DEVICE_DEFAULTS[modelNodeId]) {
    switchDevice(MODEL_DEVICE_DEFAULTS[modelNodeId]);
  }

  const pathSet = new Set(pathIds);

  Object.entries(nodeMeshes).forEach(([id, mesh]) => {
    const inPath = pathSet.has(id);
    gsap.to(mesh.material, {
      opacity: inPath ? 1.0 : DIMMED_OPACITY,
      duration: 0.5, ease: "power2.out",
    });
    if (inPath) {
      const bright = mesh.userData.baseColor.clone().multiplyScalar(1.25);
      bright.r = Math.min(bright.r, 1);
      bright.g = Math.min(bright.g, 1);
      bright.b = Math.min(bright.b, 1);
      gsap.to(mesh.material.color, { r: bright.r, g: bright.g, b: bright.b, duration: 0.5, ease: "power2.out" });
    } else {
      const base = mesh.userData.baseColor;
      gsap.to(mesh.material.color, { r: base.r, g: base.g, b: base.b, duration: 0.5, ease: "power2.out" });
    }

    const border = nodeBorders[id];
    if (border) {
      gsap.to(border.material, { opacity: inPath ? 1.0 : 0.05, duration: 0.5 });
      if (inPath) {
        gsap.to(border.material.color, { r: 1, g: 1, b: 1, duration: 0.5 });
      }
    }

    const label = nodeLabels[id];
    if (label) {
      label.classList.toggle("highlighted", inPath);
      label.classList.toggle("dimmed", !inPath);
    }
    const tag = nodeTags[id];
    if (tag) {
      tag.classList.toggle("highlighted", inPath);
      tag.classList.toggle("dimmed", !inPath);
    }
  });

  edgeLines.forEach(line => {
    const srcIn = pathSet.has(line.userData.source);
    const tgtIn = pathSet.has(line.userData.target);
    const inPath = srcIn && tgtIn;

    gsap.to(line.material, {
      opacity: inPath ? EDGE_HIGHLIGHT_OPACITY : DIMMED_OPACITY * 0.4,
      duration: 0.5, ease: "power2.out",
    });
    if (inPath) {
      gsap.to(line.material.color, {
        r: EDGE_HIGHLIGHT_COLOR.r, g: EDGE_HIGHLIGHT_COLOR.g, b: EDGE_HIGHLIGHT_COLOR.b,
        duration: 0.5, ease: "power2.out",
      });
    } else {
      gsap.to(line.material.color, {
        r: EDGE_DEFAULT_COLOR.r, g: EDGE_DEFAULT_COLOR.g, b: EDGE_DEFAULT_COLOR.b,
        duration: 0.5, ease: "power2.out",
      });
    }
  });

  const pathPositions = pathIds.map(id => nodeMeshes[id]?.position).filter(Boolean);
  if (pathPositions.length > 0) {
    const box = new THREE.Box3();
    pathPositions.forEach(p => box.expandByPoint(p));
    const center = new THREE.Vector3();
    box.getCenter(center);
    controls.moveTo(center.x, center.y, 0, true);
  }

  document.getElementById("reset-btn").classList.add("visible");
  updateModelButtons();
}

function resetHighlight() {
  if (isInsideNode) exitInside();
  removeBall();
  activeModel = null;
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";

  Object.entries(nodeMeshes).forEach(([id, mesh]) => {
    const base = mesh.userData.baseColor;
    gsap.to(mesh.material, { opacity: 0.92, duration: 0.4, ease: "power2.out" });
    gsap.to(mesh.material.color, { r: base.r, g: base.g, b: base.b, duration: 0.4, ease: "power2.out" });

    const border = nodeBorders[id];
    if (border) {
      const dim = base.clone().multiplyScalar(0.5);
      gsap.to(border.material, { opacity: 0.5, duration: 0.4 });
      gsap.to(border.material.color, { r: dim.r, g: dim.g, b: dim.b, duration: 0.4 });
    }

    const label = nodeLabels[id];
    if (label) label.classList.remove("highlighted", "dimmed");
    const tag = nodeTags[id];
    if (tag) tag.classList.remove("highlighted", "dimmed");
  });

  edgeLines.forEach(line => {
    const isDepend = line.userData.type === "dependency";
    const defColor = isDepend ? new THREE.Color(0x3a3535) : EDGE_DEFAULT_COLOR;
    const defOp = isDepend ? EDGE_DEFAULT_OPACITY * 0.5 : EDGE_DEFAULT_OPACITY;
    gsap.to(line.material, { opacity: defOp, duration: 0.4, ease: "power2.out" });
    gsap.to(line.material.color, { r: defColor.r, g: defColor.g, b: defColor.b, duration: 0.4, ease: "power2.out" });
  });

  document.getElementById("reset-btn").classList.remove("visible");
  closeNodeDetail();
  updateModelButtons();
}

// ─── Raycasting ───
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById("tooltip");
const infoPanelEl = document.getElementById("info-panel");

function clearHoverState() {
  if (hoveredNode && nodeMeshes[hoveredNode]) {
    gsap.to(nodeMeshes[hoveredNode].scale, { x: 1, y: 1, duration: 0.2 });
  }
  hoveredNode = null;
  hideTooltip();
  if (renderer) renderer.domElement.style.cursor = "default";
}

function onPointerMove(event) {
  if (isInsideNode) {
    if (hoveredNode) clearHoverState();
    return;
  }

  const rect = renderer.domElement.getBoundingClientRect();
  const cx = event.clientX, cy = event.clientY;

  if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) {
    if (hoveredNode) clearHoverState();
    return;
  }

  mouse.x = ((cx - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((cy - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(Object.values(nodeMeshes));

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const nodeId = hit.userData.nodeId;
    if (nodeId !== hoveredNode) {
      if (hoveredNode && nodeMeshes[hoveredNode]) {
        gsap.to(nodeMeshes[hoveredNode].scale, { x: 1, y: 1, duration: 0.2 });
      }
      hoveredNode = nodeId;
      gsap.to(hit.scale, { x: 1.06, y: 1.06, duration: 0.2, ease: "power2.out" });
      showTooltip(cx, cy, nodeMap[nodeId]);
      showInfoPanel(nodeMap[nodeId]);
      renderer.domElement.style.cursor = "pointer";
    } else {
      moveTooltip(cx, cy);
    }
  } else if (hoveredNode) {
    clearHoverState();
  }
}

function onClick(event) {
  if (event.target.closest("#sidebar") || event.target.closest("#reset-btn") || event.target.closest("#zoom-controls") || event.target.closest("#bottom-bar") || event.target.closest("#call-stack") || event.target.closest("#node-detail") || event.target.closest("#btn-back-inside") || event.target.closest("#explain-panel")) return;

  if (isInsideNode) return;

  if (overviewActive && onOverviewZoneClick(event)) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(Object.values(nodeMeshes));

  if (intersects.length > 0) {
    const nodeId = intersects[0].object.userData.nodeId;
    const nd = nodeMap[nodeId];
    const model = findModelForNode(nodeId);
    if (model) highlightPath(model);
    showInfoPanel(nd);
    showNodeDetail(nd);
  } else {
    if (activeModel) resetHighlight();
    closeNodeDetail();
    clearInfoPanel();
  }
}

function findModelForNode(nodeId) {
  for (const [model, ids] of Object.entries(modelPaths)) {
    if (ids.includes(nodeId)) return model;
  }
  return null;
}

// ─── Tooltip ───
function showTooltip(x, y, nd) {
  tooltip.innerHTML = `<div class="tt-label">${nd.label}</div><div class="tt-file">${nd.file}</div>`;
  tooltip.classList.add("visible");
  moveTooltip(x, y);
}

function moveTooltip(x, y) {
  const pad = 14;
  const tw = tooltip.offsetWidth || 200;
  const th = tooltip.offsetHeight || 50;
  let l = x + pad, t = y + pad;
  if (l + tw > window.innerWidth - 10) l = x - tw - pad;
  if (t + th > window.innerHeight - 10) t = y - th - pad;
  tooltip.style.left = `${l}px`;
  tooltip.style.top = `${t}px`;
}

function hideTooltip() { tooltip.classList.remove("visible"); }

// ─── Info Panel ───
function showInfoPanel(nd) {
  infoPanelEl.innerHTML = `
    <h3>Node Details</h3>
    <div class="info-label">${nd.label}</div>
    <div class="info-file">${nd.file}</div>
    <div class="info-desc">${nd.description}</div>`;
}

function showNodeDetail(nd) {
  const layerHex = "#" + new THREE.Color(LAYER_COLORS[nd.layer]).getHexString();
  const layerName = LAYER_LABELS[nd.layer] || nd.layer;

  const upstream = edges
    .filter(e => e.target === nd.id && e.type === "data-flow")
    .map(e => nodeMap[e.source]?.label)
    .filter(Boolean);
  const downstream = edges
    .filter(e => e.source === nd.id && e.type === "data-flow")
    .map(e => nodeMap[e.target]?.label)
    .filter(Boolean);

  const usedBy = Object.entries(modelPaths)
    .filter(([, ids]) => ids.includes(nd.id))
    .map(([name]) => name);

  let html = `<div class="nd-label">${nd.label}</div>`;
  html += `<div class="nd-badge" style="background:${layerHex}22;color:${layerHex};border:1px solid ${layerHex}55">${layerName}</div>`;
  html += `<div class="nd-file">${nd.file}</div>`;
  html += `<div class="nd-desc">${nd.description}</div>`;

  if (upstream.length > 0) {
    html += `<div class="nd-divider"></div>`;
    html += `<div class="nd-section-title">← Receives from</div>`;
    html += `<div class="nd-conn-list">${upstream.map(u => `<span class="nd-conn-tag">${u}</span>`).join("")}</div>`;
  }
  if (downstream.length > 0) {
    if (upstream.length === 0) html += `<div class="nd-divider"></div>`;
    html += `<div class="nd-section-title">→ Sends to</div>`;
    html += `<div class="nd-conn-list">${downstream.map(d => `<span class="nd-conn-tag">${d}</span>`).join("")}</div>`;
  }
  if (usedBy.length > 0) {
    html += `<div class="nd-divider"></div>`;
    html += `<div class="nd-section-title">Model paths</div>`;
    html += `<div class="nd-models-list">${usedBy.map(m => `<span class="nd-model-tag">${m}</span>`).join("")}</div>`;
  }

  if (nd.internals && nd.internals.length > 0) {
    html += `<div class="nd-divider"></div>`;
    html += `<button class="nd-explore-btn" data-node-id="${nd.id}">Explore Inside</button>`;
  }

  const content = document.getElementById("node-detail-content");
  const panel = document.getElementById("node-detail");
  if (content) content.innerHTML = html;
  if (panel) panel.classList.add("visible");
}

const INTERNAL_TYPE_COLORS = {
  entry: 0x22c55e, step: 0x3b82f6, call: 0xd3904b,
  await: 0xa855f7, return: 0xef4444, validate: 0x06b6d4, branch: 0xeab308,
};
const INTERNAL_TYPE_HEX = {
  entry: "#22c55e", step: "#3b82f6", call: "#d3904b",
  await: "#a855f7", return: "#ef4444", validate: "#06b6d4", branch: "#eab308",
};
const NI_STEP_W = 28;
const NI_STEP_H = 5;
const NI_GAP_Y = 3.5;
const NI_CONNECTOR_H = 2;

let insideToken = null;
let insideStepPositions = [];
let insideStepMeshes = [];
let insideStepBorders = [];
let insideAnimating = false;

function createInsideToken() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xd3904b, transparent: true, opacity: 0 })
  );
  group.add(core);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: generateGlowTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending })
  );
  glow.scale.set(5, 5, 1);
  group.add(glow);
  group.position.z = 0.5;
  return group;
}

let activeInsideWaitTimer = null;
let activeInsideWaitResolve = null;

function insideWait(ms) {
  return new Promise(resolve => {
    activeInsideWaitResolve = resolve;
    activeInsideWaitTimer = setTimeout(() => {
      activeInsideWaitTimer = null;
      activeInsideWaitResolve = null;
      resolve();
    }, ms);
  });
}

function cancelInsideWait() {
  if (activeInsideWaitTimer) { clearTimeout(activeInsideWaitTimer); activeInsideWaitTimer = null; }
  if (activeInsideWaitResolve) { activeInsideWaitResolve(); activeInsideWaitResolve = null; }
}

function cancelInsideTokenTween() {
  if (activeInsideTokenTween) { activeInsideTokenTween.kill(); activeInsideTokenTween = null; }
  if (activeInsideTokenResolve) { activeInsideTokenResolve(); activeInsideTokenResolve = null; }
}

function transitionWait(ms) {
  return new Promise(resolve => {
    transitionResolve = resolve;
    transitionTimer = setTimeout(() => {
      transitionTimer = null;
      transitionResolve = null;
      resolve();
    }, ms);
  });
}

function cancelTransition() {
  isTransitioning = false;
  if (transitionTimer) { clearTimeout(transitionTimer); transitionTimer = null; }
  if (transitionResolve) { transitionResolve(); transitionResolve = null; }
}

async function animateInsideToken(cx, stepYs, stepMeshes, stepBorders) {
  if (!insideToken || !isInsideNode) return;
  insideAnimating = true;

  const core = insideToken.children[0];
  const glow = insideToken.children[1];
  insideToken.position.set(cx, stepYs[0], 0.5);

  gsap.to(core.material, { opacity: 0.95, duration: 0.4 });
  gsap.to(glow.material, { opacity: 0.7, duration: 0.4 });

  for (let i = 0; i < stepYs.length; i++) {
    if (!isInsideNode || !insideToken) return;

    if (stepMeshes[i]) {
      gsap.to(stepMeshes[i].material, { opacity: 1, duration: 0.2 });
      gsap.to(stepMeshes[i].material.color, { r: 0.14, g: 0.14, b: 0.14, duration: 0.2 });
    }
    if (stepBorders[i]) {
      gsap.to(stepBorders[i].material, { opacity: 1, duration: 0.2 });
    }

    controls.moveTo(cx, stepYs[i], 0, true);

    await insideWait(800);
    if (!isInsideNode || !insideToken) return;

    if (stepMeshes[i]) {
      gsap.to(stepMeshes[i].material, { opacity: 0.85, duration: 0.5 });
    }
    if (stepBorders[i]) {
      gsap.to(stepBorders[i].material, { opacity: 0.7, duration: 0.5 });
    }

    if (i < stepYs.length - 1) {
      const fromY = stepYs[i];
      const toY = stepYs[i + 1];
      const travelDuration = 0.5;
      await new Promise(resolve => {
        gsap.to(insideToken.position, {
          y: toY,
          duration: travelDuration,
          ease: "power2.inOut",
          onComplete: resolve,
        });
      });
      if (!isInsideNode || !insideToken) return;
    }
  }

  await insideWait(600);
  if (!isInsideNode || !insideToken) return;

  gsap.to(core.material, { opacity: 0, duration: 0.6 });
  gsap.to(glow.material, { opacity: 0, duration: 0.6 });
  insideAnimating = false;
}

function disposeInsideObjects(objects) {
  objects.forEach(obj => {
    if (obj.isGroup) {
      gsap.killTweensOf(obj.position);
      obj.children.forEach(c => {
        if (c.material) { gsap.killTweensOf(c.material); c.material.opacity = 0; c.material.dispose(); }
        if (c.geometry) c.geometry.dispose();
      });
      scene.remove(obj);
    } else if (obj.material) {
      obj.material.opacity = 0;
      gsap.killTweensOf(obj.material);
      if (obj.geometry) obj.geometry.dispose();
      obj.material.dispose();
      scene.remove(obj);
    } else if (obj.element) {
      gsap.killTweensOf(obj.element.style);
      obj.element.style.opacity = "0";
      scene.remove(obj);
    } else {
      scene.remove(obj);
    }
  });
}

function dimMainGraph(duration) {
  Object.keys(nodeMeshes).forEach(id => {
    gsap.to(nodeMeshes[id].material, { opacity: 0.03, duration });
    if (nodeBorders[id]) gsap.to(nodeBorders[id].material, { opacity: 0.03, duration });
  });
  edgeLines.forEach(l => gsap.to(l.material, { opacity: 0.02, duration }));
  Object.values(nodeLabels).forEach(el => { gsap.killTweensOf(el.style); el.style.opacity = "0"; });
  Object.values(nodeTags).forEach(el => { gsap.killTweensOf(el.style); el.style.opacity = "0"; });
}

function buildInsideObjects(nd, nodePos, fadeDelay) {
  insideStepPositions = [];
  insideStepMeshes = [];
  insideStepBorders = [];
  insideObjects = [];

  const cx = nodePos.x;
  const steps = nd.internals;
  const startY = nodePos.y + NI_STEP_H;
  const totalH = steps.length * NI_STEP_H + (steps.length - 1) * (NI_GAP_Y + NI_CONNECTOR_H);
  const topY = startY + totalH / 2;

  steps.forEach((step, i) => {
    const y = topY - i * (NI_STEP_H + NI_GAP_Y + NI_CONNECTOR_H) - NI_STEP_H / 2;
    const typeColor = INTERNAL_TYPE_COLORS[step.type] || 0x666666;
    const typeHex = INTERNAL_TYPE_HEX[step.type] || "#666";
    insideStepPositions.push(y);

    const shape = createRoundedRectShape(NI_STEP_W, NI_STEP_H, 0.8);
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, y, 0);
    scene.add(mesh);
    insideStepMeshes.push(mesh);

    const borderGeo = new THREE.BufferGeometry().setFromPoints(createRoundedRectOutline(NI_STEP_W, NI_STEP_H, 0.8, 4));
    const borderMat = new THREE.LineBasicMaterial({ color: typeColor, transparent: true, opacity: 0, linewidth: 1 });
    const border = new THREE.LineLoop(borderGeo, borderMat);
    border.position.set(cx, y, 0.01);
    scene.add(border);
    insideStepBorders.push(border);

    const accentGeo = new THREE.PlaneGeometry(0.6, NI_STEP_H - 1);
    const accentMat = new THREE.MeshBasicMaterial({ color: typeColor, transparent: true, opacity: 0 });
    const accent = new THREE.Mesh(accentGeo, accentMat);
    accent.position.set(cx - NI_STEP_W / 2 + 0.5, y, 0.02);
    scene.add(accent);

    const labelDiv = document.createElement("div");
    labelDiv.className = "ni-scene-label";
    labelDiv.innerHTML = `<span class="ni-scene-type" style="color:${typeHex}">${step.type}</span> `
      + `<span class="ni-scene-name">${step.name}</span>`
      + `<br><span class="ni-scene-desc">${step.desc}</span>`;
    labelDiv.style.opacity = "0";
    const labelObj = new CSS2DObject(labelDiv);
    labelObj.position.set(cx + 0.8, y, 0.1);
    scene.add(labelObj);

    insideObjects.push(mesh, border, accent, labelObj);

    const d = fadeDelay + i * 0.04;
    gsap.to(mat, { opacity: 0.85, duration: 0.4, delay: d });
    gsap.to(borderMat, { opacity: 0.7, duration: 0.4, delay: d });
    gsap.to(accentMat, { opacity: 0.8, duration: 0.4, delay: d });
    gsap.to(labelDiv.style, { opacity: 1, duration: 0.3, delay: d + 0.1 });

    if (i < steps.length - 1) {
      const connTopY = y - NI_STEP_H / 2 - 0.3;
      const connBotY = y - NI_STEP_H / 2 - NI_GAP_Y - NI_CONNECTOR_H + 0.3;
      const pts = [new THREE.Vector3(cx, connTopY, 0.01), new THREE.Vector3(cx, connBotY, 0.01)];
      const connGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const connMat = new THREE.LineDashedMaterial({ color: 0x555555, transparent: true, opacity: 0, dashSize: 0.5, gapSize: 0.3 });
      const conn = new THREE.Line(connGeo, connMat);
      conn.computeLineDistances();
      scene.add(conn);
      insideObjects.push(conn);
      gsap.to(connMat, { opacity: 0.5, duration: 0.3, delay: d + 0.1 });

      const arrowGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx - 0.5, connBotY + 0.8, 0.01),
        new THREE.Vector3(cx, connBotY, 0.01),
        new THREE.Vector3(cx + 0.5, connBotY + 0.8, 0.01),
      ]);
      const arrowMat = new THREE.LineBasicMaterial({ color: 0x555555, transparent: true, opacity: 0 });
      const arrow = new THREE.Line(arrowGeo, arrowMat);
      scene.add(arrow);
      insideObjects.push(arrow);
      gsap.to(arrowMat, { opacity: 0.5, duration: 0.3, delay: d + 0.1 });
    }
  });

  const headerDiv = document.createElement("div");
  headerDiv.className = "ni-scene-header";
  headerDiv.innerHTML = `<span class="ni-scene-header-name">${nd.label}</span><br><span class="ni-scene-header-file">${nd.file}</span>`;
  headerDiv.style.opacity = "0";
  const headerObj = new CSS2DObject(headerDiv);
  headerObj.position.set(cx, topY + NI_STEP_H / 2 + 3, 0.1);
  scene.add(headerObj);
  insideObjects.push(headerObj);
  gsap.to(headerDiv.style, { opacity: 1, duration: 0.4, delay: fadeDelay });

  const targetZoom = Math.min(4.5, 160 / totalH);
  return { cx, topY, totalH, targetZoom };
}

function enterNodeManual(nodeId, startStep) {
  const nd = nodeMap[nodeId];
  if (!nd || !nd.internals || !nd.internals.length) return false;
  const nodePos = layoutPositions[nodeId];
  if (!nodePos) return false;

  isInsideNode = true;
  insideNodeId = nodeId;

  manualInsideActive = true;
  manualInsidePrevZoom = camera.zoom;
  manualInsideNodePos = nodePos;

  dimMainGraph(0.3);
  const exploredMesh = nodeMeshes[nodeId];
  if (exploredMesh) {
    gsap.killTweensOf(exploredMesh.material);
    exploredMesh.material.opacity = 0;
  }
  const exploredBorder = nodeBorders[nodeId];
  if (exploredBorder) {
    gsap.killTweensOf(exploredBorder.material);
    exploredBorder.material.opacity = 0;
  }
  if (ballGroup) ballGroup.visible = false;

  const info = buildInsideObjects(nd, nodePos, 0.1);
  manualInsideCx = info.cx;

  insideToken = createInsideToken();
  scene.add(insideToken);
  insideObjects.push(insideToken);
  insideToken.children[0].material.opacity = 0.95;
  insideToken.children[1].material.opacity = 0.7;

  const idx = typeof startStep === "number" ? startStep : 0;
  const targetY = insideStepPositions[idx] || insideStepPositions[0] || info.topY;
  insideToken.position.set(info.cx, targetY, 0.5);
  controls.moveTo(info.cx, targetY, 0, true);
  controls.zoomTo(info.targetZoom, true);

  highlightInsideStep(idx);
  return true;
}

function highlightInsideStep(idx) {
  manualInsideStepIdx = idx;
  insideStepMeshes.forEach((mesh, i) => {
    if (!mesh) return;
    gsap.to(mesh.material, { opacity: i === idx ? 1.0 : 0.4, duration: 0.2 });
  });
  insideStepBorders.forEach((border, i) => {
    if (!border) return;
    gsap.to(border.material, { opacity: i === idx ? 1.0 : 0.3, duration: 0.2 });
  });
  if (insideToken && insideStepPositions[idx] !== undefined) {
    gsap.to(insideToken.position, {
      x: manualInsideCx, y: insideStepPositions[idx],
      duration: 0.3, ease: "power2.inOut",
    });
  }
  if (insideStepPositions[idx] !== undefined) {
    controls.moveTo(manualInsideCx, insideStepPositions[idx], 0, true);
  }
}

function exitNodeManual() {
  if (!manualInsideActive) return;
  const zoom = manualInsidePrevZoom || camera.zoom;
  const pos = manualInsideNodePos;

  disposeInsideObjects(insideObjects);
  insideObjects = [];
  insideToken = null;
  insideStepPositions = [];
  insideStepMeshes = [];
  insideStepBorders = [];
  isInsideNode = false;
  insideNodeId = null;
  insideAnimating = false;
  autoExplorePrevZoom = null;
  autoExploreNodePos = null;

  restoreMainGraph();

  if (ballGroup) {
    ballGroup.visible = true;
    if (pos) controls.moveTo(pos.x, pos.y, 0, true);
    controls.zoomTo(zoom, true);
  }

  manualInsideActive = false;
  manualInsideStepIdx = -1;
  manualInsidePrevZoom = null;
  manualInsideNodePos = null;
  manualInsideCx = 0;
}

function exploreInside(nd) {
  if (isInsideNode || !nd.internals || !nd.internals.length) return;
  isInsideNode = true;
  insideNodeId = nd.id;
  closeNodeDetail();

  const nodePos = layoutPositions[nd.id];
  if (!nodePos) return;

  savedCameraState = {
    x: controls.getPosition(new THREE.Vector3()).x,
    y: controls.getPosition(new THREE.Vector3()).y,
    zoom: camera.zoom,
  };

  dimMainGraph(0.6);
  const exploredMesh = nodeMeshes[nd.id];
  if (exploredMesh) {
    gsap.killTweensOf(exploredMesh.material);
    exploredMesh.material.opacity = 0;
  }
  const exploredBorder = nodeBorders[nd.id];
  if (exploredBorder) {
    gsap.killTweensOf(exploredBorder.material);
    exploredBorder.material.opacity = 0;
  }
  const info = buildInsideObjects(nd, nodePos, 0.4);

  const firstStepY = insideStepPositions[0] || info.topY;
  controls.moveTo(info.cx, nodePos.y, 0, false);
  controls.zoomTo(camera.zoom, false);
  controls.moveTo(info.cx, firstStepY, 0, true);
  controls.zoomTo(info.targetZoom, true);

  const backBtn = document.getElementById("btn-back-inside");
  if (backBtn) {
    backBtn.classList.add("visible");
    backBtn.dataset.nodeId = nd.id;
  }

  insideToken = createInsideToken();
  scene.add(insideToken);
  insideObjects.push(insideToken);

  const fadeInDelay = 0.5 + nd.internals.length * 0.06 + 0.3;
  setTimeout(() => {
    animateInsideToken(info.cx, insideStepPositions, insideStepMeshes, insideStepBorders);
  }, fadeInDelay * 1000);
}

function exitInside() {
  if (!isInsideNode && insideObjects.length === 0) return;
  isInsideNode = false;

  disposeInsideObjects(insideObjects);
  insideObjects = [];
  insideToken = null;
  insideStepPositions = [];
  insideStepMeshes = [];
  insideStepBorders = [];
  insideAnimating = false;

  restoreMainGraph();

  if (savedCameraState) {
    controls.moveTo(savedCameraState.x, savedCameraState.y, 0, true);
    controls.zoomTo(savedCameraState.zoom, true);
  }

  const backBtn = document.getElementById("btn-back-inside");
  if (backBtn) backBtn.classList.remove("visible");

  insideNodeId = null;
  savedCameraState = null;
}

async function autoExploreNode(nd) {
  if (!nd.internals || !nd.internals.length || !ballGroup) return;
  const nodePos = layoutPositions[nd.id];
  if (!nodePos) return;

  const myId = ++autoExploreId;
  isInsideNode = true;
  insideNodeId = nd.id;

  const prevZoom = camera.zoom;
  autoExplorePrevZoom = prevZoom;
  autoExploreNodePos = nodePos;

  dimMainGraph(0.5);
  const exploredMesh = nodeMeshes[nd.id];
  if (exploredMesh) {
    gsap.killTweensOf(exploredMesh.material);
    exploredMesh.material.opacity = 0;
  }
  const exploredBorder = nodeBorders[nd.id];
  if (exploredBorder) {
    gsap.killTweensOf(exploredBorder.material);
    exploredBorder.material.opacity = 0;
  }
  if (ballGroup) ballGroup.visible = false;

  const info = buildInsideObjects(nd, nodePos, 0.2);
  const cx = info.cx;
  const steps = nd.internals;

  const firstStepY = insideStepPositions[0] || info.topY;
  controls.moveTo(cx, firstStepY, 0, true);
  controls.zoomTo(info.targetZoom, true);

  const token = createInsideToken();
  scene.add(token);
  insideObjects.push(token);
  insideToken = token;

  const fadeInMs = (0.3 + steps.length * 0.04 + 0.3) * 1000;
  await insideWait(fadeInMs);
  if (!isInsideNode || myId !== autoExploreId) return;

  const tCore = token.children[0];
  const tGlow = token.children[1];
  token.position.set(cx, insideStepPositions[0], 0.5);
  gsap.to(tCore.material, { opacity: 0.95, duration: 0.3 });
  gsap.to(tGlow.material, { opacity: 0.7, duration: 0.3 });
  await insideWait(300);
  if (myId !== autoExploreId) return;

  for (let i = 0; i < insideStepPositions.length; i++) {
    autoExploreCurrentStep = i;
    if (!isInsideNode || myId !== autoExploreId) return;
    await waitForResume();
    if (myId !== autoExploreId) return;

    const sy = insideStepPositions[i];
    if (insideStepMeshes[i]) gsap.to(insideStepMeshes[i].material, { opacity: 1, duration: 0.15 });
    if (insideStepBorders[i]) gsap.to(insideStepBorders[i].material, { opacity: 1, duration: 0.15 });
    controls.moveTo(cx, sy, 0, true);

    await insideWait(600 / speedMultiplier);
    if (!isInsideNode || myId !== autoExploreId) return;

    if (insideStepMeshes[i]) gsap.to(insideStepMeshes[i].material, { opacity: 0.85, duration: 0.4 });
    if (insideStepBorders[i]) gsap.to(insideStepBorders[i].material, { opacity: 0.7, duration: 0.4 });

    if (i < insideStepPositions.length - 1) {
      await new Promise(resolve => {
        activeInsideTokenResolve = resolve;
        activeInsideTokenTween = gsap.to(token.position, {
          y: insideStepPositions[i + 1],
          duration: 0.4 / speedMultiplier,
          ease: "power2.inOut",
          onComplete: () => { activeInsideTokenTween = null; activeInsideTokenResolve = null; resolve(); },
        });
      });
      if (myId !== autoExploreId) return;
    }
  }

  await insideWait(300);
  if (!isInsideNode || myId !== autoExploreId) return;
  gsap.to(tCore.material, { opacity: 0, duration: 0.3 });
  gsap.to(tGlow.material, { opacity: 0, duration: 0.3 });
  await insideWait(300);
  if (myId !== autoExploreId) return;

  cleanupAutoExplore(prevZoom, nodePos);
}

function restoreMainGraph() {
  if (activeModel) {
    const pathSet = new Set(modelPaths[activeModel] || []);
    Object.entries(nodeMeshes).forEach(([id, mesh]) => {
      const inPath = pathSet.has(id);
      gsap.to(mesh.material, { opacity: inPath ? 1.0 : DIMMED_OPACITY, duration: 0.4 });
      if (nodeBorders[id]) gsap.to(nodeBorders[id].material, { opacity: inPath ? 0.8 : DIMMED_OPACITY, duration: 0.4 });
    });
    edgeLines.forEach(l => {
      const s = l.userData.source, t = l.userData.target;
      const inPath = pathSet.has(s) && pathSet.has(t);
      gsap.to(l.material, { opacity: inPath ? EDGE_HIGHLIGHT_OPACITY : 0.03, duration: 0.4 });
    });
  } else {
    Object.keys(nodeMeshes).forEach(id => {
      gsap.to(nodeMeshes[id].material, { opacity: 0.92, duration: 0.4 });
      if (nodeBorders[id]) gsap.to(nodeBorders[id].material, { opacity: 0.5, duration: 0.4 });
    });
    edgeLines.forEach(l => gsap.to(l.material, { opacity: EDGE_DEFAULT_OPACITY, duration: 0.4 }));
  }
  Object.values(nodeLabels).forEach(el => gsap.to(el.style, { opacity: 1, duration: 0.4 }));
  Object.values(nodeTags).forEach(el => gsap.to(el.style, { opacity: 1, duration: 0.4 }));
}

function cleanupAutoExplore(prevZoom, nodePos) {
  if (!isInsideNode && insideObjects.length === 0) return;

  disposeInsideObjects(insideObjects);
  insideObjects = [];
  insideToken = null;
  insideStepPositions = [];
  insideStepMeshes = [];
  insideStepBorders = [];
  insideAnimating = false;
  isInsideNode = false;
  insideNodeId = null;
  autoExplorePrevZoom = null;
  autoExploreNodePos = null;

  restoreMainGraph();

  if (ballGroup) {
    ballGroup.visible = true;
    controls.moveTo(nodePos.x, nodePos.y, 0, true);
    controls.zoomTo(prevZoom, true);
  }
}

function closeNodeDetail() {
  const panel = document.getElementById("node-detail");
  if (panel) panel.classList.remove("visible");
}

function clearInfoPanel() {
  infoPanelEl.innerHTML = `<h3>Node Details</h3><div class="info-empty">Hover or click a node to see details</div>`;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildExplainJourneyHtml(nd) {
  const total = forwardPath.length;
  if (total === 0) return "";
  const idx = forwardPath.findIndex(s => s.id === nd.id);
  if (idx < 0) return "";

  const pathTitle = activeModel ? escapeHtml(activeModel) : "this request";
  const stepNum = idx + 1;
  const prevNd = idx > 0 ? nodeMap[forwardPath[idx - 1].id] : null;
  const nextNd = idx < total - 1 ? nodeMap[forwardPath[idx + 1].id] : null;
  const prevLabel = prevNd ? escapeHtml(prevNd.label) : "";
  const nextLabel = nextNd ? escapeHtml(nextNd.label) : "";

  let flow = `<div class="ex-journey-flow">`;
  if (prevNd) {
    flow += `<span class="ex-journey-chip ex-journey-chip--prev" title="Previous in this path">${prevLabel}</span>`;
    flow += `<span class="ex-journey-arrow" aria-hidden="true">→</span>`;
  }
  flow += `<span class="ex-journey-chip ex-journey-chip--here">${escapeHtml(nd.label)}</span>`;
  if (nextNd) {
    flow += `<span class="ex-journey-arrow" aria-hidden="true">→</span>`;
    flow += `<span class="ex-journey-chip ex-journey-chip--next" title="Next in this path">${nextLabel}</span>`;
  }
  flow += `</div>`;

  return `
    <div class="ex-journey">
      <div class="ex-section-title">Where you are in the path</div>
      <div class="ex-journey-meta">Step ${stepNum} of ${total} · <span class="ex-journey-path">${pathTitle}</span></div>
      ${flow}
    </div>
    <div class="ex-divider"></div>`;
}

// ─── Explain Panel ───
function openExplainPanel() {
  if (!isAnimating || !currentAnimNodeId) return;
  const nd = nodeMap[currentAnimNodeId];
  if (!nd) return;

  if (!isPaused) togglePause();

  const panel = document.getElementById("explain-panel");
  const content = document.getElementById("explain-content");
  if (!panel || !content) return;

  const layerHex = "#" + new THREE.Color(LAYER_COLORS[nd.layer]).getHexString();
  const layerName = LAYER_LABELS[nd.layer] || nd.layer;

  const upstream = edges
    .filter(e => e.target === nd.id && e.type === "data-flow")
    .map(e => nodeMap[e.source]?.label)
    .filter(Boolean);
  const downstream = edges
    .filter(e => e.source === nd.id && e.type === "data-flow")
    .map(e => nodeMap[e.target]?.label)
    .filter(Boolean);

  let html = `<div class="ex-label">${escapeHtml(nd.label)}</div>`;
  html += `<div class="ex-badge" style="background:${layerHex}22;color:${layerHex};border:1px solid ${layerHex}55">${escapeHtml(layerName)}</div>`;
  html += buildExplainJourneyHtml(nd);

  if (nd.func) {
    html += `<div class="ex-section-title">Primary entry / hook</div>`;
    html += `<div class="ex-func-line">${escapeHtml(nd.func)}</div>`;
  }

  html += `<div class="ex-section-title">Source</div>`;
  html += `<div class="ex-file">${escapeHtml(nd.file)}</div>`;
  html += `<div class="ex-section-title">What it does</div>`;
  html += `<div class="ex-desc">${escapeHtml(nd.description)}</div>`;

  if (nd.explainFocus) {
    html += `<div class="ex-divider"></div>`;
    html += `<div class="ex-section-title">In this request</div>`;
    html += `<div class="ex-focus">${escapeHtml(nd.explainFocus)}</div>`;
  }
  if (nd.whenItFails) {
    html += `<div class="ex-divider"></div>`;
    html += `<div class="ex-section-title">When things go wrong</div>`;
    html += `<div class="ex-fail">${escapeHtml(nd.whenItFails)}</div>`;
  }

  if (upstream.length > 0) {
    html += `<div class="ex-divider"></div>`;
    html += `<div class="ex-section-title">← Receives from (graph)</div>`;
    html += `<div class="ex-conn-list">${upstream.map(u => `<span class="ex-conn-tag">${escapeHtml(u)}</span>`).join("")}</div>`;
  }
  if (downstream.length > 0) {
    html += `<div class="ex-divider"></div>`;
    html += `<div class="ex-section-title">→ Sends to (graph)</div>`;
    html += `<div class="ex-conn-list">${downstream.map(d => `<span class="ex-conn-tag">${escapeHtml(d)}</span>`).join("")}</div>`;
  }

  if (nd.internals && nd.internals.length > 0) {
    html += `<div class="ex-divider"></div>`;
    html += `<div class="ex-section-title">Internal flow (code-level)</div>`;
    html += `<div class="ex-steps">`;
    nd.internals.forEach((s, i) => {
      html += `<div class="ex-step">`;
      html += `<span class="ex-step-num">${i + 1}</span>`;
      html += `<div class="ex-step-body">`;
      html += `<div class="ex-step-header"><span class="ex-step-type ex-step-type--${s.type}">${escapeHtml(s.type)}</span> <span class="ex-step-name">${escapeHtml(s.name)}</span></div>`;
      html += `<div class="ex-step-desc">${escapeHtml(s.desc)}</div>`;
      html += `</div></div>`;
    });
    html += `</div>`;
  }

  if (nd.relatedFiles && nd.relatedFiles.length > 0) {
    html += `<div class="ex-divider"></div>`;
    html += `<div class="ex-section-title">Also see</div>`;
    html += `<div class="ex-related-list">${nd.relatedFiles.map(f => `<span class="ex-related-chip">${escapeHtml(f)}</span>`).join("")}</div>`;
  }

  content.innerHTML = html;
  panel.classList.add("visible");
}

function closeExplainPanel() {
  const panel = document.getElementById("explain-panel");
  if (panel) panel.classList.remove("visible");
}

// ─── Overview Mode ───
const ZONE_PAD_X = 14;
const ZONE_PAD_Y = 10;
const ZONE_RADIUS = 3;
const ZONE_Z = -0.2;

function buildOverviewZones() {
  const layerNodes = {};
  LAYER_ORDER.forEach(l => { layerNodes[l] = []; });
  nodes.forEach(n => {
    if (layerNodes[n.layer]) layerNodes[n.layer].push(n);
  });

  LAYER_ORDER.forEach(layer => {
    const group = layerNodes[layer];
    if (group.length === 0) return;

    const xs = group.map(n => layoutPositions[n.id]?.x ?? 0);
    const ys = group.map(n => layoutPositions[n.id]?.y ?? 0);
    const ws = group.map(n => nodeWidths[n.id] || MIN_NODE_WIDTH);

    const minX = Math.min(...xs.map((x, i) => x - ws[i] / 2)) - ZONE_PAD_X;
    const maxX = Math.max(...xs.map((x, i) => x + ws[i] / 2)) + ZONE_PAD_X;
    const minY = Math.min(...ys) - NODE_HEIGHT / 2 - TAG_OFFSET_Y - ZONE_PAD_Y;
    const maxY = Math.max(...ys) + NODE_HEIGHT / 2 + TAG_OFFSET_Y + ZONE_PAD_Y;

    const zoneW = maxX - minX;
    const zoneH = maxY - minY;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const color = new THREE.Color(LAYER_COLORS[layer]);
    const fillShape = createRoundedRectShape(zoneW, zoneH, ZONE_RADIUS);
    const fillGeo = new THREE.ShapeGeometry(fillShape);
    const fillMat = new THREE.MeshBasicMaterial({
      color: color.clone().multiplyScalar(0.2),
      transparent: true,
      opacity: 0,
    });
    const zoneMesh = new THREE.Mesh(fillGeo, fillMat);
    zoneMesh.position.set(cx, cy, ZONE_Z);
    zoneMesh.userData = { layerId: layer, isOverviewZone: true };
    scene.add(zoneMesh);

    const borderPts = createRoundedRectOutline(zoneW, zoneH, ZONE_RADIUS, 8);
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
    const borderMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
    });
    const borderLine = new THREE.Line(borderGeo, borderMat);
    zoneMesh.add(borderLine);

    const labelDiv = document.createElement("div");
    labelDiv.className = "overview-zone-label";
    const layerLabel = LAYER_LABELS[layer] || layer;
    const layerDesc = LAYER_DESCRIPTIONS[layer] || "";
    labelDiv.innerHTML =
      `<div class="overview-zone-title">${layerLabel}</div>`
      + `<div class="overview-zone-count">${group.length} node${group.length > 1 ? "s" : ""}</div>`
      + `<div class="overview-zone-desc">${layerDesc}</div>`;
    labelDiv.style.opacity = "0";
    const labelObj = new CSS2DObject(labelDiv);
    labelObj.position.set(0, 0, 0.1);
    zoneMesh.add(labelObj);

    overviewZoneMeshes[layer] = {
      mesh: zoneMesh,
      border: borderLine,
      labelDiv,
      labelObj,
      cx, cy, zoneW, zoneH,
      nodeIds: group.map(n => n.id),
    };
  });

  buildZoneEdges();
}

function buildZoneEdges() {
  const layerOfNode = {};
  nodes.forEach(n => { layerOfNode[n.id] = n.layer; });

  const zoneEdgeSet = new Set();
  edges.forEach(e => {
    const srcLayer = layerOfNode[e.source];
    const tgtLayer = layerOfNode[e.target];
    if (!srcLayer || !tgtLayer || srcLayer === tgtLayer) return;
    const key = `${srcLayer}->${tgtLayer}`;
    zoneEdgeSet.add(key);
  });

  zoneEdgeSet.forEach(key => {
    const [srcLayer, tgtLayer] = key.split("->");
    const srcZone = overviewZoneMeshes[srcLayer];
    const tgtZone = overviewZoneMeshes[tgtLayer];
    if (!srcZone || !tgtZone) return;

    const sx = srcZone.cx;
    const sy = srcZone.cy - srcZone.zoneH / 2;
    const ex = tgtZone.cx;
    const ey = tgtZone.cy + tgtZone.zoneH / 2;
    const cpx = (sx + ex) / 2;
    const cpy = (sy + ey) / 2;

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sx, sy, ZONE_Z + 0.01),
      new THREE.Vector3(cpx, cpy, ZONE_Z + 0.01),
      new THREE.Vector3(ex, ey, ZONE_Z + 0.01)
    );
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
    const mat = new THREE.LineBasicMaterial({
      color: EDGE_DEFAULT_COLOR,
      transparent: true,
      opacity: 0,
      linewidth: 2,
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    overviewZoneEdges.push(line);
  });
}

function setOverviewObjectsOpacity(targetOpacity, duration) {
  Object.values(overviewZoneMeshes).forEach(z => {
    gsap.to(z.mesh.material, { opacity: targetOpacity * 0.35, duration });
    gsap.to(z.border.material, { opacity: targetOpacity * 0.5, duration });
    gsap.to(z.labelDiv.style, { opacity: targetOpacity, duration });
  });
  overviewZoneEdges.forEach(line => {
    gsap.to(line.material, { opacity: targetOpacity * 0.4, duration });
  });
}

function setDetailObjectsOpacity(targetOpacity, duration) {
  Object.entries(nodeMeshes).forEach(([id, mesh]) => {
    if (expandedLayers.has(nodeMap[id]?.layer)) return;
    gsap.to(mesh.material, { opacity: targetOpacity * 0.92, duration });
    const border = nodeBorders[id];
    if (border) gsap.to(border.material, { opacity: targetOpacity * 0.5, duration });
  });
  edgeLines.forEach(line => {
    const srcLayer = nodeMap[line.userData.source]?.layer;
    const tgtLayer = nodeMap[line.userData.target]?.layer;
    if (expandedLayers.has(srcLayer) || expandedLayers.has(tgtLayer)) return;
    gsap.to(line.material, { opacity: targetOpacity * EDGE_DEFAULT_OPACITY, duration });
  });
  Object.entries(nodeLabels).forEach(([id, el]) => {
    if (expandedLayers.has(nodeMap[id]?.layer)) return;
    gsap.to(el.style, { opacity: targetOpacity, duration });
  });
  Object.entries(nodeTags).forEach(([id, el]) => {
    if (expandedLayers.has(nodeMap[id]?.layer)) return;
    gsap.to(el.style, { opacity: targetOpacity, duration });
  });
}

function hideExpandedLayerZone(layer, duration) {
  const z = overviewZoneMeshes[layer];
  if (!z) return;
  gsap.to(z.mesh.material, { opacity: 0, duration });
  gsap.to(z.border.material, { opacity: 0, duration });
  gsap.to(z.labelDiv.style, { opacity: 0, duration });
}

function showExpandedLayerNodes(layer, duration) {
  const z = overviewZoneMeshes[layer];
  if (!z) return;
  z.nodeIds.forEach(id => {
    const mesh = nodeMeshes[id];
    if (mesh) gsap.to(mesh.material, { opacity: 0.92, duration });
    const border = nodeBorders[id];
    if (border) gsap.to(border.material, { opacity: 0.5, duration });
    const label = nodeLabels[id];
    if (label) gsap.to(label.style, { opacity: 1, duration });
    const tag = nodeTags[id];
    if (tag) gsap.to(tag.style, { opacity: 1, duration });
  });
  edgeLines.forEach(line => {
    const srcLayer = nodeMap[line.userData.source]?.layer;
    const tgtLayer = nodeMap[line.userData.target]?.layer;
    if (srcLayer === layer && tgtLayer === layer) {
      gsap.to(line.material, { opacity: EDGE_DEFAULT_OPACITY, duration });
    }
  });
}

function collapseLayerNodes(layer, duration) {
  const z = overviewZoneMeshes[layer];
  if (!z) return;
  z.nodeIds.forEach(id => {
    const mesh = nodeMeshes[id];
    if (mesh) gsap.to(mesh.material, { opacity: 0, duration });
    const border = nodeBorders[id];
    if (border) gsap.to(border.material, { opacity: 0, duration });
    const label = nodeLabels[id];
    if (label) gsap.to(label.style, { opacity: 0, duration });
    const tag = nodeTags[id];
    if (tag) gsap.to(tag.style, { opacity: 0, duration });
  });
  edgeLines.forEach(line => {
    const srcLayer = nodeMap[line.userData.source]?.layer;
    const tgtLayer = nodeMap[line.userData.target]?.layer;
    if (srcLayer === layer || tgtLayer === layer) {
      if (!(expandedLayers.has(srcLayer) && expandedLayers.has(tgtLayer))) {
        gsap.to(line.material, { opacity: 0, duration });
      }
    }
  });

  gsap.to(z.mesh.material, { opacity: 0.35, duration });
  gsap.to(z.border.material, { opacity: 0.5, duration });
  gsap.to(z.labelDiv.style, { opacity: 1, duration });
}

function toggleOverview() {
  if (isInsideNode || isAnimating) return;

  overviewActive = !overviewActive;
  expandedLayers.clear();
  const duration = 0.5;

  if (overviewActive) {
    setDetailObjectsOpacity(0, duration);
    setOverviewObjectsOpacity(1, duration);
  } else {
    setOverviewObjectsOpacity(0, duration);
    setDetailObjectsOpacity(1, duration);
  }

  updateOverviewToggleButton();
  saveOverviewPreference();
}

function expandLayer(layer) {
  if (!overviewActive) return;

  if (expandedLayers.has(layer)) {
    expandedLayers.delete(layer);
    collapseLayerNodes(layer, 0.35);
  } else {
    expandedLayers.add(layer);
    hideExpandedLayerZone(layer, 0.35);
    showExpandedLayerNodes(layer, 0.35);
  }
}

function exitOverviewForAction() {
  if (!overviewActive) return;
  overviewActive = false;
  expandedLayers.clear();
  setOverviewObjectsOpacity(0, 0.35);
  setDetailObjectsOpacity(1, 0.35);
  updateOverviewToggleButton();
}

function updateOverviewToggleButton() {
  const btn = document.getElementById("overview-toggle");
  if (!btn) return;
  btn.classList.toggle("active", overviewActive);
  btn.title = overviewActive ? "Switch to Detail View" : "Toggle Layer Overview";
}

function saveOverviewPreference() {
  try { localStorage.setItem("cfv-overview-mode", overviewActive ? "1" : "0"); } catch {}
}

function loadOverviewPreference() {
  try {
    const val = localStorage.getItem("cfv-overview-mode");
    if (val === null) return true;
    return val === "1";
  } catch { return true; }
}

function onOverviewZoneClick(event) {
  if (!overviewActive || isInsideNode) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
  const zoneMeshArray = Object.values(overviewZoneMeshes).map(z => z.mesh);
  const hits = raycaster.intersectObjects(zoneMeshArray);
  if (hits.length > 0) {
    const layerId = hits[0].object.userData.layerId;
    if (layerId) {
      event.stopPropagation();
      expandLayer(layerId);
      return true;
    }
  }
  return false;
}

// ─── Sidebar ───
function setupSidebar() {
  const mc = document.getElementById("model-buttons");
  Object.keys(modelPaths).forEach(model => {
    const row = document.createElement("div");
    row.className = "model-row";

    const btn = document.createElement("button");
    btn.className = "model-btn";
    btn.textContent = model;
    btn.addEventListener("click", () => {
      activeModel === model ? resetHighlight() : highlightPath(model);
    });
    row.appendChild(btn);

    const sendBtn = document.createElement("button");
    sendBtn.className = "send-req-btn";
    sendBtn.textContent = "\u25B6";
    sendBtn.title = "Send Request";
    sendBtn.dataset.model = model;
    sendBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isAnimating) {
        removeBall();
        resetHighlight();
      } else {
        launchBall(model);
      }
    });
    row.appendChild(sendBtn);

    mc.appendChild(row);
  });

  const lc = document.getElementById("legend-items");
  LAYER_ORDER.forEach(layer => {
    const item = document.createElement("div");
    item.className = "legend-item";
    const hex = "#" + new THREE.Color(LAYER_COLORS[layer]).getHexString();
    item.innerHTML = `<span class="legend-dot" style="background:${hex}"></span>${LAYER_LABELS[layer]}`;
    lc.appendChild(item);
  });
  [
    { cls: "solid", label: "Data Flow" },
    { cls: "dashed", label: "Inheritance" },
    { cls: "dotted", label: "Dependency" },
  ].forEach(({ cls, label }) => {
    const item = document.createElement("div");
    item.className = "legend-edge";
    item.innerHTML = `<span class="legend-line ${cls}"></span>${label}`;
    lc.appendChild(item);
  });

  clearInfoPanel();
  document.getElementById("reset-btn").addEventListener("click", resetHighlight);

  const si = document.getElementById("search-input");
  si.addEventListener("input", () => {
    const q = si.value.toLowerCase().trim();
    if (!q) { resetHighlight(); return; }
    exitOverviewForAction();
    activeModel = null;
    updateModelButtons();
    document.getElementById("reset-btn").classList.add("visible");

    const matchSet = new Set(
      nodes.filter(n => n.label.toLowerCase().includes(q) || n.file.toLowerCase().includes(q) || n.id.includes(q)).map(n => n.id)
    );
    Object.entries(nodeMeshes).forEach(([id, mesh]) => {
      const hit = matchSet.has(id);
      gsap.to(mesh.material, { opacity: hit ? 1.0 : DIMMED_OPACITY, duration: 0.3 });
      nodeLabels[id]?.classList.toggle("highlighted", hit);
      nodeLabels[id]?.classList.toggle("dimmed", !hit);
      nodeTags[id]?.classList.toggle("highlighted", hit);
      nodeTags[id]?.classList.toggle("dimmed", !hit);
    });
    edgeLines.forEach(line => {
      const both = matchSet.has(line.userData.source) && matchSet.has(line.userData.target);
      gsap.to(line.material, { opacity: both ? EDGE_HIGHLIGHT_OPACITY : DIMMED_OPACITY * 0.3, duration: 0.3 });
    });
  });
}

function updateModelButtons() {
  document.querySelectorAll(".model-btn").forEach(btn => {
    btn.classList.toggle("active", btn.textContent === activeModel);
  });
  updateSendButtons();
}

function updateSendButtons() {
  document.querySelectorAll(".send-req-btn").forEach(btn => {
    const isActive = btn.dataset.model === activeModel;
    btn.classList.toggle("visible", isActive);
    btn.textContent = isAnimating && isActive ? "\u25A0" : "\u25B6";
    btn.title = isAnimating && isActive ? "Cancel" : "Send Request";
  });
}

// ─── Playback Controls ───
function toggleAutoExplore() {
  autoExploreEnabled = !autoExploreEnabled;
  updateAutoExploreButton();
}

function updateAutoExploreButton() {
  const btn = document.getElementById("btn-dive");
  if (!btn) return;
  btn.textContent = autoExploreEnabled ? "🔬 Dive" : "⏭ Skip";
  btn.title = autoExploreEnabled
    ? "Auto-explore inside nodes (click to skip)"
    : "Skip inside nodes — default (click to dive)";
  btn.classList.toggle("active", autoExploreEnabled);
}

function setupPlaybackControls() {
  document.getElementById("btn-stop").addEventListener("click", () => {
    removeBall();
    resetHighlight();
  });
  document.getElementById("btn-follow").addEventListener("click", toggleCameraFollow);
  document.getElementById("btn-dive").addEventListener("click", toggleAutoExplore);
  document.getElementById("btn-explain").addEventListener("click", openExplainPanel);
  document.getElementById("btn-pause").addEventListener("click", togglePause);
  document.getElementById("btn-slow").addEventListener("click", slowDown);
  document.getElementById("btn-reset-speed").addEventListener("click", resetSpeed);
  document.getElementById("btn-step-next").addEventListener("click", manualStepNext);
  document.getElementById("btn-step-prev").addEventListener("click", manualStepPrev);
  document.getElementById("btn-node-next").addEventListener("click", manualNodeNext);
  document.getElementById("btn-node-prev").addEventListener("click", manualNodePrev);
  updateAutoExploreButton();
}

// ─── Zoom ───
function setupZoomControls() {
  document.getElementById("zoom-in").addEventListener("click", () => controls.zoom(camera.zoom * 0.5, true));
  document.getElementById("zoom-out").addEventListener("click", () => controls.zoom(-camera.zoom * 0.5, true));
  document.getElementById("zoom-fit").addEventListener("click", fitView);
}

function fitView() {
  const box = new THREE.Box3();
  Object.values(nodeMeshes).forEach(m => box.expandByPoint(m.position));
  box.expandByScalar(MIN_NODE_WIDTH * 2);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);

  const frustum = 80;
  const aspect = window.innerWidth / window.innerHeight;
  const vw = frustum * aspect * 2;
  const vh = frustum * 2;
  const sidebarOff = (280 / window.innerWidth) * vw * 0.5;

  const zx = vw / (size.x * 1.15);
  const zy = vh / (size.y * 1.15);
  controls.moveTo(center.x + sidebarOff, center.y, 0, true);
  controls.zoomTo(Math.min(zx, zy), true);
}

// ─── Resize ───
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  const aspect = w / h, frustum = 80;
  camera.left = -frustum * aspect;
  camera.right = frustum * aspect;
  camera.top = frustum;
  camera.bottom = -frustum;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
}

// ─── Animate ───
function animate() {
  requestAnimationFrame(animate);
  controls.update(clock.getDelta());
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

// ─── Init ───
export function init() {
  initScene();
  const pos = computeLayout();
  layoutPositions = pos;
  createNodes(pos);
  createEdges(pos);
  setupSidebar();
  setupDeviceConfig();
  const defaultCfg = DEVICE_CONFIGS[activeDeviceType];
  buildChipMesh(defaultCfg.meshShape, defaultCfg.deviceIds);
  setupZoomControls();
  setupPlaybackControls();

  buildOverviewZones();

  const shouldStartOverview = loadOverviewPreference();
  if (shouldStartOverview) {
    overviewActive = true;
    setDetailObjectsOpacity(0, 0);
    setOverviewObjectsOpacity(1, 0);
    updateOverviewToggleButton();
  }

  document.getElementById("overview-toggle").addEventListener("click", toggleOverview);

  document.getElementById("node-detail-close").addEventListener("click", (e) => {
    e.stopPropagation();
    closeNodeDetail();
  });

  document.getElementById("node-detail").addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.getElementById("node-detail-content").addEventListener("click", (e) => {
    const exploreBtn = e.target.closest(".nd-explore-btn");
    if (exploreBtn) {
      e.stopPropagation();
      const nd = nodeMap[exploreBtn.dataset.nodeId];
      if (nd) exploreInside(nd);
      return;
    }
  });

  document.getElementById("btn-back-inside").addEventListener("click", (e) => {
    e.stopPropagation();
    exitInside();
  });

  document.getElementById("explain-panel").addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.getElementById("explain-close").addEventListener("click", (e) => {
    e.stopPropagation();
    closeExplainPanel();
  });

  document.getElementById("explain-resume").addEventListener("click", (e) => {
    e.stopPropagation();
    closeExplainPanel();
    if (isPaused) togglePause();
  });

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("click", onClick);
  window.addEventListener("resize", onResize);
  window.addEventListener("blur", clearHoverState);
  renderer.domElement.addEventListener("pointerleave", clearHoverState);
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const explainPanel = document.getElementById("explain-panel");
      if (explainPanel && explainPanel.classList.contains("visible")) { closeExplainPanel(); return; }
      if (manualInsideActive) { exitNodeManual(); return; }
      if (isInsideNode) { exitInside(); return; }
      closeNodeDetail(); resetHighlight(); fitView();
      return;
    }

    const tag = document.activeElement?.tagName;
    const isEditing =
      tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
      || document.activeElement?.isContentEditable;

    if (isEditing) return;

    if (e.key === "Enter") {
      const explainPanel = document.getElementById("explain-panel");
      const explainVisible = explainPanel?.classList.contains("visible");
      if (explainVisible) {
        e.preventDefault();
        closeExplainPanel();
        if (isPaused) togglePause();
        return;
      }
      if (isAnimating && ballGroup) {
        e.preventDefault();
        openExplainPanel();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      slowDown();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      speedUp();
      return;
    }
    if (e.key === "d" || e.key === "D") {
      e.preventDefault();
      toggleAutoExplore();
      return;
    }

    const explainOpen = document.getElementById("explain-panel")?.classList.contains("visible");

    if (isAnimating && ballGroup) {
      if (e.key === " " || e.code === "Space") {
        if (explainOpen) return;
        e.preventDefault();
        togglePause();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        manualStepNext();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        manualStepPrev();
        return;
      }
    }
  });

  fitView();
  animate();
}
