// script.js
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
                alert('올바른 구글 시트 주소가 아닙니다. 주소를 다시 확인해 주세요.');
            }
        });
    }

    const datePicker = document.getElementById('current-date');
    const formattedDateText = document.getElementById('formatted-date');
    
    function updateDateDisplay(dateString) {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return;
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        formattedDateText.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}요일)`;
    }

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    datePicker.value = `${yyyy}-${mm}-${dd}`;
    updateDateDisplay(datePicker.value);
    datePicker.addEventListener('change', (e) => updateDateDisplay(e.target.value));

    const warningLayer = document.getElementById('mobile-warning');
    const closeWarningBtn = document.getElementById('close-warning-btn');
    if (closeWarningBtn) closeWarningBtn.addEventListener('click', () => warningLayer.style.display = 'none');

    let confirmCallback = null;
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    
    function showConfirmModal(message, callback) {
        confirmMessage.textContent = message;
        confirmCallback = callback;
        confirmModal.classList.remove('hidden');
    }

    document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        confirmCallback = null;
    });
    document.getElementById('confirm-ok-btn').addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        if (confirmCallback) { confirmCallback(); confirmCallback = null; }
    });

    let currentFloor = '3';
    let floorData = {
        '1': [], '2': [],
        '3': [
            { col: 17, row: 14, w: 2, h: 2, name: '방송실', info: '유휴 공간 아님', status: 'status-unavailable' },
            { col: 19, row: 14, w: 2, h: 2, name: '3학년 1반', info: '1,4교시 (수업중)', status: 'status-full' },
            { col: 21, row: 14, w: 2, h: 2, name: '과학실', info: '3~4교시 비어있음', status: 'status-partial' },
            { col: 17, row: 17, w: 3, h: 2, name: '유휴교실 A', info: '종일 비어있음', status: 'status-empty' }
        ]
    };

    const floorGrid = document.getElementById('floor-plan-grid');
    const floorListContainer = document.getElementById('floor-list');
    const floorLabel = document.getElementById('current-floor-label');

    function centerCamera() {
        const rooms = Array.from(floorGrid.querySelectorAll('.room'));
        if (rooms.length === 0) {
            floorGrid.style.transform = 'translate(-50%, -50%)';
            floorGrid.style.marginLeft = '0';
            floorGrid.style.marginTop = '0';
            return;
        }
        let minCol = Infinity, minRow = Infinity;
        let maxColEnd = -Infinity, maxRowEnd = -Infinity;
        rooms.forEach(room => {
            const style = window.getComputedStyle(room);
            const colStart = parseInt(style.gridColumnStart);
            const rowStart = parseInt(style.gridRowStart);
            const w = parseInt(style.gridColumn.match(/span\s+(\d+)/)?.[1] || 2);
            const h = parseInt(style.gridRow.match(/span\s+(\d+)/)?.[1] || 2);
            if (!isNaN(colStart) && colStart < minCol) minCol = colStart;
            if (!isNaN(rowStart) && rowStart < minRow) minRow = rowStart;
            if (!isNaN(colStart) && colStart + w > maxColEnd) maxColEnd = colStart + w;
            if (!isNaN(rowStart) && rowStart + h > maxRowEnd) maxRowEnd = rowStart + h;
        });
        const CELL_SIZE = 44; 
        const centerCol = (minCol + maxColEnd) / 2;
        const centerRow = (minRow + maxRowEnd) / 2;
        const centerX_px = (centerCol - 1) * CELL_SIZE;
        const centerY_px = (centerRow - 1) * CELL_SIZE;
        floorGrid.style.transform = 'none'; 
        floorGrid.style.marginLeft = `-${centerX_px}px`; 
        floorGrid.style.marginTop = `-${centerY_px}px`;
    }

    function saveCurrentFloor() {
        const rooms = Array.from(floorGrid.querySelectorAll('.room'));
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
        centerCamera(); 
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
                    showToast(`${floor}층 평면도를 불러왔습니다.`);
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
        floorManageModal.classList.add('hidden');
        showToast(`${nextFloor}층이 추가되었습니다.`);
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
            floorManageModal.classList.add('hidden');
            showToast(`${topFloorStr}층이 삭제되었습니다.`);
        });
    });

    renderFloor(currentFloor);

    const editToggle = document.getElementById('edit-mode-toggle');
    const editControls = document.getElementById('edit-controls');
    editToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            floorGrid.classList.add('edit-mode');
            editControls.classList.remove('hidden');
            showToast('편집 모드가 활성화되었습니다.');
        } else {
            floorGrid.classList.remove('edit-mode');
            editControls.classList.add('hidden');
            saveCurrentFloor();
            showToast('편집 모드가 종료되었습니다.');
        }
    });

    document.getElementById('add-room-btn').addEventListener('click', () => {
        const w = 2, h = 2; 
        const rooms = Array.from(floorGrid.querySelectorAll('.room'));
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
        centerCamera(); 
        showToast('새 교실이 추가되었습니다.');
    });

    const CELL_SIZE = 44; 
    let isDragging = false, isResizing = false, activeRoom = null;
    let startX, startY, startCol, startRow, startColSpan, startRowSpan;

    floorGrid.addEventListener('pointerdown', (e) => {
        if (!floorGrid.classList.contains('edit-mode')) return;
        const room = e.target.closest('.room');
        if (!room) return;
        if (e.target.closest('.room-edit-btn')) return;
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
        const dCols = Math.round((e.clientX - startX) / CELL_SIZE);
        const dRows = Math.round((e.clientY - startY) / CELL_SIZE);
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
        centerCamera(); 
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
        saveCurrentFloor(); showToast('교실 설정이 변경되었습니다.');
    });

    document.getElementById('delete-room-btn').addEventListener('click', () => {
        if (!editingRoomElement) return;
        showConfirmModal('정말 이 교실을 삭제하시겠습니까?', () => {
            editingRoomElement.remove(); roomEditModal.classList.add('hidden');
            editingRoomElement = null; saveCurrentFloor(); centerCamera(); 
            showToast('교실이 삭제되었습니다.');
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

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const checkedPeriods = Array.from(document.querySelectorAll('input[name="period"]:checked')).map(cb => cb.value);
        if (checkedPeriods.length === 0) { showToast('최소 1개 이상의 교시를 선택해주세요.'); return; }

        const roomSelect = form.querySelector('select');
        const scheduleData = {
            action: 'addSchedule',
            sheetId: connectedSheetId, 
            date: document.getElementById('modal-start-date').value,
            room: roomSelect.value, 
            periods: checkedPeriods,
            purpose: document.getElementById('schedule-purpose').value
        };

        if (!connectedSheetId || MASTER_GAS_URL.includes('여기에_마스터_주소')) {
            modal.classList.add('hidden');
            showToast(`[시트 미연결 테스트] 일정이 기록되었습니다.`);
            form.reset(); repeatEndGroup.classList.add('hidden');
            return;
        }

        showToast('서버에 일정을 저장하는 중...');
        fetch(MASTER_GAS_URL, { method: 'POST', body: JSON.stringify(scheduleData) })
        .then(response => response.json())
        .then(result => {
            modal.classList.add('hidden'); showToast(result.message);
            form.reset(); repeatEndGroup.classList.add('hidden');
        })
        .catch(error => showToast('저장 실패: 네트워크 오류가 발생했습니다.'));
    });

    document.getElementById('schedule-tbody').addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-schedule-btn')) {
            const row = e.target.closest('tr');
            const roomName = row.children[1].textContent;
            const purpose = row.children[3].textContent;
            const targetDate = datePicker.value;

            showConfirmModal(`[${roomName}]의 '${purpose}' 일정을 삭제하시겠습니까?`, () => {
                if (!connectedSheetId || MASTER_GAS_URL.includes('여기에_마스터_주소')) {
                    row.remove();
                    showToast('일정이 삭제되었습니다. (시트 미연결)');
                    return;
                }

                showToast('서버에서 일정을 삭제하는 중...');
                fetch(MASTER_GAS_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'deleteSchedule',
                        sheetId: connectedSheetId,
                        date: targetDate,
                        room: roomName,
                        purpose: purpose
                    })
                })
                .then(response => response.json())
                .then(result => {
                    row.remove(); 
                    showToast(result.message);
                })
                .catch(error => {
                    showToast('삭제 실패: 네트워크 오류가 발생했습니다.');
                });
            });
        }
    });

    // === 💡 개선: 설정(Settings) 모달 상태 관리 ===
    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    
    // 뷰(View) 요소들
    const settingsUnconnectedView = document.getElementById('settings-unconnected-view');
    const settingsConnectedView = document.getElementById('settings-connected-view');
    
    // 버튼 및 입력 요소들
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
        // 🚀 연결 여부에 따라 보여주는 뷰(화면)를 똑똑하게 바꿉니다.
        if (connectedSheetId) {
            settingsConnectedView.classList.remove('hidden');
            settingsUnconnectedView.classList.add('hidden');
        } else {
            settingsConnectedView.classList.add('hidden');
            settingsUnconnectedView.classList.remove('hidden');
        }
        settingsModal.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

    // 미연결 상태: 새 링크 생성
    generateLinkBtn.addEventListener('click', () => {
        const inputUrl = sheetUrlInput.value.trim();
        const extractedId = extractSheetId(inputUrl);
        if (!extractedId) { showToast('올바른 구글 시트 주소가 아닙니다.'); return; }
        
        const baseUrl = window.location.origin + window.location.pathname;
        const newShareLink = `${baseUrl}?sheet=${extractedId}`;
        
        shareLinkInput.value = newShareLink;
        shareLinkGroup.classList.remove('hidden');
        showToast('전용 접속 링크가 생성되었습니다!');
    });

    // 연결 상태: 클립보드 복사 로직 🚀
    copyLinkBox.addEventListener('click', () => {
        const currentUrl = window.location.href;
        navigator.clipboard.writeText(currentUrl).then(() => {
            showToast('링크가 복사되었습니다!');
        }).catch(err => {
            // 구형 브라우저를 위한 백업 복사 방식
            const dummy = document.createElement('input');
            document.body.appendChild(dummy);
            dummy.value = currentUrl;
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);
            showToast('링크가 복사되었습니다!');
        });
    });

    // 연결 상태: '새로운 시트 연결하기' 버튼 클릭 시 뷰 전환 🐛
    showNewConnectBtn.addEventListener('click', () => {
        settingsConnectedView.classList.add('hidden');
        settingsUnconnectedView.classList.remove('hidden');
    });

    let toastTimeout; 
    function showToast(message) {
        const container = document.getElementById('toast-container');
        let toast = container.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            container.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
    }
});