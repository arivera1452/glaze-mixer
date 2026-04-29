// ═══════════════════════════════════════════════════════
//  TAB SWITCHING
// ═══════════════════════════════════════════════════════
let activeTab = 'mixer';

function switchTab(tab) {
    activeTab = tab;
    if (typeof updateCarouselArrows === 'function') updateCarouselArrows();

    document.querySelectorAll('.tab-btn').forEach((b, i) => {
        b.classList.toggle('active', (i === 0) === (tab === 'mixer'));
    });
    document.getElementById('mixer-panel').classList.toggle('active', tab === 'mixer');
    document.getElementById('tracker-panel').classList.toggle('active', tab === 'tracker');

    const cnv = document.querySelector('#canvas-container canvas');
    if (cnv) {
        if (tab === 'mixer') {
            cnv.style.visibility = 'visible';
            if (typeof loop === 'function') loop();
            redraw();
        } else {
            cnv.style.visibility = 'hidden';
        }
    }
}

// ═══════════════════════════════════════════════════════
//  GLAZE MIXER  (p5.js)
// ═══════════════════════════════════════════════════════
let studioGlazes = [];
let activeStudioCode = null; // null = personal (default) glazes
let selectedL1 = null;
let selectedL2 = null;

let scrollX = 0;
let targetScrollX = 0;
let desktopCarouselStart  = 0;   // first visible glaze index in desktop paged mode
let desktopSlideOffset    = 0;   // fractional tile-width offset for slide animation
let desktopSlideFrom      = 0;   // starting offset when animation began
let desktopSlideStartTime = 0;   // performance.now() when animation began
const DESKTOP_SLIDE_MS    = 340; // animation duration ms
let SWATCH    = 108;
let GAP       = 18;
let STEP      = SWATCH + GAP;
let START_X   = 62;

// These are computed dynamically in setup() based on actual canvas size
let TILE_SIZE      = 320;
let TILE_CX        = 220;
let TILE_CY        = 515;
let CAROUSEL_BOTTOM = 130; // px from bottom to carousel center — scales with screen

let dragStartX      = 0;
let dragStartScroll = 0;
let isDragging      = false;
const DRAG_THRESHOLD = 5;

function _recomputeLayout() {
    const _isDesktop = document.body.classList.contains('desktop-mode');
    const _ew  = _isDesktop ? Math.min(width, 480) : width;
    const scale = _ew / 440;
    SWATCH    = Math.round(108 * scale);
    GAP       = Math.round(18  * scale);
    STEP      = SWATCH + GAP;
    START_X   = Math.round(62  * scale);
    TILE_SIZE = Math.round(320 * scale * (_isDesktop ? 1.2 : 1));
    TILE_CX   = Math.round(width / 2);
    // Scale the carousel bottom offset so it shrinks on small screens
    CAROUSEL_BOTTOM = Math.round(Math.max(80 * scale, _isDesktop ? 160 : 110));
    const chromeEl     = document.getElementById('app-chrome');
    const chromeBottom = chromeEl ? chromeEl.getBoundingClientRect().height : Math.round(290 * scale);
    const carouselTop  = height - CAROUSEL_BOTTOM - Math.round(SWATCH / 2) - 22;
    TILE_CY = Math.round((chromeBottom + carouselTop) / 2);
    // Cap tile so it never overlaps chrome or carousel
    const availableH = carouselTop - chromeBottom - 32;
    TILE_SIZE = Math.min(TILE_SIZE, Math.round(availableH * 0.88));
    TILE_SIZE = Math.max(TILE_SIZE, Math.round(80 * scale)); // floor
}

function setup() {
    const container = document.getElementById('canvas-container');
    let cnv = createCanvas(container.offsetWidth, container.offsetHeight);
    cnv.parent('canvas-container');
    container.insertBefore(cnv.elt, container.firstChild);
    textFont('DM Mono');

    _recomputeLayout();

    // Default personal glaze definitions
    window._defaultGlazeDefs = [
        { name:"White",     rgb:[248,246,240], seed:1.0,  flowScale:2.2, poolScale:5.0, darkF:0.82, lightF:1.06, specP:0.18 },
        { name:"Cobalt",    rgb:[38, 66, 148], seed:23,   flowScale:2.8, poolScale:4.2, darkF:0.50, lightF:1.38, specP:0.55 },
        { name:"Forest",    rgb:[38, 98,  56], seed:37,   flowScale:3.1, poolScale:5.8, darkF:0.48, lightF:1.22, specP:0.35 },
        { name:"Turquoise", rgb:[45, 188,170], seed:41,   flowScale:2.5, poolScale:4.6, darkF:0.55, lightF:1.32, specP:0.60 },
        { name:"Walnut",    rgb:[101,67,  33], seed:55,   flowScale:3.8, poolScale:6.2, darkF:0.42, lightF:1.18, specP:0.20 },
        { name:"Rust",      rgb:[183,65,  14], seed:62,   flowScale:2.9, poolScale:5.1, darkF:0.48, lightF:1.28, specP:0.30 },
        { name:"Straw",     rgb:[220,185,138], seed:78,   flowScale:2.0, poolScale:4.8, darkF:0.72, lightF:1.10, specP:0.16 },
    ];
    // Glaze definitions — rgb + texture personality
    const defs = [
        { name:"White",     rgb:[248,246,240], seed:1.0,  flowScale:2.2, poolScale:5.0, darkF:0.82, lightF:1.06, specP:0.18 },
        { name:"Cobalt",    rgb:[38, 66, 148], seed:23,   flowScale:2.8, poolScale:4.2, darkF:0.50, lightF:1.38, specP:0.55 },
        { name:"Forest",    rgb:[38, 98,  56], seed:37,   flowScale:3.1, poolScale:5.8, darkF:0.48, lightF:1.22, specP:0.35 },
        { name:"Turquoise", rgb:[45, 188,170], seed:41,   flowScale:2.5, poolScale:4.6, darkF:0.55, lightF:1.32, specP:0.60 },
        { name:"Walnut",    rgb:[101,67,  33], seed:55,   flowScale:3.8, poolScale:6.2, darkF:0.42, lightF:1.18, specP:0.20 },
        { name:"Rust",      rgb:[183,65,  14], seed:62,   flowScale:2.9, poolScale:5.1, darkF:0.48, lightF:1.28, specP:0.30 },
        { name:"Straw",     rgb:[220,185,138], seed:78,   flowScale:2.0, poolScale:4.8, darkF:0.72, lightF:1.10, specP:0.16 },
    ];

    studioGlazes = buildGlazes(defs);
    setTimeout(updateCarouselArrows, 0);
}

// Convert a hex color string to rgb array
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r, g, b];
}

// Resize an image data URL to fit within maxSize px on the longest edge
function resizeImage(dataURL, maxSize, quality, callback) {
    const img = new Image();
    img.onload = () => {
        const scale  = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w      = Math.round(img.width  * scale);
        const h      = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataURL;
}

// Extract average color from an image data URL
function extractAvgColor(dataURL, callback) {
    const img = new Image();
    img.onload = () => {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 128) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
        }
        callback(count ? rgbToHex([Math.round(r/count), Math.round(g/count), Math.round(b/count)]) : '#888888');
    };
    img.src = dataURL;
}

// Convert rgb array to hex
function rgbToHex(rgb) {
    return '#' + rgb.map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}

// Image cache for glaze photos — keyed by data URL
const _glazeImageCache = {};
function getGlazeImage(photoURL) {
    if (!photoURL) return null;
    if (_glazeImageCache[photoURL] instanceof HTMLImageElement) return _glazeImageCache[photoURL];
    if (_glazeImageCache[photoURL] === 'loading') return null;
    _glazeImageCache[photoURL] = 'loading';
    const img = new Image();
    img.onload = () => {
        _glazeImageCache[photoURL] = img;
        if (typeof redraw === 'function') redraw();
    };
    img.src = photoURL;
    return null;
}

// Build glaze objects from a def array — simple flat colors, no textures.
function buildGlazes(defs) {
    return defs.map((def, i) => {
        const rgb = def.rgb || hexToRgb(def.color || '#888888');
        return {
            name:  def.name,
            photo: def.photo || null,
            rgb,
            _col: null,
            get col() { if (!this._col) this._col = color(...this.rgb); return this._col; }
        };
    });
}

// Flag that glazes need rebuilding (safe to call outside p5 context)
let _glazesDirty = true;

function loadActiveGlazes() {
    resetGlazeSelection();
    _glazesDirty = true;

    // Update the active studio bar immediately
    const bar    = document.getElementById('active-studio-bar');
    const nameEl = document.getElementById('active-studio-name');
    if (activeStudioCode) {
        const studioData = JSON.parse(localStorage.getItem('sga_studio_' + activeStudioCode) || '{}');
        if (bar)    bar.classList.add('visible');
        if (nameEl) nameEl.textContent = studioData.name || activeStudioCode;
    } else {
        if (bar) bar.classList.remove('visible');
    }

    // Reset carousel scroll
    scrollX = 0; targetScrollX = 0;
    if (typeof redraw === 'function') redraw();
}

// Rebuild studioGlazes inside p5 context (called from draw)
function rebuildGlazesIfDirty() {
    if (!_glazesDirty) return;
    _glazesDirty = false;

    if (activeStudioCode) {
        const studioData = JSON.parse(localStorage.getItem('sga_studio_' + activeStudioCode) || '{}');
        studioGlazes = buildGlazes(studioData.glazes || []);
    } else {
        studioGlazes = []; // no studio active = empty carousel
    }

    // Reset carousel scroll and paging
    scrollX = 0; targetScrollX = 0;
    desktopCarouselStart = 0; desktopSlideOffset = 0; desktopSlideFrom = 0;
    setTimeout(updateCarouselArrows, 0);
}

// Set a studio as active from the profile overlay
function setActiveStudio(code) {
    activeStudioCode = (activeStudioCode === code) ? null : code;

    // Update active studio bar
    const bar    = document.getElementById('active-studio-bar');
    const nameEl = document.getElementById('active-studio-name');
    if (activeStudioCode) {
        const studioData = JSON.parse(localStorage.getItem('sga_studio_' + activeStudioCode) || '{}');
        if (bar)    bar.classList.add('visible');
        if (nameEl) nameEl.textContent = studioData.name || activeStudioCode;
    } else {
        if (bar) bar.classList.remove('visible');
    }

    // Mark dirty so draw() rebuilds glazes inside p5 context
    _glazesDirty = true;
    selectedL1 = null;
    selectedL2 = null;
    mixCanvas  = null;
    scrollX = 0;
    targetScrollX = 0;

    renderProfileStudios();
    updateMixerUI();
}

function draw() {
    if (activeTab !== 'mixer') return;
    rebuildGlazesIfDirty();
    background('#faf8f5');
    drawTile();
    drawCarousel();
}

// Helper — rounded rect clip path
function rrPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
}

function drawTile() {
    const tx = TILE_CX - TILE_SIZE/2;
    const ty = TILE_CY - TILE_SIZE/2;
    const ctx = drawingContext;

    rectMode(CENTER);
    noStroke();
    drawingContext.shadowColor   = 'rgba(0,0,0,0.14)';
    drawingContext.shadowBlur    = 24;
    drawingContext.shadowOffsetY = 10;

    if (selectedL1) {
        let displayCol = selectedL1.col;
        if (selectedL2) displayCol = lerpColor(selectedL1.col, selectedL2.col, 0.65);

        // Draw shadow + color base
        fill(displayCol);
        square(TILE_CX, TILE_CY, TILE_SIZE, 8);
        drawingContext.shadowColor = 'transparent';

        // Draw glaze photo(s) clipped to tile bounds
        const img1 = selectedL1.photo ? getGlazeImage(selectedL1.photo) : null;
        const img2 = selectedL2 && selectedL2.photo ? getGlazeImage(selectedL2.photo) : null;
        if (img1 || img2) {
            drawingContext.save();
            rrPath(drawingContext, tx, ty, TILE_SIZE, TILE_SIZE, 8);
            drawingContext.clip();
            if (img1) {
                drawingContext.globalAlpha = 1;
                drawingContext.drawImage(img1, tx, ty, TILE_SIZE, TILE_SIZE);
            }
            if (img2) {
                drawingContext.globalAlpha = 0.5;
                drawingContext.drawImage(img2, tx, ty, TILE_SIZE, TILE_SIZE);
                drawingContext.globalAlpha = 1;
            }
            drawingContext.restore();
        }

        // Tint logo/wordmark from the display colour
        tintLogo(displayCol);
        tintWordmark(displayCol);

        // Label — pick black or white based on luminance
        const r = red(displayCol), g = green(displayCol), b = blue(displayCol);
        const lum = 0.299*r + 0.587*g + 0.114*b;
        fill(lum > 140 ? color(0,0,0,190) : color(255,255,255,220));
        textAlign(CENTER, CENTER);
        if (selectedL2) {
            textSize(12); textStyle(NORMAL);
            text(`${selectedL2.name}  ›  ${selectedL1.name}`, TILE_CX, TILE_CY + TILE_SIZE/2 - 22);
            textSize(26); textStyle(BOLD);
            text("Mix", TILE_CX, TILE_CY - 10);
        } else {
            textSize(22); textStyle(BOLD);
            text(selectedL1.name, TILE_CX, TILE_CY - 8);
            textSize(12); textStyle(NORMAL);
            text("BASE LAYER", TILE_CX, TILE_CY + 22);
        }
    } else {
        fill('#ece8e1');
        square(TILE_CX, TILE_CY, TILE_SIZE, 8);
        drawingContext.shadowColor = 'transparent';
        fill('#b5a898');
        textAlign(CENTER, CENTER);
        textSize(13); textStyle(NORMAL);
        if (studioGlazes.length === 0) {
            if (activeStudioCode) {
                text("NO GLAZES IN THIS STUDIO", TILE_CX, TILE_CY - 6);
                textSize(11);
                text("add glazes in studio settings", TILE_CX, TILE_CY + 14);
            } else {
                text("NO STUDIO SELECTED", TILE_CX, TILE_CY - 6);
                textSize(11);
                text("set a studio active in your profile", TILE_CX, TILE_CY + 14);
            }
        } else {
            text("SELECT A GLAZE BELOW", TILE_CX, TILE_CY - 6);
            textSize(11);
            text("to preview on tile", TILE_CX, TILE_CY + 14);
        }
    }
    // Studio label — drawn on canvas below the tile in desktop mode;
    // the HTML #active-studio-bar handles this in mobile mode.
    if (activeStudioCode && document.body.classList.contains('desktop-mode')) {
        const nameSpan   = document.getElementById('active-studio-name');
        const studioName = (nameSpan ? nameSpan.textContent : '').toUpperCase();
        const labelY     = TILE_CY + TILE_SIZE / 2 + 22;
        const prefix     = 'VIEWING  ';
        textSize(10);
        textStyle(NORMAL);
        textAlign(LEFT, CENTER);
        noStroke();
        // Measure both parts to manually center the two-color string
        const prefixW = textWidth(prefix);
        const nameW   = textWidth(studioName);
        const startX  = TILE_CX - (prefixW + nameW) / 2;
        fill('#b09070');
        text(prefix, startX, labelY);
        fill('#1c1814');
        text(studioName, startX + prefixW, labelY);
    }

    rectMode(CORNER);
    textStyle(NORMAL);
}

function drawCarousel() {
    scrollX = lerp(scrollX, targetScrollX, 0.18);
    if (desktopSlideFrom !== 0) {
        const t     = Math.min(1, (performance.now() - desktopSlideStartTime) / DESKTOP_SLIDE_MS);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        desktopSlideOffset = desktopSlideFrom * (1 - eased);
        if (t >= 1) { desktopSlideOffset = 0; desktopSlideFrom = 0; }
    }
    const carouselY = height - CAROUSEL_BOTTOM;
    const ctx       = drawingContext;
    const isDesktop = document.body.classList.contains('desktop-mode');
    const PAGE      = 5;

    // Desktop: show up to 5 glazes, centered, paged via arrows.
    // Mobile:  all glazes, left-anchored, drag scroll.
    const displayGlazes = isDesktop
        ? studioGlazes.slice(desktopCarouselStart, desktopCarouselStart + PAGE)
        : studioGlazes;

    const baseStartX = (isDesktop && displayGlazes.length > 0)
        ? Math.round(width / 2 - (displayGlazes.length * STEP - GAP) / 2 + SWATCH / 2)
        : START_X;

    // Push non-visible glazes off screen so they can't be hit-tested
    if (isDesktop) {
        for (const g of studioGlazes) { g.worldX = -9999; g.worldY = -9999; }
    }

    push();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, carouselY - SWATCH / 2 - 22, width, SWATCH + 64);
    ctx.clip();
    translate(scrollX, 0);

    for (let i = 0; i < displayGlazes.length; i++) {
        const g  = displayGlazes[i];
        const cx = baseStartX + i * STEP + desktopSlideOffset * STEP;
        const cy = carouselY;
        g.worldX = cx;
        g.worldY = cy;

        const isBase = selectedL1 === g;
        const isTop  = selectedL2 === g;
        const lift   = (isBase || isTop) ? -6 : 0;
        const sy     = cy + lift;

        // Shadow + flat fill (always drawn; image overlaid on top if available)
        drawingContext.shadowColor   = isBase||isTop ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.10)';
        drawingContext.shadowBlur    = isBase||isTop ? 18 : 8;
        drawingContext.shadowOffsetY = isBase||isTop ? 8  : 3;
        fill(g.col);
        rectMode(CENTER);
        square(cx, sy, SWATCH, 12);
        drawingContext.shadowColor = 'transparent';

        // Draw photo over the color swatch if available
        const glazeImg = g.photo ? getGlazeImage(g.photo) : null;
        if (glazeImg) {
            const sx = cx - SWATCH / 2, sy2 = sy - SWATCH / 2;
            drawingContext.save();
            rrPath(drawingContext, sx, sy2, SWATCH, SWATCH, 12);
            drawingContext.clip();
            drawingContext.drawImage(glazeImg, sx, sy2, SWATCH, SWATCH);
            drawingContext.restore();
        }

        // Selection ring
        noFill();
        if (isBase)      { stroke('#1c1814'); strokeWeight(5); }
        else if (isTop)  { stroke('#1c1814'); strokeWeight(5); }
        else             { stroke('#e2dbd2'); strokeWeight(2); }
        rectMode(CENTER);
        square(cx, sy, SWATCH, 12);
        noStroke();

        // bot/top badge
        if (isBase || isTop) {
            const badgeCX = cx;
            const badgeCY = sy - SWATCH/2 + 2;
            const bw = 26, bh = 14;
            fill(color(28,24,20));
            rectMode(CENTER);
            rect(badgeCX, badgeCY, bw, bh, 7);
            fill(255);
            textAlign(CENTER, CENTER);
            textSize(8); textStyle(BOLD);
            text(isBase ? 'bot' : 'top', badgeCX, badgeCY);
        }

        // Name label
        noStroke();
        fill(isBase||isTop ? '#1c1814' : '#6b5e52');
        textAlign(CENTER, CENTER);
        textSize(11);
        textStyle(isBase||isTop ? BOLD : NORMAL);
        text(g.name.toUpperCase(), cx, sy + SWATCH/2 + 16);
    }

    ctx.restore();
    pop();

    // Desktop: edge fades — hint that more glazes exist beyond the visible page
    if (isDesktop && studioGlazes.length > PAGE) {
        const fadeW = 140;
        const y0    = carouselY - SWATCH / 2 - 22;
        const fh    = SWATCH + 64;
        ctx.save();
        if (desktopCarouselStart > 0) {
            const lg = ctx.createLinearGradient(0, 0, fadeW, 0);
            lg.addColorStop(0, 'rgba(250,248,245,1)');
            lg.addColorStop(1, 'rgba(250,248,245,0)');
            ctx.fillStyle = lg;
            ctx.fillRect(0, y0, fadeW, fh);
        }
        if (desktopCarouselStart + PAGE < studioGlazes.length) {
            const rg = ctx.createLinearGradient(width - fadeW, 0, width, 0);
            rg.addColorStop(0, 'rgba(250,248,245,0)');
            rg.addColorStop(1, 'rgba(250,248,245,1)');
            ctx.fillStyle = rg;
            ctx.fillRect(width - fadeW, y0, fadeW, fh);
        }
        ctx.restore();
    }

}

function isOverlayOpen() {
    const overlays = ['profile-overlay', 'delete-confirm', 'lightbox', 'studio-mgmt-overlay'];
    return overlays.some(id => {
        const el = document.getElementById(id);
        return el && (el.classList.contains('open') || el.style.display === 'flex');
    }) || document.getElementById('studio-mgmt-overlay')?.classList.contains('open');
}

function mousePressed() {
    if (isOverlayOpen()) return;
    if (activeTab !== 'mixer') return;
    dragStartX = mouseX; dragStartScroll = targetScrollX; isDragging = false;
}

function mouseDragged() {
    if (isOverlayOpen()) return;
    if (activeTab !== 'mixer') return;
    if (document.body.classList.contains('desktop-mode')) return;
    let dx = mouseX - dragStartX;
    if (abs(dx) > DRAG_THRESHOLD) isDragging = true;
    if (isDragging) {
        const totalWidth = (studioGlazes.length - 1) * STEP;
        targetScrollX = constrain(dragStartScroll + dx, -(totalWidth - (width - START_X * 2)), 0);
    }
}

function mouseReleased() {
    if (isOverlayOpen()) return;
    if (activeTab !== 'mixer') return;
    if (isDragging) return;
    for (let g of studioGlazes) {
        let wx = g.worldX + scrollX;
        if (mouseX >= wx - SWATCH/2 && mouseX <= wx + SWATCH/2 &&
            mouseY >= g.worldY - SWATCH/2 - 6 && mouseY <= g.worldY + SWATCH/2 + 6) {
            handleSelect(g); return;
        }
    }
}

function handleSelect(g) {
    if (!selectedL1)           { selectedL1 = g; }
    else if (g === selectedL1) { selectedL1 = selectedL2; selectedL2 = null; }
    else if (!selectedL2)      { selectedL2 = g; }
    else if (g === selectedL2) { selectedL2 = null; }
    else                       { selectedL2 = g; }
    updateMixerUI();
}

function updateMixerUI() {
    if (!selectedL1) {
        tintLogoGrey(); tintWordmarkGrey();
    } else if (!selectedL2) {
        tintLogo(selectedL1.col); tintWordmark(selectedL1.col);
    } else {
        let mixCol = lerpColor(selectedL1.col, selectedL2.col, 0.65);
        tintLogo(mixCol); tintWordmark(mixCol);
    }
}

function _isCanvasTouch(e) {
    if (!e || !e.target) return false;
    return !e.target.closest('button, input, textarea, select, a, label, [onclick]');
}

let _touchState = null;

function _canvasXY(e, useChanged) {
    const list = useChanged ? e.changedTouches : e.touches;
    if (!list || !list[0]) return null;
    const rect = document.getElementById('canvas-container').getBoundingClientRect();
    return { x: list[0].clientX - rect.left, y: list[0].clientY - rect.top };
}

function touchStarted(e) {
    if (!_isCanvasTouch(e) || isOverlayOpen() || activeTab !== 'mixer') return true;
    const pos = _canvasXY(e, false);
    if (!pos) return true;
    _touchState = { startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y,
                    startScroll: targetScrollX, dragging: false };
    return false;
}

function touchMoved(e) {
    if (!_touchState || !_isCanvasTouch(e) || isOverlayOpen() || activeTab !== 'mixer') return true;
    const pos = _canvasXY(e, false);
    if (!pos) return true;
    _touchState.curX = pos.x;
    _touchState.curY = pos.y;
    const dx = pos.x - _touchState.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD) _touchState.dragging = true;
    if (_touchState.dragging) {
        const totalWidth = (studioGlazes.length - 1) * STEP;
        targetScrollX = Math.max(-(totalWidth - (width - START_X * 2)), Math.min(0, _touchState.startScroll + dx));
    }
    return false;
}

function touchEnded(e) {
    if (!isOverlayOpen() && activeTab === 'mixer' && _touchState) {
        if (!_touchState.dragging) {
            const pos = _canvasXY(e, true) || { x: _touchState.curX, y: _touchState.curY };
            for (let g of studioGlazes) {
                const wx = g.worldX + scrollX;
                if (pos.x >= wx - SWATCH/2 && pos.x <= wx + SWATCH/2 &&
                    pos.y >= g.worldY - SWATCH/2 - 6 && pos.y <= g.worldY + SWATCH/2 + 6) {
                    handleSelect(g);
                    break;
                }
            }
        }
    }
    _touchState = null;
    return true;
}

// ═══════════════════════════════════════════════════════
//  PIECE TRACKER
// ═══════════════════════════════════════════════════════
const STAGES = ['Greenware','Bisque','Glaze','Fired'];
let pieces = [];
let pieceCounter = 0;

function savePieces() {
    if (!currentUser) return;
    const key = 'sga_pieces_' + currentUser.username.toLowerCase();
    localStorage.setItem(key, JSON.stringify({ pieces, pieceCounter }));
}

function loadPieces() {
    pieces = [];
    pieceCounter = 0;
    if (!currentUser) return;
    const key = 'sga_pieces_' + currentUser.username.toLowerCase();
    const stored = localStorage.getItem(key);
    if (!stored) return;
    try {
        const data = JSON.parse(stored);
        pieces      = data.pieces      || [];
        pieceCounter = data.pieceCounter || 0;
    } catch(e) {}
}

function addPiece() {
    const id = ++pieceCounter;
    pieces.push({ id, name: '', stages: { Greenware:{}, Bisque:{}, Glaze:{}, Fired:{} } });
    renderPieces();
    _isNewPiece = true;
    openPieceOverlay(id);
}

// ── Delete piece ─────────────────────────────────────────────────────────────
let pendingDelete = null;

function requestDeletePiece(id) {
    pendingDelete = id;
    document.getElementById('delete-confirm').classList.add('open');
}

function confirmDelete() {
    if (pendingDelete !== null) {
        const wasActive = activePieceId === pendingDelete;
        pieces = pieces.filter(p => p.id !== pendingDelete);
        pendingDelete = null;
        savePieces();
        if (wasActive) {
            _isNewPiece = false;
            closePieceOverlay();
        }
        renderPieces();
    }
    document.getElementById('delete-confirm').classList.remove('open');
}

function cancelDelete() {
    pendingDelete = null;
    document.getElementById('delete-confirm').classList.remove('open');
}

// Dismiss on backdrop click
document.getElementById('delete-confirm').addEventListener('click', function(e) {
    if (e.target === this) cancelDelete();
});

let activePieceId = null;
let _isNewPiece   = false;

function openPieceOverlay(id) {
    activePieceId = id;
    const piece = pieces.find(p => p.id === id);
    if (!piece) return;
    document.getElementById('piece-edit-name').value = piece.name;
    document.getElementById('piece-edit-delete-btn').onclick = () => requestDeletePiece(id);
    renderPieceOverlayContent(piece);
    document.getElementById('piece-edit-overlay').classList.add('open');
}

function closePieceOverlay() {
    if (_isNewPiece && activePieceId !== null) {
        const piece = pieces.find(p => p.id === activePieceId);
        if (piece) {
            const hasName    = piece.name && piece.name.trim();
            const hasContent = STAGES.some(s =>
                (piece.stages[s].photos && piece.stages[s].photos.length) ||
                (piece.stages[s].notes  && piece.stages[s].notes.trim())
            );
            if (!hasName && !hasContent) {
                pieces = pieces.filter(p => p.id !== activePieceId);
            }
        }
    }
    _isNewPiece   = false;
    activePieceId = null;
    savePieces();
    document.getElementById('piece-edit-overlay').classList.remove('open');
    renderPieces();
}

function renderPieceOverlayContent(piece) {
    const filledCount = STAGES.filter(s =>
        (piece.stages[s].photos && piece.stages[s].photos.length) || (piece.stages[s].notes && piece.stages[s].notes.trim())
    ).length;

    const progressSegs = STAGES.map((_s, i) => {
        let cls = 'progress-seg';
        if (i < filledCount) cls += ' done';
        else if (i === filledCount) cls += ' active';
        return `<div class="${cls}"></div>`;
    }).join('');

    const stageRows = STAGES.map(stage => {
        const d = piece.stages[stage];
        const photos = d.photos || [];
        const hasPhotos = photos.length > 0;
        const thumbHtml = hasPhotos
            ? `<img class="photo-thumb" src="${photos[0]}" alt="${stage}"
                   onclick="openLightbox(${piece.id},'${stage}',0)">
               ${photos.length > 1 ? `<div class="photo-count-badge">${photos.length}</div>` : ''}`
            : `<span class="plus-icon">+</span>`;
        return `
        <div class="stage-row">
            <div class="stage-label">${stage}</div>
            <div class="stage-body">
                <div class="photo-slot-single ${hasPhotos ? 'has-photo' : ''}">
                    ${thumbHtml}
                    <input type="file" accept="image/*" multiple
                        onchange="handlePhotos(event,${piece.id},'${stage}')"
                        ${hasPhotos ? 'style="display:none"' : ''}>
                </div>
                <textarea class="stage-notes" rows="3"
                    placeholder="Notes on ${stage.toLowerCase()}…"
                    oninput="handleNotes(event,${piece.id},'${stage}')"
                >${d.notes || ''}</textarea>
            </div>
        </div>`;
    }).join('');

    document.getElementById('piece-edit-body').innerHTML = `
        <div class="piece-progress">${progressSegs}</div>
        <div class="piece-stages">${stageRows}</div>
    `;
}

function handleOverlayName(e) {
    if (activePieceId === null) return;
    const p = pieces.find(p => p.id === activePieceId);
    if (p) { p.name = e.target.value; savePieces(); }
}

function renderPieces() {
    const list  = document.getElementById('piece-list');
    const empty = document.getElementById('empty-state');
    Array.from(list.querySelectorAll('.piece-card')).forEach(c => c.remove());

    if (pieces.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    pieces.forEach(piece => {
        const card = document.createElement('div');
        card.className = 'piece-card';
        card.dataset.id = piece.id;

        const filledCount = STAGES.filter(s =>
            (piece.stages[s].photos && piece.stages[s].photos.length) || (piece.stages[s].notes && piece.stages[s].notes.trim())
        ).length;

        const progressSegs = STAGES.map((_s, i) => {
            let cls = 'progress-seg';
            if (i < filledCount) cls += ' done';
            else if (i === filledCount) cls += ' active';
            return `<div class="${cls}"></div>`;
        }).join('');

        const hasName    = piece.name && piece.name.trim();
        const firstPhoto = STAGES.reduce((found, s) => {
            if (found) return found;
            const photos = piece.stages[s].photos;
            return (photos && photos.length) ? photos[0] : null;
        }, null);

        card.innerHTML = `
            <div class="drag-handle" onpointerdown="startPieceDrag(event,${piece.id})" onclick="event.stopPropagation()">⠿</div>
            ${firstPhoto ? `<img class="piece-card-thumb" src="${firstPhoto}" alt="">` : '<div class="piece-card-thumb-empty"></div>'}
            <div class="piece-card-info">
                <div class="piece-card-name${hasName ? '' : ' placeholder'}">${hasName ? piece.name : 'Untitled piece'}</div>
                <div class="piece-progress">${progressSegs}</div>
            </div>
        `;
        card.addEventListener('click', () => openPieceOverlay(piece.id));
        list.appendChild(card);
    });

    if (searchQuery) filterPieces(searchQuery);
}

let searchQuery = '';

function filterPieces(query) {
    searchQuery = query.trim().toLowerCase();
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';

    const cards  = document.querySelectorAll('.piece-card');
    const noRes  = document.getElementById('no-results');
    const empty  = document.getElementById('empty-state');
    let visible  = 0;

    cards.forEach(card => {
        const id    = parseInt(card.dataset.id);
        const piece = pieces.find(p => p.id === id);
        const name  = piece ? piece.name.toLowerCase() : '';
        const match = !searchQuery || name.includes(searchQuery);
        card.style.display = match ? '' : 'none';
        if (match) visible++;
    });

    // Show "no results" only when there are pieces but none match
    if (noRes) {
        noRes.style.display = (pieces.length > 0 && visible === 0) ? 'block' : 'none';
    }
    if (empty) {
        empty.style.display = pieces.length === 0 ? 'block' : 'none';
    }
}

function clearSearch() {
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    filterPieces('');
}

// ═══════════════════════════════════════════════════════
//  PIECE DRAG-TO-REORDER
// ═══════════════════════════════════════════════════════
let _dragState = null;

function startPieceDrag(e, id) {
    e.preventDefault();
    e.stopPropagation();

    const list = document.getElementById('piece-list');
    const card = list.querySelector(`.piece-card[data-id="${id}"]`);
    if (!card) return;

    const rect  = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.style.cssText = [
        `position:fixed`,
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        `opacity:0.85`,
        `pointer-events:none`,
        `z-index:9999`,
        `transform:scale(1.02) rotate(0.8deg)`,
        `box-shadow:0 10px 36px rgba(0,0,0,0.20)`,
        `border-radius:22px`,
    ].join(';');
    document.body.appendChild(ghost);
    card.style.opacity = '0.3';

    _dragState = {
        id, ghost, card, list,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        insertBefore: null,
    };

    document.addEventListener('pointermove',   _onDragMove, { passive: false });
    document.addEventListener('pointerup',     _onDragEnd);
    document.addEventListener('pointercancel', _onDragEnd);
}

function _onDragMove(e) {
    if (!_dragState) return;
    e.preventDefault();
    const { ghost, offsetX, offsetY, list, id } = _dragState;

    ghost.style.left = (e.clientX - offsetX) + 'px';
    ghost.style.top  = (e.clientY - offsetY) + 'px';

    // Visible cards that are not the dragged card
    const targets = [...list.querySelectorAll('.piece-card')].filter(
        c => c.style.display !== 'none' && parseInt(c.dataset.id) !== id
    );

    let insertBefore = null;
    for (const c of targets) {
        const r = c.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { insertBefore = c; break; }
    }
    _dragState.insertBefore = insertBefore;

    list.querySelectorAll('.drop-indicator').forEach(d => d.remove());
    const ind = document.createElement('div');
    ind.className = 'drop-indicator';
    if (insertBefore) {
        list.insertBefore(ind, insertBefore);
    } else {
        const last = targets[targets.length - 1];
        if (last) last.after(ind); else list.appendChild(ind);
    }
}

function _onDragEnd() {
    if (!_dragState) return;
    const { id, ghost, card, list, insertBefore } = _dragState;

    ghost.remove();
    card.style.opacity = '';
    list.querySelectorAll('.drop-indicator').forEach(d => d.remove());

    document.removeEventListener('pointermove',   _onDragMove);
    document.removeEventListener('pointerup',     _onDragEnd);
    document.removeEventListener('pointercancel', _onDragEnd);
    _dragState = null;

    const fromIdx = pieces.findIndex(p => p.id === id);
    if (fromIdx === -1) { renderPieces(); return; }
    const [piece] = pieces.splice(fromIdx, 1);

    if (insertBefore) {
        const toId  = parseInt(insertBefore.dataset.id);
        const toIdx = pieces.findIndex(p => p.id === toId);
        pieces.splice(toIdx === -1 ? pieces.length : toIdx, 0, piece);
    } else {
        pieces.push(piece);
    }

    savePieces();
    renderPieces();
}

function handleNotes(e, id, stage) {
    const p = pieces.find(p => p.id === id);
    if (p) { p.stages[stage].notes = e.target.value; savePieces(); }
    updateProgressBar(id);
}

function handlePhotos(e, id, stage) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const piece = pieces.find(p => p.id === id);
    if (!piece) return;
    if (!piece.stages[stage].photos) piece.stages[stage].photos = [];

    let loaded = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            piece.stages[stage].photos.push(ev.target.result);
            loaded++;
            if (loaded === files.length) {
                savePieces();
                if (activePieceId === id) {
                    renderPieceOverlayContent(piece);
                } else {
                    renderPieces();
                }
            }
        };
        reader.readAsDataURL(file);
    });
}

function updateProgressBar(id) {
    const piece = pieces.find(p => p.id === id);
    if (!piece) return;
    const filledCount = STAGES.filter(s =>
        (piece.stages[s].photos && piece.stages[s].photos.length) || (piece.stages[s].notes && piece.stages[s].notes.trim())
    ).length;
    const update = segs => segs.forEach((seg, i) => {
        seg.className = 'progress-seg';
        if (i < filledCount) seg.classList.add('done');
        else if (i === filledCount) seg.classList.add('active');
    });
    // Update in overlay if open
    const body = document.getElementById('piece-edit-body');
    if (body) update([...body.querySelectorAll('.progress-seg')]);
    // Update in list card
    const card = document.querySelector(`.piece-card[data-id="${id}"]`);
    if (card) update([...card.querySelectorAll('.progress-seg')]);
}



// ═══════════════════════════════════════════════════════
//  SPLASH SCREEN
// ═══════════════════════════════════════════════════════
(function runSplash() {
    const layerOrder = ['spl-l5','spl-l4','spl-l3','spl-l2','spl-l1'];
    const svg        = document.getElementById('splash-logo-svg');
    const logoWrap   = document.getElementById('splash-logo-wrap');
    const wordWrap   = document.getElementById('splash-wordmark-wrap');
    const splash     = document.getElementById('splash-screen');
    const container  = document.getElementById('canvas-container');

    // ── Position splash elements to exactly match home screen elements ────────
    // We use requestAnimationFrame to ensure the browser has fully laid out
    // the home screen before measuring, then wait for fonts too.
    function alignToHome() {
        const containerRect = container.getBoundingClientRect();
        const homeLogo = document.getElementById('home-logo-wrap');
        const homeWord = document.getElementById('home-wordmark-wrap');
        if (!homeLogo || !homeWord) return;

        const logoRect = homeLogo.getBoundingClientRect();
        const wordRect = homeWord.getBoundingClientRect();

        // Only apply if measurements look valid (non-zero size)
        if (logoRect.width === 0 || wordRect.width === 0) {
            requestAnimationFrame(alignToHome);
            return;
        }

        // Coords relative to the canvas-container (which clips us)
        logoWrap.style.left  = (logoRect.left - containerRect.left) + 'px';
        logoWrap.style.top   = (logoRect.top  - containerRect.top)  + 'px';
        logoWrap.style.width = logoRect.width + 'px';

        wordWrap.style.left  = (wordRect.left - containerRect.left) + 'px';
        wordWrap.style.top   = (wordRect.top  - containerRect.top)  + 'px';
        wordWrap.style.width = wordRect.width + 'px';
    }

    // Wait for both layout and fonts before measuring
    requestAnimationFrame(() => {
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => requestAnimationFrame(alignToHome));
        } else {
            requestAnimationFrame(alignToHome);
        }
    });

    // Phase 1 (150ms): SVG rises into position and becomes visible
    setTimeout(() => {
        svg.classList.add('visible');
    }, 150);

    // Phase 2 (250–570ms): each layer fades in bottom → top (accordion feel)
    layerOrder.forEach((id, i) => {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.classList.add('expand');
        }, 250 + i * 80);
    });

    // Phase 3 (750ms): wordmark fades + rises into its exact home position
    setTimeout(() => {
        wordWrap.classList.add('rise');
    }, 750);

    // Phase 4 (2000ms): fade the dark overlay, home screen is already aligned beneath
    setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => {
            splash.classList.add('hidden');
            showHome();
        }, 680);
    }, 2000);
})();

// ═══════════════════════════════════════════════════════
//  AUTH  &  SESSION
// ═══════════════════════════════════════════════════════
let currentUser = null;   // { username, studios: [{code, name, role}] }
let authMode    = 'login'; // 'login' | 'create'

function showHome() {
    document.getElementById('home-screen').classList.remove('hidden');
    document.getElementById('auth-screen').classList.add('hidden');
    // Pause canvas
    const cnv = document.querySelector('#canvas-container canvas');
    if (cnv) cnv.style.visibility = 'hidden';
    if (typeof noLoop === 'function') noLoop();
}

function showAuth(mode) {
    authMode = mode;
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');

    const title    = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const formLogin  = document.getElementById('form-login');
    const formCreate = document.getElementById('form-create');

    if (mode === 'login') {
        title.textContent    = 'Welcome back';
        subtitle.textContent = 'Log In';
        formLogin.style.display  = 'flex';
        formCreate.style.display = 'none';
        // Pre-fill remembered credentials
        const rememberedUser = localStorage.getItem('sga_remembered_user');
        const rememberedPass = localStorage.getItem('sga_remembered_pass');
        const userInput      = document.getElementById('login-user');
        const passInput      = document.getElementById('login-pass');
        const toggleEl       = document.getElementById('remember-me-toggle');
        if (rememberedUser && userInput) userInput.value = rememberedUser;
        if (rememberedPass && passInput) passInput.value = atob(rememberedPass);
        if (toggleEl) toggleEl.checked = !!rememberedUser;
    } else {
        title.textContent    = 'Get started';
        subtitle.textContent = 'Create Account';
        formLogin.style.display  = 'none';
        formCreate.style.display = 'flex';
        const submitBtn = document.getElementById('create-submit-btn');
        if (submitBtn) { submitBtn.style.display = 'block'; submitBtn.textContent = 'Create Account'; submitBtn.onclick = doCreate; }
    }
    // Clear errors
    document.getElementById('login-error').textContent  = '';
    document.getElementById('create-error').textContent = '';
}



function generateStudioCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function doLogin() {
    const username   = document.getElementById('login-user').value.trim();
    const password   = document.getElementById('login-pass').value;
    const errEl      = document.getElementById('login-error');
    const rememberEl = document.getElementById('remember-me-toggle');
    const remember   = rememberEl && rememberEl.checked;

    if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

    const stored = localStorage.getItem('sga_user_' + username.toLowerCase());
    if (!stored) { errEl.textContent = 'No account found for that username.'; return; }

    const account = JSON.parse(stored);
    if (account.password !== btoa(password)) { errEl.textContent = 'Incorrect password.'; return; }

    if (remember) {
        localStorage.setItem('sga_last_user', username.toLowerCase());
        localStorage.setItem('sga_remembered_user', username);
        localStorage.setItem('sga_remembered_pass', btoa(password));
    } else {
        localStorage.removeItem('sga_last_user');
        localStorage.removeItem('sga_remembered_user');
        localStorage.removeItem('sga_remembered_pass');
        sessionStorage.setItem('sga_last_user', username.toLowerCase());
    }

    currentUser = { username: account.username, studios: account.studios || [] };
    enterApp();
}

function doCreate() {
    const username = document.getElementById('create-user').value.trim();
    const password = document.getElementById('create-pass').value;
    const errEl    = document.getElementById('create-error');

    if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
    if (username.length < 3)    { errEl.textContent = 'Username must be at least 3 characters.'; return; }
    if (password.length < 6)    { errEl.textContent = 'Password must be at least 6 characters.'; return; }

    const key = 'sga_user_' + username.toLowerCase();
    if (localStorage.getItem(key)) { errEl.textContent = 'That username is already taken.'; return; }

    const account = { username, password: btoa(password), studios: [] };
    localStorage.setItem(key, JSON.stringify(account));
    currentUser = { username, studios: [] };
    enterApp();
}

function openProfileOverlay() {
    if (!currentUser) { showHome(); return; }
    const parts    = currentUser.username.trim().split(/\s+/);
    const initials = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : currentUser.username.slice(0,2).toUpperCase();

    const avatarEl = document.getElementById('profile-sheet-avatar');
    const nameEl   = document.getElementById('profile-sheet-name');
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl)   nameEl.textContent   = currentUser.username;

    // Reset join input
    const joinInput = document.getElementById('profile-join-studio-input');
    const joinCode  = document.getElementById('profile-join-code');
    const joinErr   = document.getElementById('profile-join-error');
    if (joinInput) joinInput.style.display = 'none';
    if (joinCode)  joinCode.value = '';
    if (joinErr)   joinErr.textContent = '';

    renderProfileStudios();

    document.getElementById('profile-overlay').classList.add('open');
}

function renderProfileStudios() {
    const list = document.getElementById('profile-studios-list');
    if (!list) return;
    const studios = currentUser.studios || [];

    if (studios.length === 0) {
        list.innerHTML = '<p style="font-size:11px;color:#c8bfb5;text-align:center;margin:0 0 12px;letter-spacing:0.5px">No studios yet</p>';
        return;
    }

    list.innerHTML = studios.map((s, i) => {
        const isActive = activeStudioCode === s.code;
        const stData   = JSON.parse(localStorage.getItem('sga_studio_' + s.code) || '{}');
        const glazeCount = (stData.glazes || []).length;
        return `
        <div class="studio-row" data-index="${i}">
            <div class="studio-row-info">
                <div class="studio-row-name" id="studio-name-${i}">${s.name || 'Studio'}</div>
                <div class="studio-row-code">${s.code}${glazeCount ? ' · ' + glazeCount + ' glaze' + (glazeCount !== 1 ? 's' : '') : ''}</div>
            </div>
            <div class="studio-row-actions">
                <button class="studio-set-active-btn ${isActive ? 'active-studio' : ''}"
                    onclick="setActiveStudio('${s.code}')">
                    ${isActive ? '✓ Active' : 'Set Active'}
                </button>
                ${s.role === 'admin'
                    ? `<button class="studio-action-btn" title="Manage studio" onclick="openStudioMgmt('${s.code}')">✎</button>`
                    : `<button class="studio-action-btn" title="View studio info" onclick="openStudioMgmt('${s.code}')">ℹ</button>
                       <button class="studio-action-btn remove" title="Leave studio" onclick="promptLeaveStudio('${s.code}')">×</button>`}
            </div>
        </div>`;
    }).join('');


}

let _pendingLeaveCode = null;

function promptLeaveStudio(code) {
    _pendingLeaveCode = code;
    const el = document.getElementById('profile-leave-confirm');
    if (el) el.style.display = 'flex';
}

function cancelLeaveStudio() {
    _pendingLeaveCode = null;
    const el = document.getElementById('profile-leave-confirm');
    if (el) el.style.display = 'none';
}

function confirmLeaveStudio() {
    if (!_pendingLeaveCode || !currentUser) return;

    const code = _pendingLeaveCode;
    _pendingLeaveCode = null;

    // Remove from user's studios list
    const idx = (currentUser.studios || []).findIndex(s => s.code === code);
    if (idx !== -1) {
        currentUser.studios.splice(idx, 1);
        saveCurrentUser();
    }

    // Remove from studio's member list
    const key = 'sga_studio_' + code;
    const studioData = JSON.parse(localStorage.getItem(key) || '{}');
    if (studioData.members) {
        studioData.members = studioData.members.filter(m => m.username !== currentUser.username);
        localStorage.setItem(key, JSON.stringify(studioData));
    }

    // Clear active studio if it was this one
    if (activeStudioCode === code) {
        activeStudioCode = null;
        _glazesDirty = true;
        const bar = document.getElementById('active-studio-bar');
        if (bar) bar.classList.remove('visible');
    }

    const el = document.getElementById('profile-leave-confirm');
    if (el) el.style.display = 'none';
    renderProfileStudios();
    updateMixerUI();
}

function showProfileJoinStudio() {
    const el = document.getElementById('profile-join-studio-input');
    if (el) {
        el.style.display = 'block';
        const input = document.getElementById('profile-join-code');
        if (input) { input.value = ''; input.focus(); }
        const err = document.getElementById('profile-join-error');
        if (err) err.textContent = '';
    }
}

function hideProfileJoinStudio() {
    const el = document.getElementById('profile-join-studio-input');
    if (el) el.style.display = 'none';
    const input = document.getElementById('profile-join-code');
    if (input) input.value = '';
    const err = document.getElementById('profile-join-error');
    if (err) err.textContent = '';
}

function profileJoinStudio() {
    const code   = (document.getElementById('profile-join-code').value || '').trim().toUpperCase();
    const errEl  = document.getElementById('profile-join-error');
    if (code.length !== 6) { errEl.textContent = 'Enter a valid 6-character code.'; return; }

    const studioData = localStorage.getItem('sga_studio_' + code);
    if (!studioData) { errEl.textContent = 'Studio code not found.'; return; }

    const studio = JSON.parse(studioData);
    const studios = currentUser.studios || [];

    if (studios.find(s => s.code === code)) { errEl.textContent = 'Already a member of this studio.'; return; }

    const newStudio = { code, name: studio.name || 'Studio ' + code, role: 'member' };
    studios.push(newStudio);
    currentUser.studios = studios;
    saveCurrentUser();

    // Register this user as a member in the studio record
    const members = studio.members || [];
    if (!members.find(m => m.username === currentUser.username)) {
        const joined = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        members.push({ username: currentUser.username, role: 'member', joined });
        studio.members = members;
        localStorage.setItem('sga_studio_' + code, JSON.stringify(studio));
    }

    hideProfileJoinStudio();
    renderProfileStudios();
}

function handleOverlayTap(e) {
    if (e.target === document.getElementById('profile-overlay')) {
        document.getElementById('profile-overlay').classList.remove('open');
    }
}

function profileCreateStudio() {
    if (!currentUser) return;

    // Generate code and create a minimal studio record
    const code   = generateStudioCode();
    const joined = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    localStorage.setItem('sga_studio_' + code, JSON.stringify({
        admin: currentUser.username,
        name: '',
        glazes: [],
        members: [{ username: currentUser.username, role: 'admin', joined }]
    }));

    // Mark as pending — don't add to user's studio list until they press Create Studio
    _pendingNewStudio = code;

    // Go straight to the management page to fill in details
    openStudioMgmt(code);
}

function promptRemoveStudio() {
    const el = document.getElementById('mgmt-remove-confirm');
    if (el) el.style.display = 'flex';
}

function cancelRemoveStudio() {
    const el = document.getElementById('mgmt-remove-confirm');
    if (el) el.style.display = 'none';
}

function confirmRemoveStudio() {
    if (!currentMgmtCode || !currentUser) return;
    // Find index in user's studios array
    const studios = currentUser.studios || [];
    const idx = studios.findIndex(s => s.code === currentMgmtCode);
    if (idx !== -1) {
        // Clear active studio if this was it
        if (activeStudioCode === currentMgmtCode) {
            activeStudioCode = null;
            loadActiveGlazes();
        }
        studios.splice(idx, 1);
        currentUser.studios = studios;
        saveCurrentUser();
    }
    // Close management page and go back to profile
    document.getElementById('studio-mgmt-overlay').classList.remove('open');
    currentMgmtCode = null;
    openProfileOverlay();
}



function removeStudio(index) {
    const studios = currentUser.studios || [];
    if (!studios[index]) return;
    studios.splice(index, 1);
    currentUser.studios = studios;
    saveCurrentUser();
    renderProfileStudios();
}

// ═══════════════════════════════════════════════════════
//  STUDIO MANAGEMENT
// ═══════════════════════════════════════════════════════
let currentMgmtCode    = null;
let _pendingNewStudio  = null; // code of a studio not yet committed to user's list

function openStudioMgmt(code) {
    currentMgmtCode = code;

    // Close profile overlay first
    document.getElementById('profile-overlay').classList.remove('open');

    // Load studio data
    const studioData = JSON.parse(localStorage.getItem('sga_studio_' + code) || '{}');

    // Populate header
    document.getElementById('studio-mgmt-title').textContent = studioData.name || 'New Studio';
    const codeBadge = document.getElementById('studio-mgmt-code-badge');
    if (codeBadge) codeBadge.textContent = code;
    document.getElementById('mgmt-code-big').textContent = code;

    // Populate info fields — leave name blank so user types their own
    document.getElementById('mgmt-name').value     = studioData.name     || '';
    document.getElementById('mgmt-desc').value     = studioData.desc     || '';
    document.getElementById('mgmt-location').value = studioData.location || '';
    document.getElementById('mgmt-contact').value  = studioData.contact  || '';

    // Determine role
    const myStudio  = (currentUser && currentUser.studios || []).find(s => s.code === code);
    const isPending = _pendingNewStudio === code;
    const isAdmin   = isPending || (myStudio && myStudio.role === 'admin');

    // Toggle readonly mode on the overlay
    const overlay = document.getElementById('studio-mgmt-overlay');
    overlay.classList.toggle('readonly', !isAdmin);

    // Reset save button and show/hide remove section
    const saveBtn       = document.getElementById('mgmt-save-btn');
    const removeSection = document.getElementById('mgmt-remove-section');
    const removeBtn     = document.getElementById('mgmt-remove-studio-btn');
    if (saveBtn) {
        saveBtn.textContent = isPending ? 'Create Studio' : 'Save Changes';
        saveBtn.classList.remove('saved');
    }
    if (removeSection) removeSection.style.display = isPending ? 'none' : '';
    if (removeBtn) removeBtn.textContent = isAdmin ? 'Leave / Remove Studio' : 'Leave Studio';

    // In readonly mode, expand textareas to show full content without scrolling
    if (!isAdmin) {
        overlay.querySelectorAll('textarea.mgmt-input').forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
    } else {
        overlay.querySelectorAll('textarea.mgmt-input').forEach(ta => ta.style.height = '');
    }

    // Render members
    renderMgmtMembers(studioData);

    // Render glazes
    renderMgmtGlazes();

    // Slide in
    document.getElementById('studio-mgmt-overlay').classList.add('open');
}

function closeStudioMgmt() {
    document.getElementById('studio-mgmt-overlay').classList.remove('open');
    // If the user backed out of a new studio without saving, discard it entirely
    if (_pendingNewStudio && _pendingNewStudio === currentMgmtCode) {
        localStorage.removeItem('sga_studio_' + currentMgmtCode);
        _pendingNewStudio = null;
        currentMgmtCode = null;
        openProfileOverlay();
        return;
    }
    // Reload mixer if we were editing the active studio
    if (currentMgmtCode && activeStudioCode === currentMgmtCode) loadActiveGlazes();
    currentMgmtCode = null;
    // Re-open profile overlay
    openProfileOverlay();
}

function saveStudioInfo() {
    if (!currentMgmtCode) return;
    // If this is a brand-new studio, add it to the user's studio list now
    if (_pendingNewStudio && _pendingNewStudio === currentMgmtCode) {
        const studios = currentUser.studios || [];
        studios.push({ code: currentMgmtCode, name: 'New Studio', role: 'admin' });
        currentUser.studios = studios;
        saveCurrentUser();
        _pendingNewStudio = null;
    }
    const key       = 'sga_studio_' + currentMgmtCode;
    const studioData = JSON.parse(localStorage.getItem(key) || '{}');

    const name     = document.getElementById('mgmt-name').value.trim();
    const desc     = document.getElementById('mgmt-desc').value.trim();
    const location = document.getElementById('mgmt-location').value.trim();
    const contact  = document.getElementById('mgmt-contact').value.trim();

    studioData.name     = name     || studioData.name;
    studioData.desc     = desc;
    studioData.location = location;
    studioData.contact  = contact;

    localStorage.setItem(key, JSON.stringify(studioData));

    // Update name in current user's studios array
    if (currentUser && name) {
        const studios = currentUser.studios || [];
        const s = studios.find(s => s.code === currentMgmtCode);
        if (s) { s.name = name; saveCurrentUser(); }
        document.getElementById('studio-mgmt-title').textContent = name;
    }

    // Flash save button green
    const btn = document.getElementById('mgmt-save-btn');
    if (btn) {
        btn.textContent = 'Saved ✓';
        btn.classList.add('saved');
        setTimeout(() => { btn.textContent = 'Save Changes'; btn.classList.remove('saved'); }, 2000);
    }

    // Refresh the profile studio list in the background
    renderProfileStudios();
}

function renderMgmtMembers(studioData) {
    const list    = document.getElementById('mgmt-members-list');
    const members = studioData.members || [];

    if (members.length === 0) {
        list.innerHTML = '<p id="mgmt-no-members">No members have joined yet.<br>Share the code above to invite them.</p>';
        return;
    }

    list.innerHTML = members.map((m, i) => `
        <div class="member-row">
            <div class="member-row-left">
                <div class="member-row-name">${m.username}</div>
                <div class="member-row-meta">${m.role === 'admin' ? 'Admin' : 'Member'}${m.joined ? ' · Joined ' + m.joined : ''}</div>
            </div>
            <div class="member-row-actions">
                <span class="member-role-badge ${m.role === 'admin' ? 'admin' : ''}"
                    onclick="toggleMemberRole('${currentMgmtCode}', ${i})"
                    title="${m.role === 'admin' ? 'Demote to member' : 'Promote to admin'}">
                    ${m.role === 'admin' ? 'Admin' : 'Member'}
                </span>
                ${m.username !== studioData.admin ? `<button class="member-remove-btn" onclick="promptRemoveMember(${i})">×</button>` : ''}
            </div>
        </div>
    `).join('');
}

function toggleMemberRole(code, index) {
    const key        = 'sga_studio_' + code;
    const studioData = JSON.parse(localStorage.getItem(key) || '{}');
    const members    = studioData.members || [];
    if (!members[index]) return;
    // Don't demote the original admin
    if (members[index].username === studioData.admin) return;
    members[index].role = members[index].role === 'admin' ? 'member' : 'admin';
    studioData.members  = members;
    localStorage.setItem(key, JSON.stringify(studioData));
    renderMgmtMembers(studioData);
}

let _pendingRemoveMemberIndex = null;

function promptRemoveMember(index) {
    const studioData = JSON.parse(localStorage.getItem('sga_studio_' + currentMgmtCode) || '{}');
    const members    = studioData.members || [];
    const username   = members[index] ? members[index].username : 'this member';
    _pendingRemoveMemberIndex = index;
    const textEl = document.getElementById('mgmt-member-confirm-text');
    if (textEl) textEl.textContent = `${username} will lose access to this studio's glazes.`;
    const el = document.getElementById('mgmt-member-confirm');
    if (el) el.style.display = 'flex';
}

function cancelRemoveMember() {
    _pendingRemoveMemberIndex = null;
    const el = document.getElementById('mgmt-member-confirm');
    if (el) el.style.display = 'none';
}

function confirmRemoveMember() {
    const el = document.getElementById('mgmt-member-confirm');
    if (el) el.style.display = 'none';
    if (_pendingRemoveMemberIndex !== null) {
        removeMember(currentMgmtCode, _pendingRemoveMemberIndex);
        _pendingRemoveMemberIndex = null;
    }
}

function removeMember(code, index) {
    const key        = 'sga_studio_' + code;
    const studioData = JSON.parse(localStorage.getItem(key) || '{}');
    const members    = studioData.members || [];
    if (!members[index]) return;

    const removedUsername = members[index].username;

    // Remove from studio's member list
    members.splice(index, 1);
    studioData.members = members;
    localStorage.setItem(key, JSON.stringify(studioData));

    // Remove the studio from the member's own account
    const userKey     = 'sga_user_' + removedUsername.toLowerCase();
    const userAccount = JSON.parse(localStorage.getItem(userKey) || '{}');
    if (userAccount.studios) {
        userAccount.studios = userAccount.studios.filter(s => s.code !== code);
        localStorage.setItem(userKey, JSON.stringify(userAccount));
    }

    // If the removed user is the current session, update in-memory state
    if (currentUser && currentUser.username.toLowerCase() === removedUsername.toLowerCase()) {
        currentUser.studios = (currentUser.studios || []).filter(s => s.code !== code);
        if (activeStudioCode === code) {
            activeStudioCode = null;
            localStorage.removeItem('sga_active_studio');
            loadActiveGlazes();
        }
    }

    renderMgmtMembers(studioData);
}


// ─── Studio Glaze Management ────────────────────────────────────────────────
function renderMgmtGlazes() {
    if (!currentMgmtCode) return;
    const studioData = JSON.parse(localStorage.getItem('sga_studio_' + currentMgmtCode) || '{}');
    const glazes     = studioData.glazes || [];
    const list       = document.getElementById('mgmt-glazes-list');
    if (!list) return;

    // Only show for admins
    const section = document.getElementById('mgmt-glazes-section');
    const myStudio = currentUser && currentUser.studios
        ? currentUser.studios.find(s => s.code === currentMgmtCode)
        : null;
    const isAdmin = (myStudio && myStudio.role === 'admin') || _pendingNewStudio === currentMgmtCode;
    if (section) section.style.display = isAdmin ? 'block' : 'none';

    if (glazes.length === 0) {
        list.innerHTML = '<p style="font-size:11px;color:#c8bfb5;text-align:center;margin:0 0 12px">No glazes yet — add your first one below</p>';
        return;
    }

    list.innerHTML = glazes.map((g, i) => `
        <div class="glaze-card">
            <div class="glaze-card-swatch${g.photo ? ' has-photo' : ''}">
                ${g.photo ? `<img src="${g.photo}" alt="${g.name || 'Glaze'}">` : '<span class="glaze-swatch-placeholder">+</span>'}
                <input type="file" accept="image/*"
                    onchange="handleGlazePhoto(event,'${currentMgmtCode}',${i})">
            </div>
            <div class="glaze-card-fields">
                <input class="glaze-mini-input" type="text"
                    placeholder="Glaze name" value="${g.name || ''}"
                    oninput="updateGlazeField('${currentMgmtCode}',${i},'name',this.value)">
                <div class="glaze-field-row">
                    <input class="glaze-mini-input temp" type="text"
                        placeholder="Temp (°F)" value="${g.temp || ''}"
                        oninput="updateGlazeField('${currentMgmtCode}',${i},'temp',this.value)">
                    <input class="glaze-mini-input" type="text"
                        placeholder="Notes…" value="${g.notes || ''}"
                        oninput="updateGlazeField('${currentMgmtCode}',${i},'notes',this.value)">
                </div>
            </div>
            <button class="glaze-remove-btn" onclick="removeStudioGlaze('${currentMgmtCode}',${i})">×</button>
        </div>
    `).join('');
}

function addStudioGlaze() {
    if (!currentMgmtCode) return;
    const key        = 'sga_studio_' + currentMgmtCode;
    const studioData = JSON.parse(localStorage.getItem(key) || '{}');
    const glazes     = studioData.glazes || [];
    glazes.push({ name: '', color: '#888888', photo: null, temp: '', notes: '' });
    studioData.glazes = glazes;
    localStorage.setItem(key, JSON.stringify(studioData));
    renderMgmtGlazes();
    if (activeStudioCode === currentMgmtCode) loadActiveGlazes();
}

function updateGlazeField(code, index, field, value) {
    const key        = 'sga_studio_' + code;
    const studioData = JSON.parse(localStorage.getItem(key) || '{}');
    const glazes     = studioData.glazes || [];
    if (!glazes[index]) return;
    glazes[index][field] = value;
    studioData.glazes = glazes;
    localStorage.setItem(key, JSON.stringify(studioData));
    // Live-update swatch background for color changes
    if (field === 'color') {
        const cards = document.querySelectorAll('.glaze-card');
        if (cards[index]) cards[index].querySelector('.glaze-card-swatch').style.background = value;
    }
    // Reload mixer if this studio is active
    if (activeStudioCode === code && field === 'color') loadActiveGlazes();
}

function handleGlazePhoto(e, code, index) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-selected
    const reader = new FileReader();
    reader.onload = ev => {
        resizeImage(ev.target.result, 480, 0.82, dataURL => {
            extractAvgColor(dataURL, avgColor => {
                const key        = 'sga_studio_' + code;
                const studioData = JSON.parse(localStorage.getItem(key) || '{}');
                const glazes     = studioData.glazes || [];
                if (!glazes[index]) return;
                glazes[index].photo = dataURL;
                glazes[index].color = avgColor;
                studioData.glazes   = glazes;
                try {
                    localStorage.setItem(key, JSON.stringify(studioData));
                } catch(err) {
                    alert('Storage full — try a smaller image.');
                    return;
                }
                // Update just this swatch in-place — no full re-render
                const cards  = document.querySelectorAll('.glaze-card');
                const swatch = cards[index] && cards[index].querySelector('.glaze-card-swatch');
                if (swatch) {
                    swatch.classList.add('has-photo');
                    const old = swatch.querySelector('img, span.glaze-swatch-placeholder');
                    if (old) old.remove();
                    const img   = document.createElement('img');
                    img.src     = dataURL;
                    img.alt     = glazes[index].name || 'Glaze';
                    swatch.insertBefore(img, swatch.querySelector('input[type="file"]'));
                }
                if (activeStudioCode === code) loadActiveGlazes();
            });
        });
    };
    reader.readAsDataURL(file);
}

function removeStudioGlaze(code, index) {
    const key        = 'sga_studio_' + code;
    const studioData = JSON.parse(localStorage.getItem(key) || '{}');
    const glazes     = studioData.glazes || [];
    glazes.splice(index, 1);
    studioData.glazes = glazes;
    localStorage.setItem(key, JSON.stringify(studioData));
    renderMgmtGlazes();
    if (activeStudioCode === code) loadActiveGlazes();
}

function saveCurrentUser() {
    if (!currentUser) return;
    const key    = 'sga_user_' + currentUser.username.toLowerCase();
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    stored.studios = currentUser.studios || [];
    localStorage.setItem(key, JSON.stringify(stored));
}

function resetGlazeSelection() {
    selectedL1 = null;
    selectedL2 = null;
    mixCanvas  = null;
    activeStudioCode = null;
    _glazesDirty = true;
    const bar = document.getElementById('active-studio-bar');
    if (bar) bar.classList.remove('visible');
    if (typeof updateMixerUI === 'function') updateMixerUI();
}

function doLogout() {
    document.getElementById('profile-overlay').classList.remove('open');
    currentUser = null;
    pieces = [];
    pieceCounter = 0;
    document.getElementById('pill-avatar').textContent = '?';
    resetGlazeSelection();
    showHome();
}

function enterApp() {
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.add('hidden');

    // Load persisted pieces for this user
    loadPieces();
    renderPieces();

    // Reset glaze selection for the new session
    resetGlazeSelection();

    // Update profile pill
    // Initials: up to 2 chars from username words
    const parts    = currentUser.username.trim().split(/\s+/);
    const initials = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : currentUser.username.slice(0,2).toUpperCase();
    const pillAvatar = document.getElementById('pill-avatar');
    if (pillAvatar) pillAvatar.textContent = initials;

    // Resume canvas
    const cnv = document.querySelector('#canvas-container canvas');
    if (cnv) cnv.style.visibility = 'visible';
    _glazesDirty = true; // ensure glazes rebuild on first draw
    if (typeof loop === 'function') loop();
    if (typeof redraw === 'function') redraw();
    fitPanels();
}

// Check for existing session on load
(function checkSession() {
    const lastUser = localStorage.getItem('sga_last_user') || sessionStorage.getItem('sga_last_user');
    if (lastUser) {
        const stored = localStorage.getItem('sga_user_' + lastUser);
        if (stored) {
            const account = JSON.parse(stored);
            currentUser = { username: account.username, studios: account.studios || [] };
            // Auto-enter app — show home first so it feels intentional
        }
    }
    // Home is shown by splash sequence
})();

// ═══════════════════════════════════════════════════════
//  TINTING
// ═══════════════════════════════════════════════════════
function rgbToHsl(r, g, b) {
    const rn=r/255, gn=g/255, bn=b/255;
    const max=Math.max(rn,gn,bn), min=Math.min(rn,gn,bn);
    let h, s, l=(max+min)/2;
    if (max===min) { h=s=0; }
    else {
        const d=max-min;
        s = l>0.5 ? d/(2-max-min) : d/(max+min);
        switch(max){
            case rn: h=((gn-bn)/d+(gn<bn?6:0))/6; break;
            case gn: h=((bn-rn)/d+2)/6; break;
            case bn: h=((rn-gn)/d+4)/6; break;
        }
    }
    return [h,s,l];
}

function hslToHex(h,s,l) {
    let r,g,b;
    if (s===0) { r=g=b=l; }
    else {
        const hue2rgb=(p,q,t)=>{
            if(t<0)t+=1; if(t>1)t-=1;
            if(t<1/6) return p+(q-p)*6*t;
            if(t<1/2) return q;
            if(t<2/3) return p+(q-p)*(2/3-t)*6;
            return p;
        };
        const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
        r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
    }
    const toHex=x=>Math.round(x*255).toString(16).padStart(2,'0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function tintLogo(col) {
    const [h,s]=rgbToHsl(red(col),green(col),blue(col));
    const effS=Math.min(s*3.5,0.95);
    const stops=[0.78,0.62,0.46,0.30,0.16];
    ['logo-l5','logo-l4','logo-l3','logo-l2','logo-l1'].forEach((id,i)=>{
        const el=document.getElementById(id);
        if(el) el.setAttribute('fill',hslToHex(h,effS,stops[i]));
    });
}

function tintLogoGrey() {
    ['#ccc','#999','#666','#333','#111'].forEach((c,i)=>{
        const el=document.getElementById(['logo-l5','logo-l4','logo-l3','logo-l2','logo-l1'][i]);
        if(el) el.setAttribute('fill',c);
    });
}

function tintWordmark(col) {
    const [h,s]=rgbToHsl(red(col),green(col),blue(col));
    const hex=hslToHex(h,Math.min(s*3.5,0.95),0.28);
    document.querySelectorAll('#wordmark-svg path').forEach(p=>p.style.fill=hex);
}

function tintWordmarkGrey() {
    document.querySelectorAll('#wordmark-svg path').forEach(p=>p.style.fill='#1c1814');
}

// ── Window resize handler ────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-container');
    if (typeof resizeCanvas === 'function') {
        resizeCanvas(container.offsetWidth, container.offsetHeight);
        _recomputeLayout();
        if (typeof fitPanels === 'function') fitPanels();
        updateCarouselArrows();
    }
});

// ═══════════════════════════════════════════════════════
//  TOUCH CURSOR
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
//  LIGHTBOX
// ═══════════════════════════════════════════════════════
let lbPieceId = null;
let lbStage   = null;
let lbIndex   = 0;

function openLightbox(pieceId, stage, index) {
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece) return;
    const photos = piece.stages[stage].photos || [];
    if (!photos.length) return;

    lbPieceId = pieceId;
    lbStage   = stage;
    lbIndex   = index;

    renderLightbox(photos);
    document.getElementById('lightbox').classList.add('open');
}

function renderLightbox(photos) {
    const img     = document.getElementById('lightbox-img');
    const strip   = document.getElementById('lightbox-strip');
    const counter = document.getElementById('lightbox-counter');

    img.src = photos[lbIndex];

    strip.innerHTML = photos.map((src, i) =>
        `<img class="lightbox-thumb ${i === lbIndex ? 'active' : ''}"
            src="${src}" onclick="lbGoTo(${i})">`
    ).join('');

    counter.textContent = `${lbIndex + 1} / ${photos.length}`;
}

function deleteCurrentPhoto() {
    const piece = pieces.find(p => p.id === lbPieceId);
    if (!piece) return;
    const photos = piece.stages[lbStage].photos;
    if (!photos || !photos.length) return;

    // Remove the photo at current index
    photos.splice(lbIndex, 1);

    // Re-render the card strip in the background
    renderPieces();

    if (photos.length === 0) {
        // No photos left — close lightbox
        closeLightbox();
    } else {
        // Step back if we deleted the last item
        if (lbIndex >= photos.length) lbIndex = photos.length - 1;
        renderLightbox(photos);
    }
}

function lbGoTo(index) {
    const piece = pieces.find(p => p.id === lbPieceId);
    if (!piece) return;
    lbIndex = index;
    renderLightbox(piece.stages[lbStage].photos || []);
}

function addPhotosFromLightbox(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const piece = pieces.find(p => p.id === lbPieceId);
    if (!piece) return;
    if (!piece.stages[lbStage].photos) piece.stages[lbStage].photos = [];

    let loaded = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            piece.stages[lbStage].photos.push(ev.target.result);
            loaded++;
            if (loaded === files.length) {
                // Jump to the first newly added photo
                lbIndex = piece.stages[lbStage].photos.length - files.length;
                renderLightbox(piece.stages[lbStage].photos);
                renderPieces();
                // Reset the input so the same file can be added again if needed
                e.target.value = '';
            }
        };
        reader.readAsDataURL(file);
    });
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
    lbPieceId = null; lbStage = null; lbIndex = 0;
}

// Close lightbox on backdrop tap
document.getElementById('lightbox').addEventListener('click', function(e) {
    if (e.target === this) closeLightbox();
});

// ── Measure chrome height and apply to panels ──────────────────────────────
function fitPanels() {
    const chrome = document.getElementById('app-chrome');
    const h = chrome.getBoundingClientRect().height;
    const top = Math.ceil(h) + 8; // 8px breathing room
    document.querySelectorAll('.tab-panel').forEach(p => p.style.top = top + 'px');
}
// Run after fonts/SVGs have rendered — trigger full layout recalc so
// TILE_CY uses the correct chrome height, not the pre-font estimate from setup()
window.addEventListener('load', () => window.dispatchEvent(new Event('resize')));
fitPanels();

const cursor = document.getElementById('touch-cursor');
document.getElementById('canvas-container').addEventListener('mouseenter', () => {
    if (!document.body.classList.contains('desktop-mode')) cursor.style.display = 'block';
});
document.getElementById('canvas-container').addEventListener('mouseleave', ()=> cursor.style.display='none');

document.addEventListener('mousemove', e=>{ cursor.style.left=e.clientX+'px'; cursor.style.top=e.clientY+'px'; });
document.addEventListener('mousedown', ()=> cursor.classList.add('pressed'));
document.addEventListener('mouseup',   ()=> cursor.classList.remove('pressed'));

// Direct touch handler for profile pill — bypasses p5.js interference
document.getElementById('profile-pill').addEventListener('touchend', function(e) {
    e.preventDefault();
    openProfileOverlay();
});

// ═══════════════════════════════════════════════════════
//  DRAG-TO-DISMISS  (bottom sheet overlays)
// ═══════════════════════════════════════════════════════
function addDragToDismiss(handleEl, sheetEl, onDismiss) {
    const THRESHOLD = 120;
    const EASE = 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)';
    let startY = 0, dragY = 0, active = false;

    function snapBack() {
        sheetEl.style.transition = EASE;
        sheetEl.style.transform  = 'translateY(0)';
        sheetEl.addEventListener('transitionend', () => {
            sheetEl.style.transition = '';
            sheetEl.style.transform  = '';
        }, { once: true });
    }

    function dismiss() {
        sheetEl.style.transition = EASE;
        sheetEl.style.transform  = 'translateY(110%)';
        sheetEl.addEventListener('transitionend', () => {
            onDismiss();
            requestAnimationFrame(() => {
                sheetEl.style.transition = '';
                sheetEl.style.transform  = '';
            });
        }, { once: true });
    }

    handleEl.addEventListener('pointerdown', e => {
        active = true;
        startY = e.clientY;
        dragY  = 0;
        sheetEl.style.transition = 'none';
        handleEl.setPointerCapture(e.pointerId);
    });

    handleEl.addEventListener('pointermove', e => {
        if (!active) return;
        dragY = Math.max(0, e.clientY - startY);
        sheetEl.style.transform = `translateY(${dragY}px)`;
    });

    handleEl.addEventListener('pointerup', () => {
        if (!active) return;
        active = false;
        dragY > THRESHOLD ? dismiss() : snapBack();
    });

    handleEl.addEventListener('pointercancel', () => {
        if (!active) return;
        active = false;
        snapBack();
    });
}

addDragToDismiss(
    document.getElementById('piece-edit-sheet-handle'),
    document.getElementById('piece-edit-overlay'),
    closePieceOverlay
);

addDragToDismiss(
    document.getElementById('profile-sheet-handle'),
    document.getElementById('profile-sheet'),
    () => document.getElementById('profile-overlay').classList.remove('open')
);


// ═══════════════════════════════════════════════════════
//  DESKTOP CAROUSEL ARROWS
// ═══════════════════════════════════════════════════════
function carouselPrev() {
    if (desktopCarouselStart > 0) {
        desktopCarouselStart--;
        desktopSlideFrom      =  1; // tiles enter from the left
        desktopSlideOffset    =  1;
        desktopSlideStartTime = performance.now();
        updateCarouselArrows();
    }
}

function carouselNext() {
    if (desktopCarouselStart + 5 < studioGlazes.length) {
        desktopCarouselStart++;
        desktopSlideFrom      = -1; // tiles enter from the right
        desktopSlideOffset    = -1;
        desktopSlideStartTime = performance.now();
        updateCarouselArrows();
    }
}

function updateCarouselArrows() {
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    if (!prevBtn || !nextBtn) return;

    const isDesktop = document.body.classList.contains('desktop-mode');
    if (!isDesktop || activeTab !== 'mixer' || studioGlazes.length <= 5) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
    }

    prevBtn.style.display = 'flex';
    nextBtn.style.display = 'flex';
    prevBtn.disabled = desktopCarouselStart <= 0;
    nextBtn.disabled = desktopCarouselStart + 5 >= studioGlazes.length;

    // Position arrows flanking the centered 5-tile row
    const container = document.getElementById('canvas-container');
    if (!container) return;
    const rect        = container.getBoundingClientRect();
    const displayCount = Math.min(5, studioGlazes.length - desktopCarouselStart);
    const rowWidth    = displayCount * STEP - GAP;
    const centerX     = rect.left + width / 2;
    const arrowOffset = rowWidth / 2 + 28;
    const carouselY   = height - CAROUSEL_BOTTOM;
    const arrowTop    = rect.top + carouselY;

    prevBtn.style.left = (centerX - arrowOffset - prevBtn.offsetWidth) + 'px';
    nextBtn.style.left = (centerX + arrowOffset) + 'px';
    prevBtn.style.top  = (arrowTop - prevBtn.offsetHeight / 2) + 'px';
    nextBtn.style.top  = (arrowTop - nextBtn.offsetHeight / 2) + 'px';
}

// ═══════════════════════════════════════════════════════
//  LAYOUT TOGGLE  (dev tool — remove before launch)
// ═══════════════════════════════════════════════════════
function toggleLayout() {
    const isDesktop = document.body.classList.toggle('desktop-mode');
    document.body.classList.toggle('mobile-preview', !isDesktop);
    const btn = document.getElementById('layout-toggle');
    if (btn) btn.textContent = isDesktop ? 'Desktop View' : 'Mobile View';
    if (cursor) cursor.style.display = 'none'; // always hide until next mouseenter
    sessionStorage.setItem('sga-layout', isDesktop ? 'desktop' : 'mobile');
    // Resize canvas after the CSS transition settles (~50ms)
    setTimeout(() => {
        const container = document.getElementById('canvas-container');
        if (typeof resizeCanvas === 'function') {
            resizeCanvas(container.offsetWidth, container.offsetHeight);
            _recomputeLayout();
        }
        scrollX = 0; targetScrollX = 0;
        desktopCarouselStart = 0; desktopSlideOffset = 0; desktopSlideFrom = 0;
        fitPanels();
        updateCarouselArrows();
        if (typeof redraw === 'function') redraw();
    }, 50);
}

// Auto-init: desktop mode when viewport > 900 px, or from saved session preference
(function initLayout() {
    // Never apply desktop mode on narrow screens regardless of saved preference
    if (window.innerWidth <= 900) return;
    const saved      = sessionStorage.getItem('sga-layout');
    const useDesktop = saved ? saved === 'desktop' : true;
    if (useDesktop) {
        document.body.classList.add('desktop-mode');
        const btn = document.getElementById('layout-toggle');
        if (btn) btn.textContent = 'Desktop View';
    } else {
        document.body.classList.add('mobile-preview');
    }
})();
