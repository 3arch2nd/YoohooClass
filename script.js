// script.js
document.addEventListener('DOMContentLoaded', () => {
    // 💡 1. 마스터 GAS 주소 입력
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

    // 날짜 세팅 로직
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
    // script.js - 기존 날짜 이벤트 리스너 부분을 아래와 같이 수정하세요.
datePicker.addEventListener('change', (e) => {
    updateDateDisplay(e.target.value);
    // 💡 날짜가 바뀌면 서버에서 해당 날짜의 일정 데이터를 새로 불러옵니다.
    loadScheduleByDate(e.target.value);
});

// 💡 특정 날짜의 일정 불러오기 함수 (교체)
function loadScheduleByDate(date) {
    if (!connectedSheetId) return;
    
    showToast(`${date} 일정을 불러오는 중... ⏳`);
    fetch(MASTER_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'loadSchedules', sheetId: connectedSheetId, date: date })
    })
    .then(res => res.json())
    .then(result => {
        currentSchedules = result.schedules; // 불러온 일정을 변수에 저장
        renderScheduleTable(result.schedules); 
        updateFloorPlanWithSchedules(); // 🚀 평면도에 일정 입히기 호출!
        showToast('✅ 일정 로드 완료!');
    })
    .catch(e => showToast('❌ 일정 로드 실패'));
}

    // 💡 평면도에 일정을 시각적으로 업데이트하는 핵심 함수 [새로 추가]
function updateFloorPlanWithSchedules() {
    const roomElements = floorGrid.querySelectorAll('.room:not(.onion-skin-room)');
    
    roomElements.forEach(roomEl => {
        // '유휴 공간 아님' 처리된 방은 무시합니다.
        if (roomEl.classList.contains('status-unavailable')) return; 
        
        const nameEl = roomEl.querySelector('.room-name');
        const infoEl = roomEl.querySelector('.room-info');
        if (!nameEl || !infoEl) return;
        
        const roomName = nameEl.textContent;
        // 이 방에 해당하는 일정만 필터링
        const roomSchedules = currentSchedules.filter(s => s.room === roomName);
        
        if (roomSchedules.length > 0) {
            let allPeriods = [];
            roomSchedules.forEach(s => {
                const periods = String(s.periods).split(',').map(p => p.trim());
                allPeriods = allPeriods.concat(periods);
            });
            // 중복 교시 제거 및 오름차순 정렬
            allPeriods = [...new Set(allPeriods)].sort(); 
            
            infoEl.textContent = allPeriods.join(', ');
            
            // 등록된 교시가 4개 이상이면 핑크색(꽉 참), 아니면 노란색(부분 사용)으로 색상 변경
            roomEl.classList.remove('status-empty', 'status-partial', 'status-full');
            roomEl.classList.add(allPeriods.length >= 4 ? 'status-full' : 'status-partial');
        } else {
            infoEl.textContent = '종일 비어있음';
            roomEl.classList.remove('status-partial', 'status-full');
            roomEl.classList.add('status-empty');
        }
    });
}


    
    // 모바일 경고 제어
    const warningLayer = document.getElementById('mobile-warning');
    const closeWarningBtn = document.getElementById('close-warning-btn');
    if (closeWarningBtn) closeWarningBtn.addEventListener('click', () => warningLayer.style.display = 'none');

    // 공통 모달
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

    // === 💡 데이터 구조 및 동기화 로직 ===
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

    // 🚀 서버로 평면도 데이터 동기화 (알림 강화 🐛)
    function syncRoomsToGas() {
        if (!connectedSheetId || MASTER_GAS_URL.includes('여기에')) {
            showToast('⚠️ 마스터 주소가 없거나 시트가 연결되지 않아 로컬에만 임시 저장되었습니다.');
            return;
        }
        
        showToast('서버에 평면도를 안전하게 저장하는 중... ⏳');
        fetch(MASTER_GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveRooms', sheetId: connectedSheetId, floorData: floorData })
        })
        .then(res => res.json())
        .then(result => {
            if (result.result === 'success') {
                showToast('✅ 평면도 배치가 서버에 안전하게 저장되었습니다!');
            } else {
                showToast('❌ 서버 저장 오류: ' + result.message);
            }
        })
        .catch(e => {
            console.error(e);
            showToast('❌ 통신 실패: 구글 서버가 응답하지 않습니다.');
        });
    }

    // 🚀 서버에서 데이터 불러오기 (초기 1회)
    function loadRoomsFromGas() {
        if (!connectedSheetId || MASTER_GAS_URL.includes('여기에')) {
            renderFloor(currentFloor);
            return;
        }
        showToast('서버에서 건물 도면을 불러오는 중... ⏳');
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
        
        // 💡 교실 목록이 있다면 드롭다운 갱신
        if (result.roomList) {
            updateRoomSelect(result.roomList);
        }
        
        renderFloor(currentFloor);
        showToast('✅ 데이터 로드 완료!');
    })

        .catch(e => {
            showToast('⚠️ 불러오기 실패. 기본 데이터로 시작합니다.');
            renderFloor(currentFloor);
        });
    }

    let zoom = window.innerWidth < 800 ? 0.6 : 0.8; 
    let panX = 0, panY = 0;

// script.js 끝부분에 아래 함수가 있는지 확인하세요!
function updateRoomSelect(names) {
    const select = document.querySelector('#schedule-form select');
    if (!select) return; // 모달이 닫혀있을 때 방지
    select.innerHTML = ''; 
    names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
}
    
// script.js
function updateTransform() {
    // 💡 건물이 화면 밖으로 이탈하지 않도록 범위 제한 (그리드 크기 80*40 = 3200px 기준)
    const padding = 200; // 여백
    const limitX = (80 * 40 * zoom) / 2 - padding;
    const limitY = (80 * 40 * zoom) / 2 - padding;
    
    panX = Math.max(-limitX, Math.min(limitX, panX));
    panY = Math.max(-limitY, Math.min(limitY, panY));
    
    floorGrid.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`;
}

    scrollArea.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    // 마우스 위치 기준 줌 계산
    const rect = scrollArea.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    
    const prevZoom = zoom;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom = Math.min(Math.max(0.4, zoom + delta), 2.5);
    
    // 줌 확대 시 마우스 위치 유지
    panX -= (mouseX / prevZoom) * (zoom - prevZoom);
    panY -= (mouseY / prevZoom) * (zoom - prevZoom);
    
    updateTransform();
}, { passive: false });


    let isPanning = false;
    let panStartX, panStartY;
    
    scrollArea.addEventListener('pointerdown', (e) => {
        const room = e.target.closest('.room');
        if (room && !room.classList.contains('onion-skin-room') && floorGrid.classList.contains('edit-mode')) return;
        
        isPanning = true;
        panStartX = e.clientX - panX;
        panStartY = e.clientY - panY;
        scrollArea.setPointerCapture(e.pointerId);
    });

    scrollArea.addEventListener('pointermove', (e) => {
        if (!isPanning) return;
        panX = e.clientX - panStartX;
        panY = e.clientY - panStartY;
        updateTransform();
    });

    scrollArea.addEventListener('pointerup', (e) => {
        isPanning = false;
        scrollArea.releasePointerCapture(e.pointerId);
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
            if (room.classList.contains('status-unavailable')) status = 'status-unavailable';
            else if (room.classList.contains('status-partial')) status = 'status-partial';
            else if (room.classList.contains('status-full')) status = 'status-full';
            return { col: colStart, row: rowStart, w, h, name: room.querySelector('.room-name').textContent, info: room.querySelector('.room-info').textContent, status };
        });
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
            syncRoomsToGas(); // 🚀 여기서 최종 동기화 (알림 뜸)
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
            if(infoEl) infoEl.textContent = '유휴 공간 아님';
        }
        roomEditModal.classList.add('hidden'); editingRoomElement = null;
        saveCurrentFloor(); 
        syncRoomsToGas(); // 🚀 방 속성 변경 시 즉시 저장
    });

    document.getElementById('delete-room-btn').addEventListener('click', () => {
        if (!editingRoomElement) return;
        showConfirmModal('정말 이 교실을 삭제하시겠습니까?', () => {
            editingRoomElement.remove(); roomEditModal.classList.add('hidden');
            editingRoomElement = null; 
            saveCurrentFloor(); 
            syncRoomsToGas(); // 🚀 방 삭제 시 즉시 저장
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

    // [수정] script.js - 일정 추가 이벤트 로직 교체
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const checkedPeriods = Array.from(document.querySelectorAll('input[name="period"]:checked')).map(cb => cb.value + '교시');
        if (checkedPeriods.length === 0) { showToast('최소 1개 이상의 교시를 선택해주세요.'); return; }

        const roomSelect = form.querySelector('select');
        
        // 💡 [추가된 로직] 반복 일정 여부 확인 및 종료일 설정
        const isRepeat = document.getElementById('repeat-toggle').checked;
        const endDate = isRepeat ? document.getElementById('modal-end-date').value : document.getElementById('modal-start-date').value;

        const scheduleData = {
            action: 'addSchedule',
            sheetId: connectedSheetId, 
            date: document.getElementById('modal-start-date').value,
            endDate: endDate, // 💡 서버로 종료일 함께 전송
            room: roomSelect.value, 
            periods: checkedPeriods,
            purpose: document.getElementById('schedule-purpose').value
        };

        if (!connectedSheetId || MASTER_GAS_URL.includes('여기에_마스터_주소')) {
            modal.classList.add('hidden'); showToast(`[시트 미연결] 일정이 임시 기록되었습니다.`);
            form.reset(); repeatEndGroup.classList.add('hidden'); return;
        }

        showToast('서버에 일정을 저장하는 중... ⏳');
        fetch(MASTER_GAS_URL, { method: 'POST', body: JSON.stringify(scheduleData) })
        .then(response => response.json())
        .then(result => {
            modal.classList.add('hidden'); 
            showToast('✅ ' + result.message);
            form.reset(); 
            repeatEndGroup.classList.add('hidden');
            
            // 💡 [추가된 로직] 저장이 완료되면 현재 화면의 날짜 기준으로 일정을 다시 불러옴!
            loadScheduleByDate(datePicker.value);
        })
        .catch(error => showToast('❌ 저장 실패: 통신 오류'));
    });

    document.getElementById('schedule-tbody').addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-schedule-btn')) {
            const row = e.target.closest('tr');
            const roomName = row.children[1].textContent;
            const purpose = row.children[3].textContent;
            const targetDate = datePicker.value;

            showConfirmModal(`[${roomName}]의 '${purpose}' 일정을 삭제하시겠습니까?`, () => {
                if (!connectedSheetId || MASTER_GAS_URL.includes('여기에_마스터_주소')) {
                    row.remove(); showToast('일정이 삭제되었습니다.'); return;
                }
                showToast('서버에서 일정을 삭제하는 중... ⏳');
                fetch(MASTER_GAS_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'deleteSchedule', sheetId: connectedSheetId, date: targetDate, room: roomName, purpose: purpose })
                }).then(response => response.json()).then(result => {
                    row.remove(); showToast('✅ ' + result.message);
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
    function showToast(message) {
        const container = document.getElementById('toast-container');
        let toast = container.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div'); toast.className = 'toast'; container.appendChild(toast);
        }
        toast.textContent = message; toast.style.opacity = '1';
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
    }

    // 💡 표 렌더링 함수 (교체: 글자 줄바꿈 방지 적용)
function renderScheduleTable(schedules) {
    const tbody = document.getElementById('schedule-tbody');
    tbody.innerHTML = '';
    
    schedules.forEach(item => {
        const tr = document.createElement('tr');
        
        // ✨ '1교시, 2교시'를 각각 분리한 후, 줄바꿈 방지 <span> 태그로 감싸기
        const periodsArr = String(item.periods).split(',').map(p => p.trim());
        const safePeriodsHtml = periodsArr.map(p => `<span style="white-space: nowrap;">${p}</span>`).join(', ');

        tr.innerHTML = `
            <td>${currentFloor}층</td>
            <td>${item.room}</td>
            <td>${safePeriodsHtml}</td>
            <td>${item.purpose}</td>
            <td><button class="delete-schedule-btn">삭제</button></td>
        `;
        tbody.appendChild(tr);
    });
}

    // 🚀 앱 실행 시 초기 데이터 로드 호출
    loadRoomsFromGas();
    loadScheduleByDate(datePicker.value);
});
