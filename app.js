// Import the Firebase modules needed for modern CDN web structures
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Your verified Firebase configuration object pointed to your regional database
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

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Game States
const AVATARS = { host: '🌸', guest: '🦊' };
let myRole = null;       
let currentTurn = 'host'; 
let boardState = Array(9).fill(null);

// UI Components
const statusText = document.getElementById('status-text');
const boardEl = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const resetBtn = document.getElementById('reset-btn');
const p1Box = document.getElementById('p1-box');
const p2Box = document.getElementById('p2-box');
const p1NameEl = document.getElementById('p1-name');
const p2NameEl = document.getElementById('p2-name');

// Overlay Elements
const joinOverlay = document.getElementById('join-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const overlayBtn = document.getElementById('overlay-btn');
const usernameInput = document.getElementById('username-input');

const urlParams = new URLSearchParams(window.location.search);
let targetRoom = urlParams.get('room');

// Helper to get local player name entry
function getMyName() {
    return usernameInput.value.trim() || (myRole === 'host' ? 'Host' : 'Guest');
}

if (targetRoom) {
    myRole = 'guest';
    overlayTitle.innerText = "Entering the Garden...";
    overlaySubtitle.innerText = "Enter your name to connect to your partner.";
    overlayBtn.innerText = "🌸 Join Room";
    overlayBtn.classList.remove('hidden');
    
    overlayBtn.onclick = () => {
        overlayBtn.innerText = "Connecting...";
        overlayBtn.disabled = true;
        
        // Register Guest presence inside the active cloud room
        update(ref(db, `games/${targetRoom}`), {
            guestName: getMyName(),
            guestConnected: true
        }).then(() => {
            setupGameSync();
        });
    };
} else {
    myRole = 'host';
    // Generate an isolated, clean web room ID key string
    targetRoom = Math.random().toString(36).substring(2, 9);
    
    overlayTitle.innerText = "Invite Your Partner";
    overlaySubtitle.innerText = "Enter your name and share the invite link.";
    overlayBtn.classList.remove('hidden');
    
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${targetRoom}`;
    overlayBtn.onclick = () => {
        navigator.clipboard.writeText(inviteLink);
        overlayBtn.innerText = "🌸 Link Copied!";
        overlayBtn.style.background = "#e0f2f1";
        setTimeout(() => {
            overlayBtn.innerText = "📋 Copy Invite Link";
            overlayBtn.style.background = "var(--sakura-pink)";
        }, 2000);
        
        // Build initial structure for the newly initialized cloud room
        set(ref(db, `games/${targetRoom}`), {
            hostName: getMyName(),
            hostConnected: true,
            currentTurn: 'host',
            boardState: Array(9).fill(""),
            scores: { host: 0, guest: 0 }
        });
        
        setupGameSync();
    };
}

// Synchronization Stream Handler
function setupGameSync() {
    const roomRef = ref(db, `games/${targetRoom}`);
    
    // Automatically flag connection drops if the window tab closes unexpectedly
    onDisconnect(ref(db, `games/${targetRoom}/${myRole}Connected`)).set(false);

    onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // Map client UI strings directly with real-time variables
        p1NameEl.innerText = data.hostName || "Host";
        p2NameEl.innerText = data.guestName || "Guest";
        
        // Handle window UI display overlays depending on real-time presence markers
        if (data.hostConnected && data.guestConnected) {
            joinOverlay.classList.add('fade-out');
            boardEl.classList.remove('disabled');
        } else {
            joinOverlay.classList.remove('fade-out');
            overlayTitle.innerText = "Connection Dropped 🌸";
            overlaySubtitle.innerText = "Waiting for your partner to re-enter the link...";
            overlayBtn.classList.add('hidden');
            boardEl.classList.add('disabled');
        }

        // Align local application board variables with server snapshots
        boardState = data.boardState.map(val => val === "" ? null : val);
        currentTurn = data.currentTurn;
        
        // Repaint grid cells based on downloaded snapshots
        cells.forEach((cell, idx) => {
            const cellValue = boardState[idx];
            cell.innerText = cellValue ? AVATARS[cellValue] : '';
            if (cellValue) {
                cell.classList.add('taken');
            } else {
                cell.classList.remove('taken', 'winner');
            }
        });

        // Sync scoreboard components
        const currentHostScore = data.scores?.host || 0;
        const currentGuestScore = data.scores?.guest || 0;
        document.getElementById('p1-score').innerText = currentHostScore;
        document.getElementById('p2-score').innerText = currentGuestScore;

        // Run local state evaluation matrices
        if (checkWin()) {
            highlightWin();
            const winnerName = currentTurn === 'host' ? p1NameEl.innerText : p2NameEl.innerText;
            statusText.innerText = `${winnerName} Wins the Round! 🌟`;
            boardEl.classList.add('disabled');
            resetBtn.classList.remove('hidden');
        } else if (boardState.every(cell => cell !== null)) {
            statusText.innerText = "A Peaceful Draw! 🥂";
            resetBtn.classList.remove('hidden');
        } else {
            resetBtn.classList.add('hidden');
            if (data.hostConnected && data.guestConnected) {
                boardEl.classList.remove('disabled');
            }
            updateTurnIndicators();
        }
    });
}

// Catch click events and apply structural adjustments directly up to the Firebase tree path
cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (boardState[index] || currentTurn !== myRole) return;

        // Form temporary updates matrix properties
        const updates = {};
        updates[`games/${targetRoom}/boardState/${index}`] = myRole;

        if (boardState.filter(c => c !== null).length >= 4 && checkWinWithMove(index, myRole)) {
            // Read target snapshot path once to calculate cumulative score sums cleanly
            onValue(ref(db, `games/${targetRoom}/scores`), (snapshot) => {
                const currentScores = snapshot.val() || { host: 0, guest: 0 };
                updates[`games/${targetRoom}/scores/${myRole}`] = (currentScores[myRole] || 0) + 1;
            }, { onlyOnce: true });
        } else {
            // Swap turns inside state mapping updates
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
    return winPatterns.some(pattern => {
        return pattern.every(index => boardState[index] === currentTurn);
    });
}

// Clean diagnostic method to evaluate scoring loops before mutation actions finish uploading
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

// Clear grid items and update matching cloud paths to original defaults
resetBtn.addEventListener('click', () => {
    update(ref(db, `games/${targetRoom}`), {
        boardState: Array(9).fill(""),
        currentTurn: 'host'
    });
});
