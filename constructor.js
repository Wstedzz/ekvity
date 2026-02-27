// Bouquet Constructor Logic
const CONFIG = {
    phone: window.SITE_SETTINGS ? (window.SITE_SETTINGS.phone || '+380 98 048 84 37') : '+380 98 048 84 37',
    telegramUser: window.SITE_SETTINGS ? (window.SITE_SETTINGS.telegramUser || 'ekvityua') : 'ekvityua'
};

const FALLBACK_FLOWERS = [
    { id: 'f1', name: 'Троянда червона', price: 100, image: 'images/687d8a0f-db58-4a70-9af6-931e60f66504.png' },
    { id: 'f2', name: 'Орхідея фіолетова', price: 120, image: 'images/aaa5fe22-1f0e-4f23-a754-862ccff12245.png' },
    { id: 'f3', name: 'Ромашка біла', price: 40, image: 'images/220fc26c-1b8e-4fde-9517-dcd9df3ffd07.png' },
    { id: 'f4', name: 'Жоржина синя', price: 80, image: 'images/4bfe2cd1-67e0-4501-95c4-4b4795d993c6.png' },
    { id: 'f5', name: 'Соняшник', price: 70, image: 'images/4f9d9424-f9c3-487f-990e-b1836f6c46aa.png' }
];

// State
let flowers = []; // Available flowers for selection
let quantities = {}; // { flowerId: qty } - Selected quantities
let flowerPositions = []; // Array of {flowerData, hexCoords, isGhost} for current display
let dragState = null; // { draggedIndex, element, cloneElement }

function loadFlowers() {
    try {
        const stored = JSON.parse(localStorage.getItem('ekvity_constructor_flowers') || '[]');
        if (stored.length > 0) {
            flowers = stored.map(f => ({
                id: f.id,
                name: f.name,
                price: f.price,
                image: f.image // Assuming constructor flowers already have top-view or main image
            }));
            return;
        }
    } catch (e) {
        console.error('Failed to load constructor flowers:', e);
    }
    // Fallback to demo flowers
    flowers = FALLBACK_FLOWERS;
}

function renderFlowerGrid() {
    const grid = document.getElementById('flowerGrid');
    grid.innerHTML = '';
    flowers.forEach(f => {
        quantities[f.id] = quantities[f.id] || 0;
        const card = document.createElement('div');
        card.className = 'flower-card' + (quantities[f.id] > 0 ? ' selected' : '');
        card.id = 'card-' + f.id;
        card.innerHTML = `
            <img src="${f.image}" alt="${f.name}" class="flower-card-img" loading="lazy">
            <p class="flower-card-name">${f.name}</p>
            <p class="flower-card-price">${f.price} грн/шт</p>
            <div class="qty-controls">
                <button class="qty-btn" onclick="changeQty('${f.id}', -1)">−</button>
                <span class="qty-value" id="qty-${f.id}">${quantities[f.id]}</span>
                <button class="qty-btn" onclick="changeQty('${f.id}', 1)">+</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.changeQty = function (id, delta) {
    if (delta > 0) {
        const currentTotal = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
        if (currentTotal >= 85) {
            return; // Hard stop at max flowers
        }
    }

    const newQty = Math.max(0, (quantities[id] || 0) + delta);
    quantities[id] = newQty;

    const qtyEl = document.getElementById('qty-' + id);
    if (qtyEl) qtyEl.textContent = newQty;

    const card = document.getElementById('card-' + id);
    if (card) {
        card.classList.toggle('selected', newQty > 0);
    }

    updateSummary();
}

function getSelected() {
    return flowers.filter(f => quantities[f.id] > 0).map(f => ({
        ...f,
        qty: quantities[f.id],
        subtotal: f.price * quantities[f.id]
    }));
}

function getWrapping() {
    const checked = document.querySelector('input[name="wrapping"]:checked');
    return {
        name: checked.dataset.name,
        price: parseInt(checked.value)
    };
}

// === HEXAGONAL LAYOUT FUNCTIONS ===

/**
 * Calculate hexagon position in pixels from axial coordinates (q, r)
 * Using flat-top hexagon orientation
 */
function calculateHexPosition(q, r, hexSize, centerX, centerY) {
    const sqrt3 = Math.sqrt(3);
    const x = centerX + hexSize * (sqrt3 * q + sqrt3 / 2 * r);
    const y = centerY + hexSize * (3 / 2 * r);
    return { x, y };
}

/**
 * Generate axial coordinates for honeycomb rings up to a total number of spots.
 * Ring 0: 1 hex (center)
 * Ring 1: 6 hexes
 * Ring 2: 12 hexes
 * Ring n: 6*n hexes
 */
function getHexCoordinatesForSpots(totalSpotsCount) {
    const coords = [];
    if (totalSpotsCount === 0) return [];

    // Center hex for the first spot
    coords.push({ q: 0, r: 0, ring: 0, posInRing: 0 });

    // Generate rings outward for the remaining spots
    let ring = 1;
    let currentCount = 1; // Already added the center hex

    while (currentCount < totalSpotsCount) {
        // Start at (q,r) for this ring and move clockwise
        let q = ring;
        let r = 0;

        // Directions for traversing ring starting from (ring, 0) in axial coords
        const directions = [
            { dq: 0, dr: -1 },   // toward (ring, -ring)
            { dq: -1, dr: 0 },   // toward (0, -ring)
            { dq: -1, dr: 1 },   // toward (-ring, 0)
            { dq: 0, dr: 1 },    // toward (-ring, ring)
            { dq: 1, dr: 0 },    // toward (0, ring)
            { dq: 1, dr: -1 }    // back toward (ring, 0)
        ];

        for (let dir = 0; dir < 6; dir++) {
            for (let step = 0; step < ring; step++) {
                if (currentCount >= totalSpotsCount) break;
                coords.push({ q, r, ring, posInRing: currentCount });
                q += directions[dir].dq;
                r += directions[dir].dr;
                currentCount++;
            }
            if (currentCount >= totalSpotsCount) break;
        }
        ring++;
    }

    return coords;
}

/**
 * Calculate optimal hex size for given total coordinates (real + ghosts).
 * Ensures all hexagons fit within the container's max radius.
 */
function calculateOptimalHexSize(allCoords) {
    const containerSize = 220;
    const maxContainerRadius = (containerSize / 2) - 10; // Allow some padding (10px from edge)

    // Find max ring among ALL hexagons (real + ghosts)
    const maxRing = Math.max(0, ...allCoords.map(c => c.ring));

    // Prevent zoom-in too much when there are few items to avoid giant hexes initially
    const effectiveMaxRing = Math.max(2, maxRing);

    // HexSize is determined by the outermost ring
    const requiredHexSize = Math.floor(maxContainerRadius / (effectiveMaxRing * 1.9));

    const hexSize = Math.min(Math.max(requiredHexSize, 8), 28); // Add max cap of 28
    const hexWidth = Math.max(Math.floor(hexSize * 2), 14); // Min 14px visual width

    return { hexSize, hexWidth };
}

/**
 * Create hexagon element (real flower or ghost)
 */
function createHexagon(item, index, hexSize, hexWidth) {
    const containerSize = 220;
    const centerX = containerSize / 2;
    const centerY = containerSize / 2;

    const pos = calculateHexPosition(item.hexCoords.q, item.hexCoords.r, hexSize, centerX, centerY);

    const hex = document.createElement('div');
    hex.className = 'hexagon-flower' + (item.isGhost ? ' ghost' : '');
    hex.dataset.index = index; // The index in the flowerPositions array
    hex.dataset.q = item.hexCoords.q;
    hex.dataset.r = item.hexCoords.r;
    hex.style.width = hexWidth + 'px';
    hex.style.height = hexWidth + 'px';
    hex.style.left = (pos.x - hexWidth / 2) + 'px';
    hex.style.top = (pos.y - hexWidth / 2) + 'px';
    hex.title = item.isGhost ? 'Порожнє місце' : item.name;

    if (!item.isGhost) {
        // Hexagon shape using clip-path
        hex.style.clipPath = 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)';

        // Image inside for real flowers
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = item.name;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.pointerEvents = 'none'; // Prevent dragging image itself
        img.draggable = false;
        hex.appendChild(img);
    } else {
        hex.style.clipPath = 'none';
        hex.style.backgroundColor = 'transparent'; // Fix for black backgrounds from CSS class

        // Ghost hexagon - SVG hexagon outline (clip-path hides borders, so we use SVG)
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';

        const polygon = document.createElementNS(svgNS, 'polygon');
        polygon.setAttribute('points', '50,2 95,27 95,73 50,98 5,73 5,27');
        polygon.setAttribute('fill', 'none');
        polygon.setAttribute('stroke', 'rgba(212, 163, 115, 0.4)');
        polygon.setAttribute('stroke-width', '2');
        polygon.setAttribute('stroke-dasharray', '5,3');
        svg.appendChild(polygon);
        hex.appendChild(svg);
    }

    return hex;
}

/**
 * Make hexagon draggable with swap functionality
 */
function makeHexDraggable(element, index, allHexElements, hexSize, hexWidth) {
    let isDragging = false;
    let startX, startY;
    let startLeft, startTop;
    let clone = null;
    let initialIndex = index; // The original index of the dragged element
    let currentHoveredIndex = -1;
    let cachedCenters = [];
    let rafId = null;

    function getEventCoords(e) {
        return e.touches ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : e;
    }

    function getHexCenterInContainer(hexElement) {
        const rect = hexElement.getBoundingClientRect();
        const parentRect = hexElement.parentElement.getBoundingClientRect();
        return {
            x: (rect.left - parentRect.left) + hexWidth / 2,
            y: (rect.top - parentRect.top) + hexWidth / 2,
        };
    }

    function onStart(e) {
        const item = flowerPositions[index];
        if (item.isGhost) return; // Cannot drag ghost hexagons

        e.preventDefault();
        isDragging = true;

        // Highlight original
        element.style.filter = 'drop-shadow(0 0 10px gold) sepia(0.5) hue-rotate(-30deg)';
        element.style.zIndex = '9999';

        const coords = getEventCoords(e);
        startX = coords.clientX;
        startY = coords.clientY;

        // Pre-calculate all target centers to prevent layout thrashing during mouse move
        cachedCenters = allHexElements.map(hex => {
            const r = hex.getBoundingClientRect();
            return {
                x: r.left + r.width / 2,
                y: r.top + r.height / 2
            };
        });

        // Create visual clone for dragging
        const rect = element.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;

        clone = element.cloneNode(true);
        clone.style.position = 'fixed'; // Position clone relative to viewport
        clone.style.left = startLeft + 'px';
        clone.style.top = startTop + 'px';
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.opacity = '0.8';
        clone.style.pointerEvents = 'none'; // Clone should not interfere with mouse events
        clone.style.zIndex = '10000';
        clone.style.transition = 'none'; // Disable transition during drag
        document.body.appendChild(clone);

        // Make original semi-transparent
        element.style.opacity = '0.3';
    }

    function onMove(e) {
        if (!isDragging || !clone) return;
        e.preventDefault();

        const coords = getEventCoords(e);

        if (rafId) cancelAnimationFrame(rafId);

        rafId = requestAnimationFrame(() => {
            if (!isDragging || !clone) return;

            const dx = coords.clientX - startX;
            const dy = coords.clientY - startY;

            clone.style.left = (startLeft + dx) + 'px';
            clone.style.top = (startTop + dy) + 'px';

            const cloneCenter = {
                x: coords.clientX,
                y: coords.clientY
            };

            // Find CLOSEST hex instead of all within threshold using cached centers
            let closestIndex = -1;
            let closestDist = Infinity;

            cachedCenters.forEach((otherCenter, otherIndex) => {
                if (otherIndex === initialIndex) return;

                const dist = Math.sqrt(
                    Math.pow(cloneCenter.x - otherCenter.x, 2) +
                    Math.pow(cloneCenter.y - otherCenter.y, 2)
                );

                if (dist < closestDist && dist < hexWidth * 1.2) {
                    closestDist = dist;
                    closestIndex = otherIndex;
                }
            });

            // Clear all hover states
            allHexElements.forEach(hex => hex.classList.remove('hovered-target'));

            // Set hover on closest only
            if (closestIndex !== -1) {
                allHexElements[closestIndex].classList.add('hovered-target');
            }

            currentHoveredIndex = closestIndex;
        });
    }

    function onEnd(e) {
        if (!isDragging) return;
        e.preventDefault();

        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }

        isDragging = false;

        // Remove clone
        if (clone) {
            clone.remove();
            clone = null;
        }

        // Restore original element styles
        element.style.opacity = '1';
        element.style.filter = '';
        element.style.zIndex = '';

        // Clear all hovered targets
        allHexElements.forEach(hex => {
            hex.classList.remove('hovered-target');
        });

        // Perform swap if target found and it's not the original position
        if (currentHoveredIndex !== -1 && currentHoveredIndex !== initialIndex) {
            // Can drop on a real flower or a ghost hexagon
            swapFlowers(initialIndex, currentHoveredIndex);
        } else {
            // If dropped nowhere or on itself, just re-render to reset visual state
            updateSummary();
        }

        currentHoveredIndex = -1; // Reset
    }

    // Mouse events
    element.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    // Touch events
    element.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: false });

    // Visual feedback
    element.style.cursor = 'grab';
}

/**
 * Swap two flowers in the flowerPositions array and update display
 */
function swapFlowers(index1, index2) {
    if (index1 === index2) return;

    console.log('Swapping:', index1, index2, {
        item1: flowerPositions[index1],
        item2: flowerPositions[index2]
    });

    // Swap hexCoords between the two items so their visual positions swap
    const tempCoords = flowerPositions[index1].hexCoords;
    flowerPositions[index1].hexCoords = flowerPositions[index2].hexCoords;
    flowerPositions[index2].hexCoords = tempCoords;

    // Swap the entire flowerPosition objects, including flowerData, hexCoords, isGhost
    const temp = flowerPositions[index1];
    flowerPositions[index1] = flowerPositions[index2];
    flowerPositions[index2] = temp;

    // Re-render to reflect the new positions visually
    updateSummary();
}

function updateSummary() {
    const selected = getSelected();
    const wrapping = getWrapping();

    // Build list of individual flowers
    const individualFlowers = [];
    selected.forEach(f => {
        for (let i = 0; i < f.qty; i++) {
            individualFlowers.push(f);
        }
    });

    const preview = document.getElementById('circlePreview');
    const placeholder = document.getElementById('circlePlaceholder');

    // Show/hide placeholder
    placeholder.style.display = selected.length === 0 ? 'block' : 'none';

    // Remove old hexagons
    preview.querySelectorAll('.hexagon-flower').forEach(el => el.remove());

    const numRealFlowers = individualFlowers.length;

    // --- State-Preserving Update ---

    // 1. Match individualFlowers to existing real flowers in flowerPositions
    let currentRealFlowers = flowerPositions.filter(f => !f.isGhost);
    let remainingOldReals = [...currentRealFlowers];
    let newRealsToAdd = [];
    let matchedReals = [];

    individualFlowers.forEach(f => {
        const index = remainingOldReals.findIndex(oldF => oldF.id === f.id);
        if (index !== -1) {
            matchedReals.push(remainingOldReals[index]);
            remainingOldReals.splice(index, 1);
        } else {
            newRealsToAdd.push(f);
        }
    });

    // 2. Convert removed flowers back to ghosts
    flowerPositions.forEach(item => {
        if (!item.isGhost && remainingOldReals.includes(item)) {
            item.isGhost = true;
            item.id = `ghost-${item.hexCoords.q}-${item.hexCoords.r}`;
            item.name = 'Порожнє місце';
            item.image = '';
            item.price = 0;
            item.qty = 0;
        }
    });

    // Calculate ring and true physical distance for each current spot to form circular shapes
    flowerPositions.forEach(item => {
        const q = item.hexCoords.q;
        const r = item.hexCoords.r;
        item.ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
        item.distanceSq = q * q + q * r + r * r;
    });

    // 3. Determine required grid size (Circular & Max Limit Aware)
    // Generate a large pool of coordinates
    let poolCoords = getHexCoordinatesForSpots(300);
    poolCoords.forEach(hc => {
        hc.ring = Math.max(Math.abs(hc.q), Math.abs(hc.r), Math.abs(hc.q + hc.r));
        hc.distanceSq = hc.q * hc.q + hc.q * hc.r + hc.r * hc.r;
    });
    // Sort pool by circular distance to maintain round shape
    poolCoords.sort((a, b) => a.distanceSq - b.distanceSq);

    const maxFlowersLimit = 85;
    let padding = 12; // Normal padding of empty spots
    if (numRealFlowers >= maxFlowersLimit - 4) {
        padding = 0; // Remove all padding ghosts when full or nearly full so it fits tightly
    } else if (numRealFlowers > 50) {
        padding = 4; // Less padding for large bouquets to prevent zoom-out
    }

    let targetSpotsCount = Math.max(19, numRealFlowers + padding);

    // Maintain symmetry by keeping all hexes at the edge's distance
    let maxDistSq = poolCoords[targetSpotsCount - 1].distanceSq;
    let desCoords = poolCoords.filter(hc => hc.distanceSq <= maxDistSq);

    // If symmetry rule adds way too many spots, strict slice it to save space
    if (desCoords.length > targetSpotsCount + 6) {
        desCoords = poolCoords.slice(0, targetSpotsCount);
    }

    // 4. Build final positions array, keeping existing matches and adding new ghosts
    let finalPositions = [];
    desCoords.forEach(hc => {
        let existingItem = flowerPositions.find(p => p.hexCoords.q === hc.q && p.hexCoords.r === hc.r);
        if (existingItem) {
            finalPositions.push(existingItem);
        } else {
            finalPositions.push({
                id: `ghost-${hc.q}-${hc.r}`,
                name: 'Порожнє місце',
                image: '',
                price: 0,
                qty: 0,
                hexCoords: hc,
                isGhost: true,
                ring: hc.ring !== undefined ? hc.ring : Math.max(Math.abs(hc.q), Math.abs(hc.r), Math.abs(hc.q + hc.r)),
                distanceSq: hc.q * hc.q + hc.q * hc.r + hc.r * hc.r
            });
        }
    });

    // Handle any real flowers that were dragged way outside the new boundary
    flowerPositions.forEach(item => {
        if (!item.isGhost && !finalPositions.includes(item)) {
            finalPositions.push(item);
        }
    });

    flowerPositions = finalPositions;

    // 5. Place new items in the closest available ghosts (by physical circular distance)
    let availableGhosts = flowerPositions.filter(f => f.isGhost).sort((a, b) => a.distanceSq - b.distanceSq);
    newRealsToAdd.forEach(f => {
        let ghost = availableGhosts.shift();
        if (ghost) {
            ghost.isGhost = false;
            ghost.id = f.id;
            ghost.name = f.name;
            ghost.price = f.price;
            ghost.image = f.image;
            ghost.qty = f.qty;
            ghost.subtotal = f.subtotal;
        }
    });

    // 5.5 GRAVITY: Auto-format to pull outer flowers into inner gaps using circular distance
    let availableGhostsForGravity = flowerPositions.filter(f => f.isGhost).sort((a, b) => a.distanceSq - b.distanceSq);
    let realFlowersForGravity = flowerPositions.filter(f => !f.isGhost).sort((a, b) => b.distanceSq - a.distanceSq);

    for (let i = 0; i < realFlowersForGravity.length; i++) {
        let outerF = realFlowersForGravity[i];
        if (availableGhostsForGravity.length > 0 && availableGhostsForGravity[0].distanceSq < outerF.distanceSq) {
            let innerGhost = availableGhostsForGravity.shift();

            // Move outer flower data to the inner ghost spot
            innerGhost.isGhost = false;
            innerGhost.id = outerF.id;
            innerGhost.name = outerF.name;
            innerGhost.price = outerF.price;
            innerGhost.image = outerF.image;
            innerGhost.qty = outerF.qty;
            innerGhost.subtotal = outerF.subtotal;

            // Turn outer spot into a ghost
            outerF.isGhost = true;
            outerF.id = `ghost-${outerF.hexCoords.q}-${outerF.hexCoords.r}`;
            outerF.name = 'Порожнє місце';
            outerF.image = '';
            outerF.price = 0;
            outerF.qty = 0;
            outerF.subtotal = 0;

            // Re-queue the newly created outer ghost and sort
            availableGhostsForGravity.push(outerF);
            availableGhostsForGravity.sort((a, b) => a.distanceSq - b.distanceSq);
        }
    }

    // --- End State-Preserving Update ---

    // 6. Calculate sizing
    const sizing = calculateOptimalHexSize(flowerPositions.map(fp => fp.hexCoords));

    // 6. Create hex elements
    const hexElements = [];
    flowerPositions.forEach((item, i) => {
        const hex = createHexagon(item, i, sizing.hexSize, sizing.hexWidth);
        hexElements.push(hex);
        preview.appendChild(hex);
    });

    hexElements.forEach((hex, i) => {
        makeHexDraggable(hex, i, hexElements, sizing.hexSize, sizing.hexWidth);
    });

    // 7. Update summary UI
    const listEl = document.getElementById('selectedList');
    if (selected.length === 0) {
        listEl.innerHTML = '<p style="color: var(--text-dim); font-size: 0.85rem; text-align: center; padding: 10px 0;">Ще нічого не обрано</p>';
    } else {
        listEl.innerHTML = selected.map(f =>
            `<div class="selected-item">
                <span class="selected-item-name">${f.qty}× ${f.name}</span>
                <span class="selected-item-subtotal">${f.subtotal} грн</span>
            </div>`
        ).join('');
    }

    const flowersTotal = selected.reduce((s, f) => s + f.subtotal, 0);
    const total = flowersTotal + wrapping.price;

    const totalEl = document.getElementById('totalPrice');
    const mobileTotalEl = document.getElementById('mobileTotalPrice');
    totalEl.textContent = total + ' грн';
    mobileTotalEl.textContent = total + ' грн';

    totalEl.classList.remove('shimmer');
    void totalEl.offsetWidth;
    totalEl.classList.add('shimmer');

    // Limits Validation
    const minFlowers = 5;
    const maxFlowers = 85;
    const warningEl = document.getElementById('limitWarning');
    const mobileWarningEl = document.getElementById('mobileLimitWarning');
    let warningText = '';
    let canOrder = true;

    if (numRealFlowers === 0) {
        canOrder = false;
        warningText = 'Оберіть квіти';
    } else if (numRealFlowers < minFlowers) {
        canOrder = false;
        warningText = `Мінімум ${minFlowers} квітів (ще ${minFlowers - numRealFlowers})`;
    } else if (numRealFlowers > maxFlowers) {
        canOrder = false;
        warningText = `Максимум ${maxFlowers} квітів`;
    }

    if (warningEl && mobileWarningEl) {
        if (warningText && numRealFlowers > 0) {
            warningEl.textContent = warningText;
            warningEl.style.display = 'block';
            mobileWarningEl.textContent = warningText;
            mobileWarningEl.style.display = 'block';
        } else {
            warningEl.style.display = 'none';
            mobileWarningEl.style.display = 'none';
        }
    }

    document.getElementById('btnOrderBouquet').disabled = !canOrder;
    document.getElementById('mobileBtnOrder').disabled = !canOrder;

    console.log('Total individual flowers:', numRealFlowers, 'Total hexagons:', flowerPositions.length);
}

window.orderBouquet = function () {
    const selected = getSelected();
    if (selected.length === 0) return;

    const wrapping = getWrapping();
    const cardMsg = document.getElementById('cardMessage').value.trim();
    const flowersTotal = selected.reduce((s, f) => s + f.subtotal, 0);
    const total = flowersTotal + wrapping.price;

    // Build message
    let lines = ['Вітаю! Хочу замовити букет:'];
    selected.forEach(f => {
        lines.push(`${f.qty}x ${f.name} — ${f.subtotal} грн`);
    });
    lines.push(`Упаковка: ${wrapping.name} (+${wrapping.price} грн)`);
    if (cardMsg) lines.push(`Листівка: ${cardMsg}`);
    lines.push(`Разом: ${total} грн`);
    const message = lines.join('\n');
    const encoded = encodeURIComponent(message);

    // Modal
    const modal = document.getElementById('orderModal');
    const details = document.getElementById('modalProductDetails');
    details.innerHTML = `<h4>Ваш букет</h4><p style="white-space: pre-line; text-align: left; font-size: 0.85rem; color: var(--text-dim); line-height: 1.6;">${message}</p>`;

    const tgLink = `https://t.me/${CONFIG.telegramUser}?text=${encoded}`;
    const phoneClean = CONFIG.phone.replace('+', '');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const vbLink = isMobile
        ? `viber://add?number=${phoneClean}`
        : `viber://chat?number=%2B${phoneClean}&text=${encoded}`;

    document.getElementById('btnTelegram').href = tgLink;
    document.getElementById('btnViber').href = vbLink;

    modal.classList.add('open');
}

window.closeModal = function () {
    document.getElementById('orderModal').classList.remove('open');
};

// Mobile menu
window.toggleMenu = function () {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('open');
    document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
};

// =============================================
// TUTORIAL
// =============================================

const TOUR_STEPS = [
    {
        targetId: 'flowerGrid',
        title: 'Оберіть квіти 🌸',
        text: 'Натискайте «+», щоб додати квітку до букету. Можна обрати кілька видів.',
        position: 'bottom',
    },
    {
        targetSelector: '.flower-card:first-child .qty-btn:last-child',
        title: 'Кількість',
        text: 'Збільшуйте або зменшуйте кількість — букет будується в реальному часі.',
        position: 'bottom',
    },
    {
        targetId: 'circlePreview',
        title: 'Ваш букет 🍯',
        text: 'Тут з\'являються квіти. Їх можна перетягувати місцями — влаштуй свою композицію.',
        position: 'bottom',
    },
    {
        targetSelector: '.wrapping-section',
        title: 'Упаковка',
        text: 'Оберіть тип упаковки — від крафт-паперу до преміум-варіанту.',
        position: 'top',
    },
    {
        targetId: 'mobileBottomBar',
        targetIdDesktop: 'btnOrderBouquet',
        title: 'Замовити 💐',
        text: 'Коли букет готовий — натискай «Замовити» і надішли нам у зручний месенджер.',
        position: 'top',
        isLast: true,
    },
];

let tourStep = 0;
let tourOverlay = null;
let tourBox = null;
let tourHighlight = null;

function getTargetEl(step) {
    if (step.targetId) {
        // On desktop use alternate target if defined
        const isMobile = window.innerWidth <= 768;
        if (!isMobile && step.targetIdDesktop) {
            return document.getElementById(step.targetIdDesktop);
        }
        return document.getElementById(step.targetId);
    }
    if (step.targetSelector) {
        return document.querySelector(step.targetSelector);
    }
    return null;
}

function positionTourBox(el, preferredPosition) {
    const MARGIN = 14;
    const PAD = 6;
    const rect = el.getBoundingClientRect();
    const boxW = Math.min(300, window.innerWidth - 32);
    tourBox.style.width = boxW + 'px';
    // Force layout so offsetHeight is accurate
    tourBox.style.visibility = 'hidden';
    tourBox.style.display = 'block';
    const boxH = tourBox.offsetHeight || 160;
    tourBox.style.visibility = '';

    const highlightBottom = rect.bottom + PAD;
    const highlightTop = rect.top - PAD;
    const spaceBelow = window.innerHeight - highlightBottom - MARGIN;
    const spaceAbove = highlightTop - MARGIN;

    // Auto-pick position: prefer requested, fallback if no space
    let position = preferredPosition;
    if (position === 'bottom' && spaceBelow < boxH) position = 'top';
    if (position === 'top' && spaceAbove < boxH) position = 'bottom';
    // Last resort: just center in viewport
    if (position === 'bottom' && spaceBelow < boxH && position === 'top' && spaceAbove < boxH) {
        position = 'center';
    }

    let top, left;

    if (position === 'bottom') {
        top = highlightBottom + MARGIN;
        left = rect.left + rect.width / 2 - boxW / 2;
    } else if (position === 'top') {
        top = highlightTop - boxH - MARGIN;
        left = rect.left + rect.width / 2 - boxW / 2;
    } else if (position === 'left') {
        top = rect.top + rect.height / 2 - boxH / 2;
        left = rect.left - boxW - PAD - MARGIN;
        // Fallback to bottom if no space on left
        if (left < 16) {
            top = highlightBottom + MARGIN;
            left = rect.left + rect.width / 2 - boxW / 2;
        }
    } else {
        // center
        top = window.innerHeight / 2 - boxH / 2;
        left = window.innerWidth / 2 - boxW / 2;
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(left, window.innerWidth - boxW - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - boxH - 16));

    tourBox.style.left = left + 'px';
    tourBox.style.top = top + 'px';
}

function placeHighlightAndBox(el, position) {
    const r = el.getBoundingClientRect();
    const PAD = 6;
    const x = r.left - PAD;
    const y = r.top - PAD;
    const w = r.width + PAD * 2;
    const h = r.height + PAD * 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Update 4 shade panels around the cutout
    const top    = document.getElementById('tour-shade-top');
    const bottom = document.getElementById('tour-shade-bottom');
    const left   = document.getElementById('tour-shade-left');
    const right  = document.getElementById('tour-shade-right');

    // top/bottom: full width — no gaps in corners
    // left/right: only the middle strip between top and bottom panels
    if (top)    { top.style.left    = '0'; top.style.top    = '0';         top.style.width    = vw+'px'; top.style.height = y+'px'; }
    if (bottom) { bottom.style.left = '0'; bottom.style.top = (y+h)+'px';  bottom.style.width = vw+'px'; bottom.style.height = (vh-y-h)+'px'; }
    if (left)   { left.style.left   = '0'; left.style.top   = y+'px';      left.style.width   = x+'px';  left.style.height = h+'px'; }
    if (right)  { right.style.left  = (x+w)+'px'; right.style.top = y+'px'; right.style.width = (vw-x-w)+'px'; right.style.height = h+'px'; }

    // Highlight border
    tourHighlight.style.display = 'block';
    tourHighlight.style.left  = x + 'px';
    tourHighlight.style.top   = y + 'px';
    tourHighlight.style.width = w + 'px';
    tourHighlight.style.height= h + 'px';

    positionTourBox(el, position);
}

function renderTourStep() {
    if (!tourOverlay) return;
    const step = TOUR_STEPS[tourStep];
    const el = getTargetEl(step);

    // Update text
    tourBox.querySelector('.tour-title').textContent = step.title;
    tourBox.querySelector('.tour-text').textContent = step.text;
    tourBox.querySelector('.tour-counter').textContent = `${tourStep + 1} / ${TOUR_STEPS.length}`;
    const nextBtn = tourBox.querySelector('.tour-next');
    nextBtn.textContent = tourStep < TOUR_STEPS.length - 1 ? 'Далі →' : 'Готово ✓';

    if (!el) {
        tourHighlight.style.display = 'none';
        tourBox.style.top = '50%';
        tourBox.style.left = '50%';
        tourBox.style.transform = 'translate(-50%, -50%)';
        return;
    }

    tourBox.style.transform = '';

    // Hide highlight while scrolling
    tourHighlight.style.display = 'none';

    const r = el.getBoundingClientRect();
    const inView = r.top >= 0 && r.bottom <= window.innerHeight;

    if (inView) {
        placeHighlightAndBox(el, step.position);
    } else {
        // Instant scroll (no smooth — avoids the element being off-screen after timeout)
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        // rAF x2 ensures layout is settled after scroll
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!tourOverlay) return;
            placeHighlightAndBox(el, step.position);
        }));
    }
}

function startTour() {
    if (tourOverlay) return;
    tourStep = 0;

    // 4-panel overlay (top/bottom/left/right around highlight — true cutout)
    tourOverlay = document.createElement('div');
    tourOverlay.id = 'tourOverlay';
    tourOverlay.style.cssText = `position: fixed; inset: 0; z-index: 10000; pointer-events: none;`;

    ['tour-shade-top','tour-shade-bottom','tour-shade-left','tour-shade-right'].forEach(id => {
        const shade = document.createElement('div');
        shade.id = id;
        shade.style.position = 'fixed';
        shade.style.background = 'rgba(0,0,0,0.78)';
        shade.style.zIndex = '10000';
        shade.style.pointerEvents = 'none';
        shade.style.transition = 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease';
        tourOverlay.appendChild(shade);
    });

    // Highlight border only (no box-shadow — element inside is fully visible)
    tourHighlight = document.createElement('div');
    tourHighlight.style.cssText = `
        position: fixed; z-index: 10001; display: none;
        border: 2px solid rgba(212,163,115,0.9);
        border-radius: 8px;
        pointer-events: none;
        transition: all 0.25s ease;
    `;

    // Tooltip box
    tourBox = document.createElement('div');
    tourBox.style.cssText = `
        position: fixed; z-index: 10002;
        background: #111;
        border: 1px solid rgba(212,163,115,0.4);
        padding: 20px;
        border-radius: 4px;
        pointer-events: all;
        transition: top 0.3s ease, left 0.3s ease;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    `;
    tourBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span class="tour-title" style="font-family:'Playfair Display',serif; font-size:1rem; color:#fff; font-style:italic;"></span>
            <span class="tour-counter" style="font-size:0.65rem; letter-spacing:2px; color:rgba(255,255,255,0.3);"></span>
        </div>
        <p class="tour-text" style="font-size:0.82rem; color:rgba(255,255,255,0.6); line-height:1.6; margin-bottom:18px;"></p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <button class="tour-skip" style="background:none; border:none; color:rgba(255,255,255,0.25); font-size:0.7rem; letter-spacing:1px; cursor:pointer; text-transform:uppercase; font-family:'Montserrat',sans-serif;">Пропустити</button>
            <button class="tour-next" style="background:rgba(212,163,115,0.15); border:1px solid rgba(212,163,115,0.5); color:#d4a373; font-size:0.72rem; letter-spacing:2px; text-transform:uppercase; padding:8px 16px; cursor:pointer; font-family:'Montserrat',sans-serif; transition:background 0.2s;"></button>
        </div>
    `;

    tourBox.querySelector('.tour-next').addEventListener('mouseenter', function() {
        this.style.background = 'rgba(212,163,115,0.28)';
    });
    tourBox.querySelector('.tour-next').addEventListener('mouseleave', function() {
        this.style.background = 'rgba(212,163,115,0.15)';
    });

    tourBox.querySelector('.tour-next').addEventListener('click', () => {
        if (tourStep < TOUR_STEPS.length - 1) {
            tourStep++;
            renderTourStep();
        } else {
            endTour(true);
        }
    });

    tourBox.querySelector('.tour-skip').addEventListener('click', () => endTour(false));

    document.body.appendChild(tourOverlay);
    document.body.appendChild(tourHighlight);
    document.body.appendChild(tourBox);

    // Block scroll on body during tour
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    renderTourStep();
}

function endTour(completed) {
    if (tourOverlay) { tourOverlay.remove(); tourOverlay = null; }
    if (tourHighlight) { tourHighlight.remove(); tourHighlight = null; }
    if (tourBox) { tourBox.remove(); tourBox = null; }
    // Restore scroll
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    localStorage.setItem('ekvity_tour_done', '1');

    if (completed) {
        pulseFirstAddButton();
    }
}

function pulseFirstAddButton() {
    // Scroll to flower grid
    const grid = document.getElementById('flowerGrid');
    if (!grid) return;
    grid.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Find first + button
    const firstPlus = grid.querySelector('.qty-btn:last-child');
    if (!firstPlus) return;

    // Inject pulse keyframe if not already there
    if (!document.getElementById('tour-pulse-style')) {
        const style = document.createElement('style');
        style.id = 'tour-pulse-style';
        style.textContent = `
            @keyframes tourPulse {
                0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(212,163,115,0.7); }
                40%  { transform: scale(1.35); box-shadow: 0 0 0 10px rgba(212,163,115,0); }
                70%  { transform: scale(1.15); box-shadow: 0 0 0 0 rgba(212,163,115,0); }
                100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(212,163,115,0); }
            }
            .tour-pulse-btn {
                animation: tourPulse 0.7s ease 3;
                border-color: rgba(212,163,115,0.9) !important;
                background: rgba(212,163,115,0.15) !important;
                color: #d4a373 !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Wait for scroll to settle, then pulse
    setTimeout(() => {
        firstPlus.classList.add('tour-pulse-btn');
        firstPlus.addEventListener('animationend', () => {
            firstPlus.classList.remove('tour-pulse-btn');
        }, { once: true });
    }, 500);
}

function injectTourButton() {
    const btn = document.createElement('button');
    btn.id = 'tourHelpBtn';
    btn.title = 'Показати підказки';
    btn.innerHTML = '?';
    btn.style.cssText = `
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(212,163,115,0.12);
        border: 1px solid rgba(212,163,115,0.35);
        color: #d4a373;
        font-size: 1rem;
        font-family: 'Playfair Display', serif;
        font-style: italic;
        cursor: pointer;
        z-index: 999;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(212,163,115,0.25)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(212,163,115,0.12)');
    btn.addEventListener('click', startTour);
    document.body.appendChild(btn);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadFlowers();
    renderFlowerGrid();
    updateSummary();

    fetchSupabaseData();

    // Wrapping change listener
    document.querySelectorAll('input[name="wrapping"]').forEach(r => {
        r.addEventListener('change', updateSummary);
    });

    // Modal close on overlay click
    document.getElementById('orderModal').addEventListener('click', (e) => {
        if (e.target.id === 'orderModal') closeModal();
    });

    // Tour button always visible
    injectTourButton();

    // Auto-start tour on first visit
    if (!localStorage.getItem('ekvity_tour_done')) {
        setTimeout(startTour, 800);
    }
});

async function fetchSupabaseData() {
    if (!window.supabase) return;
    try {
        const { data, error } = await supabase.from('constructor_flowers').select('*');
        if (!error && data && data.length > 0) {
            flowers = data.map(f => ({
                id: f.id,
                name: f.name,
                price: parseFloat(f.price),
                image: f.image // Assuming constructor flowers already have top-view or main image
            }));
            localStorage.setItem('ekvity_constructor_flowers', JSON.stringify(flowers));
            renderFlowerGrid();
            updateSummary();
        }
    } catch (e) {
        console.error('Failed to load constructor flowers from Supabase', e);
    }
}
