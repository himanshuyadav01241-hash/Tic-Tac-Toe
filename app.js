import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, update, onValue, push, onDisconnect, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCP43ySOR5fIvOUDnCiAoK-kJol-0rF0Iw",
  authDomain: "tictactoe-e747b.firebaseapp.com",
  databaseURL: "https://tictactoe-e747b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tictactoe-e747b",
  storageBucket: "tictactoe-e747b.firebasestorage.app",
  messagingSenderId: "864419563280",
  appId: "1:864419563280:web:ed84b02a67e0d8e29cc795"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const AVATARS = { host: '🌸', guest: '🦊' };
let myRole = null;       
let currentTurn = 'host'; 
let boardState = Array(9).fill(null);
let targetRoom = null;
let currentUser = null;

const bgMusic = document.getElementById('bg-music');
const musicToggleBtn = document.getElementById('music-toggle-btn');
let musicPlaying = false;

const googleLoginBtn = document.getElementById('google-login-btn');
const userProfileBar = document.getElementById('user-profile-bar');
const userAvatar = document.getElementById('user-avatar');
const userNameDisplay = document.getElementById('user-name-display');
const userStatsDisplay = document.getElementById('user-stats-display');
const logoutBtn = document.getElementById('logout-btn');

const statusText = document.getElementById('status-text');
const boardEl = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const rematchBtn = document.getElementById('rematch-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const p1NameEl = document.getElementById('p1-name');
const p2NameEl = document.getElementById('p2-name');

const joinOverlay = document.getElementById('join-overlay');
const usernameInput = document.getElementById('username-input');
const createRoomBtn = document.getElementById('create-room-btn');
const joinCodeBtn = document.getElementById('join-code-btn');
const roomCodeInput = document.getElementById('room-code-input');
const roomWaitBox = document.getElementById('room-wait-box');
const roomCodeDisplay = document.getElementById('room-code-display');
const copyLinkBtn = document.getElementById('copy-link-btn');
const activeRoomBadge = document.getElementById('active-room-badge');
const gameRoomCode = document.getElementById('game-room-code');

const chatBox = document.getElementById('chat-box');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

// Handle Google Login with fallback
googleLoginBtn.onclick = () => {
    signInWithPopup(auth, googleProvider).catch(() => signInWithRedirect(auth, googleProvider));
};

logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const name = user.displayName ? user.displayName.split(' ')[0] : 'Player';
        usernameInput.value = name;
        userAvatar.src = user.photoURL || '';
        userNameDisplay.innerText = name;
        userProfileBar.classList.remove('hidden');
        googleLoginBtn.classList.add('hidden');
        loadUserStats(user.uid);
    } else {
        currentUser = null;
        userProfileBar.classList.add('hidden');
        googleLoginBtn.classList.remove('hidden');
    }
});

function loadUserStats(uid) {
    onValue(ref(db, `users/${uid}/wins`), (snap) => {
        userStatsDisplay.innerText = `Wins: ${snap.val() || 0}`;
    });
}

function getMyName() {
    return usernameInput.value.trim() || (myRole === 'host' ? 'Host' : 'Guest');
}

// Room Creation & Joining
createRoomBtn.onclick = () => {
    if (!musicPlaying) musicToggleBtn.click();
    myRole = 'host';
    targetRoom = Math.random().toString(36).substring(2, 8).toUpperCase();

    set(ref(db, `games/${targetRoom}`), {
        hostName: getMyName(),
        hostConnected: true,
        currentTurn: 'host',
        boardState: Array(9).fill(""),
        scores: { host: 0, guest: 0 }
    });

    document.getElementById('lobby-interactive-section').classList.add('hidden');
    roomWaitBox.classList.remove('hidden');
    roomCodeDisplay.innerText = targetRoom;
    setupGameSync();
};

joinCodeBtn.onclick = () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) return;
    if (!musicPlaying) musicToggleBtn.click();

    myRole = 'guest';
    targetRoom = code;

    update(ref(db, `games/${targetRoom}`), {
        guestName: getMyName(),
        guestConnected: true
    }).then(() => setupGameSync());
};

copyLinkBtn.onclick = () => {
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${targetRoom}`);
    copyLinkBtn.innerText = "🌸 Link Copied!";
    setTimeout(() => copyLinkBtn.innerText = "📋 Copy Direct Link", 2000);
};

function setupGameSync() {
    const roomRef = ref(db, `games/${targetRoom}`);
    onDisconnect(ref(db, `games/${targetRoom}/${myRole}Connected`)).set(false);

    // Active Room Code Top Display
    activeRoomBadge.classList.remove('hidden');
    gameRoomCode.innerText = `ROOM: ${targetRoom}`;

    onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        p1NameEl.innerText = data.hostName || "Host";
        p2NameEl.innerText = data.guestName || "Guest";

        if (data.hostConnected && data.guestConnected) {
            joinOverlay.classList.add('fade-out');
            boardEl.classList.remove('disabled');
            leaveRoomBtn.classList.remove('hidden');
            chatBox.classList.remove('hidden');
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

        if (checkWin()) {
            highlightWin();
            const winnerName = currentTurn === 'host' ? p1NameEl.innerText : p2NameEl.innerText;
            statusText.innerText = `${winnerName} Wins! 🌟`;
            boardEl.classList.add('disabled');
            rematchBtn.classList.remove('hidden');

            if (currentTurn === myRole && currentUser) {
                // Record win to profile
                get(ref(db, `users/${currentUser.uid}/wins`)).then((s) => {
                    set(ref(db, `users/${currentUser.uid}/wins`), (s.val() || 0) + 1);
                    set(ref(db, `users/${currentUser.uid}/name`), getMyName());
                });
            }
        } else if (boardState.every(cell => cell !== null)) {
            statusText.innerText = "Peaceful Draw! 🥂";
            rematchBtn.classList.remove('hidden');
        } else {
            rematchBtn.classList.add('hidden');
            if (data.hostConnected && data.guestConnected) boardEl.classList.remove('disabled');
            statusText.innerText = currentTurn === myRole ? "Your Turn ✨" : "Partner's turn...";
        }
    });

    // Chat Listener
    onValue(ref(db, `games/${targetRoom}/chats`), (snap) => {
        chatMessages.innerHTML = '';
        const chats = snap.val() || {};
        Object.values(chats).forEach(c => {
            const div = document.createElement('div');
            div.className = 'chat-msg';
            div.innerText = `${c.sender}: ${c.text}`;
            chatMessages.appendChild(div);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

chatForm.onsubmit = (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    push(ref(db, `games/${targetRoom}/chats`), { sender: getMyName(), text: text });
    chatInput.value = '';
};

// Controls
musicToggleBtn.onclick = () => {
    if (musicPlaying) bgMusic.pause();
    else bgMusic.play().catch(() => {});
    musicPlaying = !musicPlaying;
};

cells.forEach(cell => {
    cell.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (boardState[index] || currentTurn !== myRole) return;
        const updates = {};
        updates[`games/${targetRoom}/boardState/${index}`] = myRole;
        if (!checkWinWithMove(index, myRole)) updates[`games/${targetRoom}/currentTurn`] = myRole === 'host' ? 'guest' : 'host';
        update(ref(db), updates);
    });
});

const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function checkWin() { return winPatterns.some(p => p.every(i => boardState[i] === currentTurn)); }
function checkWinWithMove(i, role) { const b = [...boardState]; b[i] = role; return winPatterns.some(p => p.every(idx => b[idx] === role)); }
function highlightWin() { winPatterns.forEach(p => { if (p.every(i => boardState[i] === currentTurn)) p.forEach(i => cells[i].classList.add('winner')); }); }

rematchBtn.onclick = () => update(ref(db, `games/${targetRoom}`), { boardState: Array(9).fill(""), currentTurn: 'host' });
leaveRoomBtn.onclick = () => window.location.href = window.location.pathname;

// Leaderboard Modal Logic
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeLbBtn = document.getElementById('close-leaderboard-btn');
const lbList = document.getElementById('leaderboard-list');

leaderboardBtn.onclick = () => {
    leaderboardModal.classList.remove('hidden');
    get(ref(db, 'users')).then(snap => {
        lbList.innerHTML = '';
        const users = snap.val() || {};
        Object.values(users).sort((a,b) => (b.wins||0) - (a.wins||0)).forEach(u => {
            const row = document.createElement('div');
            row.className = 'lb-row';
            row.innerHTML = `<span>${u.name || 'Anonymous'}</span><strong>${u.wins || 0} Wins</strong>`;
            lbList.appendChild(row);
        });
    });
};
closeLbBtn.onclick = () => leaderboardModal.classList.add('hidden');
