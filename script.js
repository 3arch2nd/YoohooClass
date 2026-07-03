document.addEventListener('DOMContentLoaded', () => {
    const MASTER_GAS_URL = 'https://script.google.com/macros/s/AKfycbzrrvuMcbPhOpAVfrSAPZkGaUTN7J8oUSvpRcvF0omp6888A9Q4NXKHOnmaklSvEn5SxA/exec';
    const urlParams = new URLSearchParams(window.location.search);
    const connectedSheetId = urlParams.get('sheet');

    if (!connectedSheetId) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
        document.getElementById('start-app-btn').addEventListener('click', () => {
            const inputUrl = document.getElementById('welcome-sheet-url').value.trim();
            const match = inputUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match) {
                window.location.href = window.location.origin + window.location.pathname + '?sheet=' + match[1];
            } else {
                alert('올바른 구글 시트 주소가 아닙니다.');
            }
        });
    }

    let currentSchedules = [];

    const datePicker = document.getElementById('current-date');
    const formattedDateText = document.getElementById('formatted-date');
    function updateDateDisplay(dateString) {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return;
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        formattedDateText.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}요일)`;
    }
    const today = new Date();
    datePicker.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    updateDateDisplay(datePicker.value);
    
    datePicker.addEventListener('change', (e) => {
    updateDateDisplay(e.target.value);
    loadScheduleByDate(e.target.value);
    loadGlobalWarnings();
});

function loadScheduleByDate(date) {
    if (!connectedSheetId) return;
showToast(`${date} 일정을 불러오는 중`, true);
    fetch(MASTER_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'loadSchedules', sheetId: connectedSheetId, date: date })
    })
    .then(res => res.json())
    .then(result => {
        currentSchedules = result.schedules;
        renderScheduleTable(result.schedules); 
        updateFloorPlanWithSchedules();
        showToast('일정 로드 완료!');
    })
    .catch(e => showToast('일정 로드 실패'));
}

function updateFloorPlanWithSchedules() {
    const roomElements = floorGrid.querySelectorAll('.room:not(.onion-skin-room)');
    
    roomElements.forEach(roomEl => {
        if (roomEl.classList.contains('status-unavailable')) return; 
        
        const nameEl = roomEl.querySelector('.room-name');
        const infoEl = roomEl.querySelector('.room-info');
        if (!nameEl || !infoEl) return;
        
        const roomName = nameEl.textContent;
        const roomSchedules = currentSchedules.filter(s => s.room === roomName);
        
        if (roomSchedules.length > 0) {
            let allPeriods = [];
            roomSchedules.forEach(s => {
                const periods = String(s.periods).split(',').map(p => p.trim());
                allPeriods = allPeriods.concat(periods);
            });
            allPeriods = [...new Set(allPeriods)].sort(); 
            
            infoEl.textContent = allPeriods.join(', ');
            
            roomEl.classList.remove('status-empty', 'status-partial', 'status-full');
            roomEl.classList.add(allPeriods.length >= 4 ? 'status-full' : 'status-partial');
        } else {
            infoEl.textContent = '종일 비어있음';
            roomEl.classList.remove('status-partial', 'status-full');
            roomEl.classList.add('status-empty');
        }
    });
}

    const warningLayer = document.getElementById('mobile-warning');
    const closeWarningBtn = document.getElementById('close-warning-btn');

    if (closeWarningBtn) {
        closeWarningBtn.addEventListener('click', () => {
            warningLayer.style.setProperty('display', 'none', 'important');
            
            const floorNav = document.querySelector('.floor-nav');
            const floorPlanSection = document.querySelector('.floor-plan-section');
            const planHeader = document.querySelector('.floor-plan-section .section-header');
            const planScroll = document.querySelector('.floor-plan-scroll-area');
            
            if (floorNav) floorNav.style.setProperty('display', 'none', 'important');
            if (planHeader) planHeader.style.setProperty('display', 'none', 'important');
            if (planScroll) planScroll.style.setProperty('display', 'none', 'important');
            
            if (floorPlanSection) {
                floorPlanSection.style.flex = '0';
                floorPlanSection.style.border = 'none';
                floorPlanSection.style.minWidth = '0';
            }
            
            showToast('모바일 뷰 모드: 일정표만 표시됩니다.');
        });
    }

    let confirmCallback = null;
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    function showConfirmModal(message, callback) {
        confirmMessage.textContent = message;
        confirmCallback = callback;
        confirmModal.classList.remove('hidden');
    }
    document.getElementById('confirm-cancel-btn').addEventListener('click', () => { confirmModal.classList.add('hidden'); confirmCallback = null; });
    document.getElementById('confirm-ok-btn').addEventListener('click', () => { confirmModal.classList.add('hidden'); if (confirmCallback) { confirmCallback(); confirmCallback = null; } });

    let currentFloor = '3';
    let floorData = {
        '1': [], '2': [],
        '3': [
            { col: 18, row: 14, w: 2, h: 2, name: '예시 교실', info: '종일 비어있음', status: 'status-empty' }
        ]
    };

    const floorGrid = document.getElementById('floor-plan-grid');
    const floorListContainer = document.getElementById('floor-list');
    const floorLabel = document.getElementById('current-floor-label');
    const scrollArea = document.querySelector('.floor-plan-scroll-area');

    function syncRoomsToGas() {
        if (!connectedSheetId || MASTER_GAS_URL.includes('여기에')) {
            showToast('마스터 주소가 없거나 시트가 연결되지 않아 로컬에만 임시 저장되었습니다.');
            return;
        }
        
showToast('서버에 평면도를 안전하게 저장하는 중', true);
        fetch(MASTER_GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveRooms', sheetId: connectedSheetId, floorData: floorData })
        })
        .then(res => res.json())
        .then(result => {
            if (result.result === 'success') {
                showToast('평면도 배치가 서버에 안전하게 저장되었습니다!');
            } else {
                showToast('서버 저장 오류: ' + result.message);
            }
        })
        .catch(e => {
            console.error(e);
            showToast('통신 실패: 구글 서버가 응답하지 않습니다.');
        });
    }
    
    function loadRoomsFromGas() {
        const GRID_CENTER = 1758; 

        if (!connectedSheetId || MASTER_GAS_URL.includes('여기에')) {
            updateGlobalBounds(); 
            panX = -(globalBounds.centerPxX - GRID_CENTER) * zoom;
            panY = -(globalBounds.centerPxY - GRID_CENTER) * zoom;
            renderFloor(currentFloor);

            loadScheduleByDate(document.getElementById('current-date').value);
            loadGlobalWarnings();
            return;
        }

showToast('서버에서 건물 도면을 불러오는 중', true);
        fetch(MASTER_GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'loadData', sheetId: connectedSheetId })
        })
        .then(res => res.json())
        .then(result => {
            if (result.floorData) {
                floorData = result.floorData;
                currentFloor = floorData['1'] ? '1' : Object.keys(floorData).sort((a,b)=>a-b)[0];
            }
            if (result.roomList) {
                updateRoomSelect(result.roomList);
            }
            
            updateGlobalBounds();
            panX = -(globalBounds.centerPxX - GRID_CENTER) * zoom;
            panY = -(globalBounds.centerPxY - GRID_CENTER) * zoom;
            
            renderFloor(currentFloor);
            showToast('✅ 건물 데이터 로드 완료!');

            loadScheduleByDate(document.getElementById('current-date').value);
            loadGlobalWarnings();
        })
        .catch(e => {
            showToast('⚠️ 불러오기 실패. 기본 데이터로 시작합니다.');
            updateGlobalBounds();
            panX = -(globalBounds.centerPxX - GRID_CENTER) * zoom;
            panY = -(globalBounds.centerPxY - GRID_CENTER) * zoom;
            renderFloor(currentFloor);

            loadScheduleByDate(document.getElementById('current-date').value);
        });
    }

let zoom = window.innerWidth < 800 ? 0.6 : 0.8; 
    let panX = 0, panY = 0;

    const zoomSlider = document.getElementById('zoom-slider');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');

    if (zoomSlider) zoomSlider.value = zoom; // 초기화

    function applyZoom(newZoom) {
        zoom = Math.min(Math.max(0.4, newZoom), 1.5);
        if (zoomSlider) zoomSlider.value = zoom;
        updateTransform();
    }

    if (zoomSlider) zoomSlider.addEventListener('input', (e) => applyZoom(parseFloat(e.target.value)));
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => applyZoom(zoom + 0.05));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => applyZoom(zoom - 0.05));

    let globalBounds = { bLeft: 0, bRight: 3516, bTop: 0, bBottom: 3516 };

    function updateRoomSelect(names) {
        const select = document.querySelector('#schedule-form select');
        if (!select) return;
        select.innerHTML = ''; 

        const sortedNames = [...names].sort((a, b) => a.localeCompare(b, 'ko-KR'));
        
        sortedNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }

function updateGlobalBounds() {
    let globalMinCol = Infinity, globalMaxColEnd = -Infinity;
    let globalMinRow = Infinity, globalMaxRowEnd = -Infinity;
    let hasRooms = false;

    for (let floor in floorData) {
        const rooms = floorData[floor] || [];
        rooms.forEach(room => {
            hasRooms = true;
            if (room.col < globalMinCol) globalMinCol = room.col;
            if (room.col + room.w > globalMaxColEnd) globalMaxColEnd = room.col + room.w;
            if (room.row < globalMinRow) globalMinRow = room.row;
            if (room.row + room.h > globalMaxRowEnd) globalMaxRowEnd = room.row + room.h;
        });
    }

    if (!hasRooms) {
        globalBounds = { bLeft: 0, bRight: 3516, bTop: 0, bBottom: 3516, centerPxX: 1758, centerPxY: 1758 };
        return;
    }

    globalBounds = {
        bLeft: (globalMinCol - 1) * 44,
        bRight: (globalMaxColEnd - 1) * 44 - 4,
        bTop: (globalMinRow - 1) * 44,
        bBottom: (globalMaxRowEnd - 1) * 44 - 4
    };
    globalBounds.centerPxX = (globalBounds.bLeft + globalBounds.bRight) / 2;
    globalBounds.centerPxY = (globalBounds.bTop + globalBounds.bBottom) / 2;
}

function updateTransform() {
    const GRID_CENTER = 1758;
    const viewW = scrollArea.clientWidth;
    const viewH = scrollArea.clientHeight;

    const edgePadding = 100; 

    const panX_max = (viewW / 2) - edgePadding - (globalBounds.bLeft - GRID_CENTER) * zoom;
    const panX_min = -(viewW / 2) + edgePadding - (globalBounds.bRight - GRID_CENTER) * zoom;
    const panY_max = (viewH / 2) - edgePadding - (globalBounds.bTop - GRID_CENTER) * zoom;
    const panY_min = -(viewH / 2) + edgePadding - (globalBounds.bBottom - GRID_CENTER) * zoom;

    if (panX_min <= panX_max) panX = Math.max(panX_min, Math.min(panX_max, panX));
    if (panY_min <= panY_max) panY = Math.max(panY_min, Math.min(panY_max, panY));
    
    floorGrid.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`;
}

    scrollArea.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const rect = scrollArea.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        
        const prevZoom = zoom;
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        zoom = Math.min(Math.max(0.4, zoom + delta), 1.5); 

        if (zoomSlider) zoomSlider.value = zoom;

        panX = mouseX - (mouseX - panX) * (zoom / prevZoom);
        panY = mouseY - (mouseY - panY) * (zoom / prevZoom);
        
        updateTransform();
    }, { passive: false });

    let isPanning = false;
    let panStartX, panStartY;
    let hasMovedForPan = false;
    let panInitialTarget = null;

    scrollArea.addEventListener('pointerdown', (e) => {
        const room = e.target.closest('.room');
        if (room && !room.classList.contains('onion-skin-room') && floorGrid.classList.contains('edit-mode')) return;
        
        isPanning = true;
        hasMovedForPan = false;
        panInitialTarget = e.target;
        
        panStartX = e.clientX - panX;
        panStartY = e.clientY - panY;
        scrollArea.setPointerCapture(e.pointerId);
    });

    scrollArea.addEventListener('pointermove', (e) => {
        if (!isPanning) return;

        const dx = Math.abs((e.clientX - panX) - panStartX);
        const dy = Math.abs((e.clientY - panY) - panStartY);
        if (dx > 5 || dy > 5) {
            hasMovedForPan = true;
        }

        panX = e.clientX - panStartX;
        panY = e.clientY - panStartY;
        updateTransform();
    });

scrollArea.addEventListener('pointerup', (e) => {
        isPanning = false;
        scrollArea.releasePointerCapture(e.pointerId);

        if (!hasMovedForPan && panInitialTarget) {
            const room = panInitialTarget.closest('.room:not(.onion-skin-room)');

            if (room && !floorGrid.classList.contains('edit-mode')) {
                if (!room.classList.contains('status-unavailable')) {
                    showRoomTooltip(room); 
                }
            }
        }
    });

    function renderFloor(floorNum) {
        floorGrid.innerHTML = ''; 
        const rooms = floorData[floorNum] || [];
        rooms.forEach(data => {
            const room = document.createElement('div');
            room.className = `room ${data.status}`;
            room.style.gridColumn = `${data.col} / span ${data.w}`;
            room.style.gridRow = `${data.row} / span ${data.h}`;
            room.innerHTML = `<div class="room-edit-btn">✏️</div><div class="room-name">${data.name}</div><div class="room-info">${data.info}</div>`;
            floorGrid.appendChild(room);
        });
        floorLabel.textContent = `(${floorNum}F)`;
        renderFloorButtons();
        renderOnionSkin(); 
        updateTransform(); 

        if (typeof updateFloorPlanWithSchedules === 'function') {
            updateFloorPlanWithSchedules();
        }
    }

    function renderOnionSkin() {
        floorGrid.querySelectorAll('.onion-skin-room').forEach(el => el.remove());
        if (!floorGrid.classList.contains('edit-mode')) return;

        const floors = Object.keys(floorData).sort((a, b) => a - b);
        const currentIndex = floors.indexOf(currentFloor);
        
        if (currentIndex > 0) {
            const belowFloor = floors[currentIndex - 1];
            const belowRooms = floorData[belowFloor] || [];
            
            belowRooms.forEach(data => {
                const ghost = document.createElement('div');
                ghost.className = 'room onion-skin-room';
                ghost.style.gridColumn = `${data.col} / span ${data.w}`;
                ghost.style.gridRow = `${data.row} / span ${data.h}`;
                ghost.innerHTML = `<div class="room-name" style="font-size:11px;">(${belowFloor}F) ${data.name}</div>`;
                floorGrid.appendChild(ghost);
            });
        }
    }


    function saveCurrentFloor() {
        const rooms = Array.from(floorGrid.querySelectorAll('.room:not(.onion-skin-room)'));
        floorData[currentFloor] = rooms.map(room => {
            const colStart = parseInt(room.style.gridColumnStart) || 1;
            const rowStart = parseInt(room.style.gridRowStart) || 1;
            const w = parseInt(room.style.gridColumn.match(/span\s+(\d+)/)?.[1] || 2);
            const h = parseInt(room.style.gridRow.match(/span\s+(\d+)/)?.[1] || 2);

            let status = 'status-empty';
            let info = '종일 비어있음';
            if (room.classList.contains('status-unavailable')) {
                status = 'status-unavailable';
                info = '';
            }
            
            return { col: colStart, row: rowStart, w, h, name: room.querySelector('.room-name').textContent, info: info, status: status };
        });
    updateGlobalBounds();
    }

    function renderFloorButtons() {
        floorListContainer.innerHTML = '';
        const manageBtn = document.createElement('button');
        manageBtn.className = 'floor-btn';
        manageBtn.style.backgroundColor = 'var(--bg-panel)';
        manageBtn.style.color = 'var(--text-main)';
        manageBtn.textContent = '+ / -';
        manageBtn.addEventListener('click', () => {
            document.getElementById('floor-manage-modal').classList.remove('hidden');
        });
        floorListContainer.appendChild(manageBtn);

        const floors = Object.keys(floorData).sort((a, b) => b - a);
        floors.forEach(floor => {
            const btn = document.createElement('button');
            btn.className = `floor-btn ${floor === currentFloor ? 'active' : ''}`;
            btn.textContent = `${floor}F`;
            btn.addEventListener('click', () => {
                if (currentFloor !== floor) {
                    saveCurrentFloor(); 
                    currentFloor = floor;
                    renderFloor(currentFloor); 
                }
            });
            floorListContainer.appendChild(btn);
        });
    }

    const floorManageModal = document.getElementById('floor-manage-modal');
    document.getElementById('close-floor-manage-btn').addEventListener('click', () => floorManageModal.classList.add('hidden'));

    document.getElementById('modal-add-floor-btn').addEventListener('click', () => {
        saveCurrentFloor();
        const existingFloors = Object.keys(floorData).map(Number);
        const maxFloorNum = existingFloors.length > 0 ? Math.max(...existingFloors) : 0;
        const nextFloor = String(maxFloorNum + 1); 
        floorData[nextFloor] = []; 
        currentFloor = nextFloor;
        renderFloor(currentFloor);
        syncRoomsToGas(); 
        floorManageModal.classList.add('hidden');
    });

    document.getElementById('modal-delete-floor-btn').addEventListener('click', () => {
        const existingFloors = Object.keys(floorData).map(Number);
        if (existingFloors.length <= 1) { showToast('건물에 최소 1개의 층은 유지되어야 합니다.'); return; }
        const maxFloorNum = Math.max(...existingFloors);
        const topFloorStr = String(maxFloorNum);
        showConfirmModal(`건물의 최상단 층(${topFloorStr}층) 전체를 철거하시겠습니까?`, () => {
            delete floorData[topFloorStr];
            if (currentFloor === topFloorStr) {
                const remainingFloors = Object.keys(floorData).sort((a, b) => b - a);
                currentFloor = remainingFloors[0];
            }
            renderFloor(currentFloor);
            syncRoomsToGas(); 
            floorManageModal.classList.add('hidden');
        });
    });

    const editToggle = document.getElementById('edit-mode-toggle');
    const editControls = document.getElementById('edit-controls');
    editToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            floorGrid.classList.add('edit-mode');
            editControls.classList.remove('hidden');
            renderOnionSkin(); 
            showToast('편집 모드가 활성화되었습니다.');
        } else {
            floorGrid.classList.remove('edit-mode');
            editControls.classList.add('hidden');
            saveCurrentFloor();
            renderOnionSkin(); 
            syncRoomsToGas(); 
            updateFloorPlanWithSchedules();
        }
    });

    document.getElementById('add-room-btn').addEventListener('click', () => {
        const w = 2, h = 2; 
        const rooms = Array.from(floorGrid.querySelectorAll('.room:not(.onion-skin-room)'));
        let targetCol = 18, targetRow = 14;
        if (rooms.length > 0) {
            let minCol = Infinity, minRow = Infinity, maxColEnd = -Infinity, maxRowEnd = -Infinity;
            rooms.forEach(room => {
                const style = window.getComputedStyle(room);
                const colStart = parseInt(style.gridColumnStart);
                const rowStart = parseInt(style.gridRowStart);
                const cw = parseInt(style.gridColumn.match(/span\s+(\d+)/)?.[1] || 2);
                const ch = parseInt(style.gridRow.match(/span\s+(\d+)/)?.[1] || 2);
                if (colStart < minCol) minCol = colStart;
                if (rowStart < minRow) minRow = rowStart;
                if (colStart + cw > maxColEnd) maxColEnd = colStart + cw;
                if (rowStart + ch > maxRowEnd) maxRowEnd = rowStart + ch;
            });
            targetCol = Math.floor((minCol + maxColEnd) / 2);
            targetRow = Math.floor((minRow + maxRowEnd) / 2);
        }
        const newRoom = document.createElement('div');
        newRoom.className = 'room status-empty'; 
        newRoom.style.gridColumn = `${targetCol} / span ${w}`;
        newRoom.style.gridRow = `${targetRow} / span ${h}`;
        newRoom.innerHTML = `<div class="room-edit-btn">✏️</div><div class="room-name">새 교실</div><div class="room-info">종일 비어있음</div>`;
        floorGrid.appendChild(newRoom);
        showToast('새 교실이 추가되었습니다.');
    });

    const CELL_SIZE = 44; 
    let isDragging = false, isResizing = false, activeRoom = null;
    let startX, startY, startCol, startRow, startColSpan, startRowSpan;

    floorGrid.addEventListener('pointerdown', (e) => {
        if (!floorGrid.classList.contains('edit-mode')) return;
        const room = e.target.closest('.room:not(.onion-skin-room)');
        if (!room) return;
        if (e.target.closest('.room-edit-btn')) return;
        
        e.stopPropagation();
        const rect = room.getBoundingClientRect();
        const isCorner = (e.clientX > rect.right - 20) && (e.clientY > rect.bottom - 20);
        
        activeRoom = room; startX = e.clientX; startY = e.clientY;
        startCol = parseInt(room.style.gridColumnStart); startRow = parseInt(room.style.gridRowStart);
        startColSpan = parseInt(room.style.gridColumn.match(/span\s+(\d+)/)?.[1] || 2); 
        startRowSpan = parseInt(room.style.gridRow.match(/span\s+(\d+)/)?.[1] || 2);
        
        if (isCorner) isResizing = true;
        else { isDragging = true; room.style.opacity = '0.7'; room.style.zIndex = '100'; }
        room.setPointerCapture(e.pointerId);
    });

    floorGrid.addEventListener('pointermove', (e) => {
        if (!activeRoom) return;
        const dCols = Math.round(((e.clientX - startX) / zoom) / CELL_SIZE);
        const dRows = Math.round(((e.clientY - startY) / zoom) / CELL_SIZE);
        
        if (isDragging) {
            activeRoom.style.gridColumn = `${Math.max(1, startCol + dCols)} / span ${startColSpan}`;
            activeRoom.style.gridRow = `${Math.max(1, startRow + dRows)} / span ${startRowSpan}`;
        } else if (isResizing) {
            activeRoom.style.gridColumn = `${startCol} / span ${Math.max(1, startColSpan + dCols)}`;
            activeRoom.style.gridRow = `${startRow} / span ${Math.max(1, startRowSpan + dRows)}`;
        }
    });

    floorGrid.addEventListener('pointerup', (e) => {
        if (!activeRoom) return;
        activeRoom.releasePointerCapture(e.pointerId);
        activeRoom.style.opacity = '1'; activeRoom.style.zIndex = '';
        activeRoom = null; isDragging = false; isResizing = false;
    });

    const roomEditModal = document.getElementById('room-edit-modal');
    const editRoomNameInput = document.getElementById('edit-room-name');
    const editRoomIdleCheckbox = document.getElementById('edit-room-idle');
    let editingRoomElement = null;

    floorGrid.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.room-edit-btn');
        if (editBtn) {
            editingRoomElement = editBtn.closest('.room');
            const nameEl = editingRoomElement.querySelector('.room-name');
            editRoomNameInput.value = nameEl ? nameEl.textContent : '';
            editRoomIdleCheckbox.checked = !editingRoomElement.classList.contains('status-unavailable');
            roomEditModal.classList.remove('hidden');
        }
    });

    document.getElementById('close-room-edit-btn').addEventListener('click', () => {
        roomEditModal.classList.add('hidden'); editingRoomElement = null;
    });

    document.getElementById('save-room-edit-btn').addEventListener('click', () => {
        if (!editingRoomElement) return;
        const nameEl = editingRoomElement.querySelector('.room-name');
        if (nameEl) nameEl.textContent = editRoomNameInput.value;
        const infoEl = editingRoomElement.querySelector('.room-info');
        
        if (editRoomIdleCheckbox.checked) {
            editingRoomElement.classList.remove('status-unavailable');
            editingRoomElement.classList.add('status-empty');
            if(infoEl) infoEl.textContent = '종일 비어있음';
        } else {
            editingRoomElement.className = 'room status-unavailable';
            if(infoEl) infoEl.textContent = '';
        }
        roomEditModal.classList.add('hidden'); editingRoomElement = null;
        saveCurrentFloor(); 
        syncRoomsToGas();
    });

    document.getElementById('delete-room-btn').addEventListener('click', () => {
        if (!editingRoomElement) return;
        showConfirmModal('정말 이 교실을 삭제하시겠습니까?', () => {
            editingRoomElement.remove(); roomEditModal.classList.add('hidden');
            editingRoomElement = null; 
            saveCurrentFloor(); 
            syncRoomsToGas();
        });
    });

    const addBtn = document.getElementById('add-schedule-btn');
    const modal = document.getElementById('schedule-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const form = document.getElementById('schedule-form');
    const repeatToggle = document.getElementById('repeat-toggle');
    const repeatEndGroup = document.getElementById('repeat-end-group');
    const modalStartDate = document.getElementById('modal-start-date');

    repeatToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            repeatEndGroup.classList.remove('hidden');
            document.getElementById('modal-end-date').setAttribute('required', 'true');
        } else {
            repeatEndGroup.classList.add('hidden');
            document.getElementById('modal-end-date').removeAttribute('required');
        }
    });

    addBtn.addEventListener('click', () => {
        if (!connectedSheetId) showToast('경고: 우측 상단 [설정]에서 시트를 먼저 연결해주세요.');
        modalStartDate.value = datePicker.value;
        modal.classList.remove('hidden');
    });
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden'); form.reset(); repeatEndGroup.classList.add('hidden');
    });

    const customTimeCb = document.getElementById('custom-time-cb');
    const customTimeGroup = document.getElementById('custom-time-group');
    const customTimeInput = document.getElementById('custom-time-input');
    
    if (customTimeCb) {
        customTimeCb.addEventListener('change', (e) => {
            if (e.target.checked) {
                customTimeGroup.classList.remove('hidden');
                customTimeInput.setAttribute('required', 'true');
            } else {
                customTimeGroup.classList.add('hidden');
                customTimeInput.removeAttribute('required');
                customTimeInput.value = '';
            }
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        let checkedPeriods = [];
        document.querySelectorAll('input[name="period"]:checked').forEach(cb => {
            if (cb.value === 'custom') {
                const customVal = customTimeInput.value.trim();
                if (customVal) checkedPeriods.push(customVal);
            } else {
                checkedPeriods.push(cb.value + '교시');
            }
        });

        if (checkedPeriods.length === 0) { 
            showToast('최소 1개 이상의 교시 또는 시간을 입력해주세요.'); 
            return; 
        }

        const roomSelect = form.querySelector('select');
        const isRepeat = document.getElementById('repeat-toggle').checked;
        const endDate = isRepeat ? document.getElementById('modal-end-date').value : document.getElementById('modal-start-date').value;

        const scheduleData = {
            action: 'addSchedule',
            sheetId: connectedSheetId, 
            date: document.getElementById('modal-start-date').value,
            endDate: endDate, 
            room: roomSelect.value, 
            periods: checkedPeriods, 
            purpose: document.getElementById('schedule-purpose').value
        };

        if (!connectedSheetId || MASTER_GAS_URL.includes('여기에_마스터_주소')) {
            modal.classList.add('hidden'); showToast(`[시트 미연결] 일정이 임시 기록되었습니다.`);
            form.reset(); repeatEndGroup.classList.add('hidden'); return;
        }
        
showToast('서버에 일정을 저장하는 중', true);
        fetch(MASTER_GAS_URL, { method: 'POST', body: JSON.stringify(scheduleData) })
        .then(response => response.json())
        .then(result => {
            modal.classList.add('hidden'); 
            showToast('✅ ' + result.message);
            form.reset(); 
            repeatEndGroup.classList.add('hidden');

            loadScheduleByDate(datePicker.value);
            loadGlobalWarnings();
        })
        .catch(error => showToast('저장 실패: 통신 오류'));
    });

    function renderScheduleTable(schedules) {
        const tbody = document.getElementById('schedule-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        for (let i = 0; i < schedules.length; i++) {
            schedules[i].isOverlapped = false;
            for (let j = 0; j < schedules.length; j++) {
                if (i !== j && schedules[i].room === schedules[j].room) {
                    const p1 = String(schedules[i].periods).split(',').map(p => p.trim());
                    const p2 = String(schedules[j].periods).split(',').map(p => p.trim());
                    const hasOverlap = p1.some(p => p2.includes(p));
                    if (hasOverlap) schedules[i].isOverlapped = true;
                }
            }
        }

        schedules.forEach(item => {
            item.actualFloorNum = 999; 
            item.actualFloorStr = '?';
            for (let floorNum in floorData) {
                if (floorData[floorNum].some(room => room.name === item.room)) {
                    item.actualFloorNum = parseInt(floorNum);
                    item.actualFloorStr = floorNum;
                    break;
                }
            }
        });

        const groupedSchedules = {};
        schedules.forEach(item => {
            if (!groupedSchedules[item.room]) {
                groupedSchedules[item.room] = {
                    actualFloorNum: item.actualFloorNum,
                    actualFloorStr: item.actualFloorStr,
                    room: item.room,
                    allPeriods: new Set(),
                    hasOverlap: false,
                    items: [] 
                };
            }

            const periodsArr = String(item.periods).split(',').map(p => p.trim());
            periodsArr.forEach(p => groupedSchedules[item.room].allPeriods.add(p));
            if (item.isOverlapped) groupedSchedules[item.room].hasOverlap = true;
            
            groupedSchedules[item.room].items.push(item);
        });

        const sortedGroups = Object.values(groupedSchedules).sort((a, b) => {
            if (a.actualFloorNum !== b.actualFloorNum) return a.actualFloorNum - b.actualFloorNum;
            return a.room.localeCompare(b.room, 'ko-KR'); 
        });

        sortedGroups.forEach((group, index) => {

            if (group.items.length === 1) {
                const item = group.items[0];
                const tr = document.createElement('tr');
                tr.dataset.room = item.room; 
                if (item.isOverlapped) tr.classList.add('overlapped-row');
                
                const itemPeriods = String(item.periods).split(',').map(p => p.trim());
                const safePeriodsHtml = itemPeriods.map(p => `<span style="white-space: nowrap;" class="${item.isOverlapped ? 'highlight-text' : ''}">${p}</span>`).join(', ');

                tr.innerHTML = `
                    <td>${group.actualFloorStr}층</td>
                    <td>${group.room}</td>
                    <td>${safePeriodsHtml}</td>
                    <td>${item.purpose}</td>
                    <td><button class="delete-schedule-btn">삭제</button></td>
                `;
                tbody.appendChild(tr);
            } 

            else {
                const headerTr = document.createElement('tr');
                headerTr.className = 'room-group-header';
                headerTr.dataset.index = index; 
                if (group.hasOverlap) headerTr.classList.add('overlapped-row');

                const sortedPeriods = Array.from(group.allPeriods).sort();
                const periodsHtml = sortedPeriods.map(p => `<span style="white-space: nowrap;" class="${group.hasOverlap ? 'highlight-text' : ''}">${p}</span>`).join(', ');

                headerTr.innerHTML = `
                    <td><b>${group.actualFloorStr}층</b></td>
                    <td><b>${group.room}</b> <span class="toggle-icon">▼</span></td>
                    <td>${periodsHtml}</td>
                    <td style="color: #9ca3af;">-</td>
                    <td style="color: #9ca3af;">-</td>
                `;
                tbody.appendChild(headerTr);

                group.items.forEach(item => {
                    const detailTr = document.createElement('tr');
                    detailTr.className = `room-group-detail detail-for-${index} detail-hidden`;
                    detailTr.dataset.room = item.room;
                    if (item.isOverlapped) detailTr.classList.add('overlapped-row');
                    
                    const itemPeriods = String(item.periods).split(',').map(p => p.trim());
                    const safePeriodsHtml = itemPeriods.map(p => `<span style="white-space: nowrap;" class="${item.isOverlapped ? 'highlight-text' : ''}">${p}</span>`).join(', ');

                    detailTr.innerHTML = `
                        <td style="border-right: none; color: #d1d5db;">↳</td>
                        <td style="border-left: none; text-align: left; padding-left: 10px; color: var(--text-light);"></td>
                        <td>${safePeriodsHtml}</td>
                        <td>${item.purpose}</td>
                        <td><button class="delete-schedule-btn">삭제</button></td>
                    `;
                    tbody.appendChild(detailTr);
                });
            }
        });
    }

    document.getElementById('schedule-tbody').addEventListener('click', (e) => {

        const headerRow = e.target.closest('.room-group-header');
        if (headerRow) {
            const index = headerRow.dataset.index;
            const isExpanded = headerRow.classList.contains('expanded');

            document.querySelectorAll('.room-group-header.expanded').forEach(header => {
                header.classList.remove('expanded');
                const idx = header.dataset.index;
                document.querySelectorAll(`.detail-for-${idx}`).forEach(detail => detail.classList.add('detail-hidden'));
            });

            if (!isExpanded) {
                headerRow.classList.add('expanded');
                document.querySelectorAll(`.detail-for-${index}`).forEach(detail => detail.classList.remove('detail-hidden'));
            }
            return; 
        }

        if (e.target.classList.contains('delete-schedule-btn')) {
            const row = e.target.closest('tr');

            const roomName = row.dataset.room; 
            const periods = row.children[2].textContent.trim(); 
            const purpose = row.children[3].textContent.trim();
            const targetDate = document.getElementById('current-date').value;

            showConfirmModal(`[${roomName}]의 '${purpose}' 일정을 삭제하시겠습니까?`, () => {
                if (!connectedSheetId || MASTER_GAS_URL.includes('여기에')) {
                    row.remove(); showToast('일정이 임시 삭제되었습니다.'); return;
                }

showToast('서버에서 일정을 삭제하는 중', true); 
                
                fetch(MASTER_GAS_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'deleteSchedule', sheetId: connectedSheetId, date: targetDate, room: roomName, periods: periods, purpose: purpose })
                }).then(response => response.json()).then(result => {
                    if (result.result === 'success') {
                        showToast('✅ ' + result.message);
                        loadScheduleByDate(targetDate);
                        loadGlobalWarnings();
                    } else {
                        showToast('❌ 삭제 실패: ' + result.message);
                    }
                }).catch(error => showToast('❌ 삭제 실패: 통신 오류'));
            });
        }
    });

    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsUnconnectedView = document.getElementById('settings-unconnected-view');
    const settingsConnectedView = document.getElementById('settings-connected-view');
    const generateLinkBtn = document.getElementById('generate-link-btn');
    const sheetUrlInput = document.getElementById('sheet-url-input');
    const shareLinkGroup = document.getElementById('share-link-group');
    const shareLinkInput = document.getElementById('share-link-input');
    const copyLinkBox = document.getElementById('copy-link-box');
    const showNewConnectBtn = document.getElementById('show-new-connect-btn');

    function extractSheetId(url) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
    }

    openSettingsBtn.addEventListener('click', () => {
        if (connectedSheetId) {
            settingsConnectedView.classList.remove('hidden'); settingsUnconnectedView.classList.add('hidden');
        } else {
            settingsConnectedView.classList.add('hidden'); settingsUnconnectedView.classList.remove('hidden');
        }
        settingsModal.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

    generateLinkBtn.addEventListener('click', () => {
        const inputUrl = sheetUrlInput.value.trim();
        const extractedId = extractSheetId(inputUrl);
        if (!extractedId) { showToast('올바른 구글 시트 주소가 아닙니다.'); return; }
        const baseUrl = window.location.origin + window.location.pathname;
        shareLinkInput.value = `${baseUrl}?sheet=${extractedId}`;
        shareLinkGroup.classList.remove('hidden');
        showToast('전용 접속 링크가 생성되었습니다!');
    });

    copyLinkBox.addEventListener('click', () => {
        const currentUrl = window.location.href;
        navigator.clipboard.writeText(currentUrl).then(() => showToast('링크가 복사되었습니다!'))
        .catch(err => {
            const dummy = document.createElement('input'); document.body.appendChild(dummy);
            dummy.value = currentUrl; dummy.select(); document.execCommand('copy');
            document.body.removeChild(dummy); showToast('링크가 복사되었습니다!');
        });
    });

    showNewConnectBtn.addEventListener('click', () => {
        settingsConnectedView.classList.add('hidden'); settingsUnconnectedView.classList.remove('hidden');
    });

    let toastTimeout; 
    function showToast(message, isLoading = false) {
        const container = document.getElementById('toast-container');
        let toast = container.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div'); 
            toast.className = 'toast'; 
            container.appendChild(toast);
        }

        if (isLoading) {
            toast.innerHTML = message + '<span class="loading-dots"></span>';
        } else {
            toast.textContent = message; 
        }
        
        toast.style.opacity = '1';

        if (toastTimeout) clearTimeout(toastTimeout);

        if (!isLoading) {
            toastTimeout = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
        }
    }

    function loadGlobalWarnings() {
        if (!connectedSheetId) return;
        fetch(MASTER_GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getGlobalWarnings', sheetId: connectedSheetId })
        })
        .then(res => res.json())
        .then(result => {
            const container = document.getElementById('global-warning-container');
            if (!container) return;
            container.innerHTML = '';
            if (result.overlaps && result.overlaps.length > 0) {
                result.overlaps.forEach(msg => {
                    const item = document.createElement('div');
                    item.className = 'global-warning-item';
                    item.innerHTML = msg;
                    container.appendChild(item);
                });
            }
        })
        .catch(e => console.error('경고 로드 실패'));
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'room-tooltip hidden';
    document.body.appendChild(tooltip);

    document.addEventListener('pointerdown', (e) => {
        if (!tooltip.contains(e.target) && !e.target.closest('.room')) {
            tooltip.classList.add('hidden');
        }
    });

    function showRoomTooltip(room) {
        const roomName = room.querySelector('.room-name').textContent;

        const rect = room.getBoundingClientRect();
        let leftPos = rect.right + 15;
        let topPos = rect.top;

        if (leftPos + 240 > window.innerWidth) {
            leftPos = rect.left - 240; 
        }
        
        tooltip.style.left = `${leftPos}px`;
        tooltip.style.top = `${topPos}px`;

        const adjustTooltipPosition = () => {
            const tooltipRect = tooltip.getBoundingClientRect();
            if (tooltipRect.bottom > window.innerHeight) {
                let newTop = window.innerHeight - tooltipRect.height - 20;
                if (newTop < 10) newTop = 10;
                tooltip.style.top = `${newTop}px`;
            }
        };

        tooltip.innerHTML = `<div class="tooltip-title">${roomName}</div><div style="text-align:center; padding:10px; font-size:12px;">일정 불러오는 중... ⏳</div>`;
        tooltip.classList.remove('hidden');
        adjustTooltipPosition(); 

        if (!connectedSheetId) {
            tooltip.innerHTML = `<div class="tooltip-title">${roomName}</div><div style="text-align:center; font-size:12px; color:var(--text-light);">시트가 연결되지 않았습니다.</div>`;
            adjustTooltipPosition();
            return;
        }

        fetch(MASTER_GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'loadRoomSchedules', sheetId: connectedSheetId, room: roomName })
        })
        .then(res => res.json())
        .then(result => {
            if (!result.schedules || result.schedules.length === 0) {
                tooltip.innerHTML = `<div class="tooltip-title">${roomName}</div><div style="text-align:center; padding:10px; font-size:12px; color:var(--text-light);">예정된 일정이 없습니다.</div>`;
                adjustTooltipPosition(); 
                return;
            }

            let html = `<div class="tooltip-title">${roomName} 일정 현황</div>`;
            result.schedules.forEach(s => {
                const overlapClass = s.isOverlapped ? 'overlapped' : '';
                
                html += `
                    <div class="tooltip-item ${overlapClass}">
                        <div class="t-date">${s.dateStr}</div>
                        <div><span class="${s.isOverlapped ? 'highlight-text' : ''}">${s.periods}</span> (${s.purpose})</div>
                    </div>
                `;
            });
            tooltip.innerHTML = html;

            adjustTooltipPosition(); 
        })
        .catch(err => {
            tooltip.innerHTML = `<div class="tooltip-title">${roomName}</div><div style="text-align:center; font-size:12px; color:red;">불러오기 실패 🐛</div>`;
            adjustTooltipPosition();
        });
    }

    loadRoomsFromGas();

    const semSetupModal = document.getElementById('semester-setup-modal');
    const semTimetableBody = document.getElementById('sem-timetable-body');

    for (let p = 1; p <= 6; p++) {
        const tr = document.createElement('tr');
        let html = `<td>${p}교시</td>`;
        for (let d = 1; d <= 5; d++) { // 1:월 ~ 5:금
            html += `<td><input type="text" id="sem-input-${d}-${p}" placeholder="-"></td>`;
        }
        tr.innerHTML = html;
        semTimetableBody.appendChild(tr);
    }

    document.getElementById('open-semester-setup-btn').addEventListener('click', () => {
        const roomSelect = document.getElementById('sem-room-select');
        roomSelect.innerHTML = '';
        const activeRooms = new Set();
        for (let floor in floorData) {
            floorData[floor].forEach(r => {
                if (r.status !== 'status-unavailable') activeRooms.add(r.name);
            });
        }

        const sortedRooms = Array.from(activeRooms).sort((a, b) => a.localeCompare(b, 'ko-KR'));
        
        sortedRooms.forEach(room => {
            const opt = document.createElement('option');
            opt.value = room; opt.textContent = room;
            roomSelect.appendChild(opt);
        });

        document.getElementById('settings-modal').classList.add('hidden');
        semSetupModal.classList.remove('hidden'); 
    });

    document.getElementById('close-sem-setup-btn').addEventListener('click', () => {
        semSetupModal.classList.add('hidden');
    });

    document.getElementById('sem-setup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const startStr = document.getElementById('sem-start-date').value;
        const endStr = document.getElementById('sem-end-date').value;
        const roomName = document.getElementById('sem-room-select').value;
        
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (start > end) { showToast('❌ 종료일이 시작일보다 빠를 수 없습니다.'); return; }

        const timetable = {};
        let hasInput = false;
        for (let d = 1; d <= 5; d++) {
            timetable[d] = {};
            for (let p = 1; p <= 6; p++) {
                const val = document.getElementById(`sem-input-${d}-${p}`).value.trim();
                if (val) { timetable[d][p] = val; hasInput = true; }
            }
        }
        
        if (!hasInput) { showToast('❌ 시간표에 최소 1개 이상의 학급을 입력해 주세요.'); return; }

        let batchSchedules = [];
        let currentDate = new Date(start);
        
        while (currentDate <= end) {
            const dayOfWeek = currentDate.getDay();

            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                const dailyGroups = {};
                
                for (let p = 1; p <= 6; p++) {
                    const purposeStr = timetable[dayOfWeek][p];
                    if (purposeStr) {
                        if (!dailyGroups[purposeStr]) dailyGroups[purposeStr] = [];
                        dailyGroups[purposeStr].push(p + '교시');
                    }
                }

                const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;

                for (const purpose in dailyGroups) {
                    batchSchedules.push({
                        date: dateString,
                        room: roomName,
                        periods: dailyGroups[purpose].join(', '),
                        purpose: purpose 
                    });
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (batchSchedules.length === 0) { showToast('❌ 선택한 기간 내에 평일(월~금)이 없습니다.'); return; }

        if (batchSchedules.length === 0) { showToast('❌ 선택한 기간 내에 평일(월~금)이 없습니다.'); return; }
        
        const CHUNK_SIZE = 200;
        semSetupModal.classList.add('hidden');

        async function sendBatchSchedules() {
            let successCount = 0;
            let hasError = false;
            
            for (let i = 0; i < batchSchedules.length; i += CHUNK_SIZE) {
                const chunk = batchSchedules.slice(i, i + CHUNK_SIZE);
showToast(`🚀 일정 일괄 등록 중 (${i + 1} ~ ${Math.min(i + CHUNK_SIZE, batchSchedules.length)} / ${batchSchedules.length})`, true);
                
                try {
                    const res = await fetch(MASTER_GAS_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'batchAddSchedules', sheetId: connectedSheetId, schedules: chunk })
                    });
                    const result = await res.json();
                    successCount += chunk.length;
                } catch(e) {
                    hasError = true;
                    showToast('❌ 통신 오류: 데이터가 너무 많아 중간에 끊겼습니다.');
                    break;
                }
            }
            
            if (!hasError) {
                showToast(`✅ 총 ${successCount}개의 기본 일정이 완벽하게 등록되었습니다!`);
                document.getElementById('sem-setup-form').reset();

                loadScheduleByDate(document.getElementById('current-date').value);
                loadGlobalWarnings();
            }
        }

        sendBatchSchedules();
    });
});
