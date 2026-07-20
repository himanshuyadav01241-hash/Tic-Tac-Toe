import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, update, onValue, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCP43ySOR5fIvOUDnCiAoK-kJol-0rF0Iw",
  authDomain: "tictactoe-e747b.firebaseapp.com",
  databaseURL: "https://tictactoe-e747b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tictactoe-e747b",
  storageBucket: "tictactoe-e747b.firebasestorage.app",
  messagingSenderId: "864419563280",
  appId: "1:864419563280:web:ed84b02a67e0d8e29cc795",
  measurementId: "G-R8M0VCC2WC"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Game States
const AVATARS = { host: '🌸', guest: '🦊' };
let myRole = null;       
let currentTurn = 'host'; 
let boardState = Array(9).fill(null);
let targetRoom = null;
let roomListener = null;

// Audio System (Synthesized Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let musicMuted = false;
let sfxMuted = false;

function playSound(type) {
    if (sfxMuted) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'move') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'win') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    }
}

// Background Music Synthesizer Loop
let musicInterval = null;
function startBackgroundMusic() {
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00];
    let noteIdx = 0;
    
    musicInterval = setInterval(() => {
        if (musicMuted) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[noteIdx % notes.length], audioCtx.currentTime);
        gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
        noteIdx++;
    }, 1500);
}

// Elements
const statusText = document.getElementById('status-text');
const boardEl = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const rematchBtn = document.getElementById('rematch-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const p1Box = document.getElementById('p1-box');
const p2Box = document.getElementById('p2-box');
const p1NameEl = document.getElementById('p1-name');
const p2NameEl = document.getElementById('p2-name');

const joinOverlay = document.getElementById('join-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const usernameInput = document.getElementById('username-input');

const createRoomBtn = document.getElementById('create-room-btn');
const joinCodeBtn = document.getElementById('join-code-btn');
const roomCodeInput = document.getElementById('room-code-input');
const lobbyActions = document.getElementById('lobby-actions');
const roomWaitBox = document.getElementById('room-wait-box');
const roomCodeDisplay = document.getElementById('room-code-display');
const copyLinkBtn = document.getElementById('copy-link-btn');

const musicToggleBtn = document.getElementById('music-toggle-btn');
const sfxToggleBtn = document.getElementById('sfx-toggle-btn');

function getMyName() {
    return usernameInput.value.trim() || (myRole === 'host' ? 'Host' : 'Guest');
}

// Audio Controls Toggles
musicToggleBtn.onclick = () => {
    musicMuted = !musicMuted;
    musicToggleBtn.classList.toggle('muted', musicMuted);
    if (!musicInterval && !musicMuted) startBackgroundMusic();
};

sfxToggleBtn.onclick = () => {
    sfxMuted = !sfxMuted;
    sfxToggleBtn.classList.toggle('muted', sfxMuted);
};

// Check for direct link join room parameter
const urlParams = new URLSearchParams(window.location.search);
const directRoom = urlParams.get('room');
if (directRoom) {
    roomCodeInput.value = directRoom;
}

// Create Room Handler
createRoomBtn.onclick = () => {
    audioCtx.resume();
    if (!musicInterval) startBackgroundMusic();

    myRole = 'host';
    targetRoom = Math.random().toString(36).substring(2, 8).toUpperCase();

    set(ref(db, `games/${targetRoom}`), {
        hostName: getMyName(),
        hostConnected: true,
        currentTurn: 'host',
        boardState: Array(9).fill(""),
        scores: { host: 0, guest: 0 },
        rematchRequest: { host: false, guest: false }
    });

    lobbyActions.classList.add('hidden');
    roomWaitBox.classList.remove('hidden');
    roomCodeDisplay.innerText = `Room Code: ${targetRoom}`;
    
    setupGameSync();
};

// Join Room Handler
joinCodeBtn.onclick = () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) return;

    audioCtx.resume();
    if (!musicInterval) startBackgroundMusic();

    myRole = 'guest';
    targetRoom = code;

    update(ref(db, `games/${targetRoom}`), {
        guestName: getMyName(),
        guestConnected: true
    }).then(() => {
        setupGameSync();
    });
};

// Copy Room Link Handler
copyLinkBtn.onclick = () => {
    const link = `${window.location.origin}${window.location.pathname}?room=${targetRoom}`;
    navigator.clipboard.writeText(link);
    copyLinkBtn.innerText = "🌸 Link Copied!";
    setTimeout(() => copyLinkBtn.innerText = "📋 Copy Invite Link", 2000);
};

// Main Real-Time State Listener
function setupGameSync() {
    const roomRef = ref(db, `games/${targetRoom}`);
    onDisconnect(ref(db, `games/${targetRoom}/${myRole}Connected`)).set(false);

    roomListener = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        p1NameEl.innerText = data.hostName || "Host";
        p2NameEl.innerText = data.guestName || "Guest";

        if (data.hostConnected && data.guestConnected) {
            joinOverlay.classList.add('fade-out');
            boardEl.classList.remove('disabled');
            leaveRoomBtn.classList.remove('hidden');
        } else {
            joinOverlay.classList.remove('fade-out');
            overlayTitle.innerText = "Waiting for Partner...";
            overlaySubtitle.innerText = `Share code ${targetRoom} with your friend!`;
            boardEl.classList.add('disabled');
        }

        boardState = data.boardState.map(val => val === "" ? null : val);
        currentTurn = data.currentTurn;

        cells.forEach((cell, idx) => {
            const cellValue = boardState[idx];
            cell.innerText = cellValue ? AVATARS[cellValue] : '';
            if (cellValue) cell.classList.add('taken');
            else cell.classList.remove('taken', 'winner');
        });

        document.getElementById('p1-score').innerText = data.scores?.host || 0;
        document.getElementById('p2-score').innerText = data.scores?.guest || 0;

        // Check Rematch Consensus
        const rematch = data.rematchRequest || {};
        if (rematch.host && rematch.guest) {
            // Both accepted - reset the board
            update(ref(db, `games/${targetRoom}`), {
                boardState: Array(9).fill(""),
                currentTurn: 'host',
                rematchRequest: { host: false, guest: false }
            });
            rematchBtn.innerText = "🌸 Request Rematch";
            rematchBtn.disabled = false;
        } else if (rematch[myRole]) {
            rematchBtn.innerText = "⏳ Waiting for Partner...";
            rematchBtn.disabled = true;
        } else if (rematch[myRole === 'host' ? 'guest' : 'host']) {
            rematchBtn.innerText = "✨ Accept Rematch!";
            rematchBtn.disabled = false;
        }

        if (checkWin()) {
            highlightWin();
            playSound('win');
            const winnerName = currentTurn === 'host' ? p1NameEl.innerText : p2NameEl.innerText;
            statusText.innerText = `${winnerName} Wins the Round! 🌟`;
            boardEl.classList.add('disabled');
            rematchBtn.classList.remove('hidden');
        } else if (boardState.every(cell => cell !== null)) {
            statusText.innerText = "A Peaceful Draw! 🥂";
            rematchBtn.classList.remove('hidden');
        } else {
            rematchBtn.classList.add('hidden');
            if (data.hostConnected && data.guestConnected) boardEl.classList.remove('disabled');
            updateTurnIndicators();
        }
    });
}

// User Move Action
cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (boardState[index] || currentTurn !== myRole) return;

        playSound('move');
        const updates = {};
        updates[`games/${targetRoom}/boardState/${index}`] = myRole;

        if (boardState.filter(c => c !== null).length >= 4 && checkWinWithMove(index, myRole)) {
            onValue(ref(db, `games/${targetRoom}/scores`), (snapshot) => {
                const currentScores = snapshot.val() || { host: 0, guest: 0 };
                updates[`games/${targetRoom}/scores/${myRole}`] = (currentScores[myRole] || 0) + 1;
            }, { onlyOnce: true });
        } else {
            updates[`games/${targetRoom}/currentTurn`] = myRole === 'host' ? 'guest' : 'host';
        }

        update(ref(db), updates);
    });
});

function updateTurnIndicators() {
    const currentName = currentTurn === 'host' ? p1NameEl.innerText : p2NameEl.innerText;
    statusText.innerText = currentTurn === myRole ? "Your Turn ✨" : `${currentName} is choosing a tile...`;

    if (currentTurn === 'host') {
        p1Box.classList.add('active-turn');
        p2Box.classList.remove('active-turn');
    } else {
        p2Box.classList.add('active-turn');
        p1Box.classList.remove('active-turn');
    }
}

const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function checkWin() {
    return winPatterns.some(pattern => pattern.every(index => boardState[index] === currentTurn));
}

function checkWinWithMove(index, role) {
    const tempBoard = [...boardState];
    tempBoard[index] = role;
    return winPatterns.some(pattern => pattern.every(i => tempBoard[i] === role));
}

function highlightWin() {
    winPatterns.forEach(pattern => {
        if (pattern.every(index => boardState[index] === currentTurn)) {
            pattern.forEach(index => cells[index].classList.add('winner'));
        }
    });
}

// Rematch Request System
rematchBtn.addEventListener('click', () => {
    const updates = {};
    updates[`games/${targetRoom}/rematchRequest/${myRole}`] = true;
    update(ref(db), updates);
});

// Leave Room Handler
leaveRoomBtn.addEventListener('click', () => {
    window.location.href = window.location.pathname;
});
