import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, ref, set, get, onValue, update, push 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- FIREBASE CONFIGURATION ---
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
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

// --- DOM ELEMENTS ---
const joinOverlay = document.getElementById('join-overlay');
const usernameInput = document.getElementById('username-input');
const googleLoginBtn = document.getElementById('google-login-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const joinCodeBtn = document.getElementById('join-code-btn');
const roomWaitBox = document.getElementById('room-wait-box');
const lobbyInteractiveSection = document.getElementById('lobby-interactive-section');
const roomCodeDisplay = document.getElementById('room-code-display');
const copyLinkBtn = document.getElementById('copy-link-btn');

const userProfileBar = document.getElementById('user-profile-bar');
const userAvatar = document.getElementById('user-avatar');
const userNameDisplay = document.getElementById('user-name-display');
const userStatsDisplay = document.getElementById('user-stats-display');
const logoutBtn = document.getElementById('logout-btn');

const statusText = document.getElementById('status-text');
const activeRoomBadge = document.getElementById('active-room-badge');
const gameRoomCode = document.getElementById('game-room-code');

const p1Name = document.getElementById('p1-name');
const p1Score = document.getElementById('p1-score');
const p1Box = document.getElementById('p1-box');

const p2Name = document.getElementById('p2-name');
const p2Score = document.getElementById('p2-score');
const p2Box = document.getElementById('p2-box');

const boardElement = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const rematchBtn = document.getElementById('rematch-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

const chatBox = document.getElementById('chat-box');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const toggleChatBtn = document.getElementById('toggle-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');

const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardList = document.getElementById('leaderboard-list');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const musicToggleBtn = document.getElementById('music-toggle-btn');

// --- GUEST DEVICE ID SETUP ---
let guestId = localStorage.getItem('guest_player_id');
if (!guestId) {
    guestId = 'guest_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('guest_player_id', guestId);
}

// --- STATE VARIABLES ---
let currentUser = null;
let currentRoomCode = null;
let playerRole = null;
let isMyTurn = false;
let gameBoard = Array(9).fill("");

const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'error', icon = '⚠️') {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast) return;

    toastMsg.textContent = message;
    toastIcon.textContent = icon;
    toast.className = `toast ${type}`;

    setTimeout(() => toast.classList.add('hidden'), 4000);
}

// --- MUSIC PLAYER ---
const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.5;
let isMusicPlaying = false;

if (musicToggleBtn) {
    musicToggleBtn.addEventListener('click', () => {
        if (isMusicPlaying) {
            bgMusic.pause();
            musicToggleBtn.textContent = '🎵';
            isMusicPlaying = false;
            showToast("Music Paused", "info", "🎵");
        } else {
            bgMusic.play().then(() => {
                musicToggleBtn.textContent = '🔊';
                isMusicPlaying = true;
                showToast("Playing Music", "success", "🔊");
            }).catch(() => {
                showToast("Click again to play music", "error", "🎵");
            });
        }
    });
}

// --- AUTHENTICATION & GUEST SYNC ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (usernameInput) usernameInput.value = user.displayName || 'Player';
        if (userAvatar) userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
        if (userNameDisplay) userNameDisplay.textContent = user.displayName || 'Player';
        if (userProfileBar) userProfileBar.classList.remove('hidden');

        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        if (!snap.exists()) {
            await set(userRef, { name: user.displayName || 'Player', wins: 0, isGuest: false });
        }
    } else {
        currentUser = null;
        if (userProfileBar) userProfileBar.classList.add('hidden');
    }
});

if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            showToast("Signed in!", "success", "✅");
        } catch (err) {
            showToast("Login failed", "error", "🚫");
        }
    });
}

if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => location.reload()));

// Save Guest or Logged user profile to DB so leaderboard records them
async function syncUserProfile(name) {
    const uid = currentUser ? currentUser.uid : guestId;
    const userRef = ref(db, `users/${uid}`);
    const snap = await get(userRef);
    if (!snap.exists()) {
        await set(userRef, { name: name, wins: 0, isGuest: !currentUser });
    } else {
        await update(userRef, { name: name });
    }
}

// --- ROOM LOGIC ---
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

if (createRoomBtn) {
    createRoomBtn.addEventListener('click', async () => {
        const playerName = usernameInput ? (usernameInput.value.trim() || 'Host') : 'Host';
        await syncUserProfile(playerName);

        currentRoomCode = generateRoomCode();
        playerRole = 'p1';

        const roomRef = ref(db, `rooms/${currentRoomCode}`);
        await set(roomRef, {
            p1: { name: playerName, score: 0 },
            p2: { name: 'Waiting...', score: 0 },
            board: Array(9).fill(""),
            turn: 'p1',
            status: 'waiting'
        });

        if (lobbyInteractiveSection) lobbyInteractiveSection.classList.add('hidden');
        if (roomWaitBox) roomWaitBox.classList.remove('hidden');
        if (roomCodeDisplay) roomCodeDisplay.textContent = currentRoomCode;

        listenToRoomUpdates(currentRoomCode);
    });
}

if (joinCodeBtn) {
    joinCodeBtn.addEventListener('click', async () => {
        const code = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : '';
        const playerName = usernameInput ? (usernameInput.value.trim() || 'Guest') : 'Guest';

        if (!code) return showToast("Enter room code!", "error", "✏️");

        await syncUserProfile(playerName);

        const roomRef = ref(db, `rooms/${code}`);
        const snapshot = await get(roomRef);

        if (!snapshot.exists()) return showToast("Room not found!", "error", "🔍");

        const data = snapshot.val();
        if (data.status !== 'waiting' && data.p2.name !== 'Waiting...') {
            return showToast("Room full!", "error", "🚫");
        }

        currentRoomCode = code;
        playerRole = 'p2';

        await update(ref(db, `rooms/${code}/p2`), { name: playerName });
        await update(ref(db, `rooms/${code}`), { status: 'playing' });

        if (joinOverlay) joinOverlay.classList.add('hidden');
        listenToRoomUpdates(code);
    });
}

function listenToRoomUpdates(code) {
    const roomRef = ref(db, `rooms/${code}`);

    onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (p1Name) p1Name.textContent = data.p1.name;
        if (p1Score) p1Score.textContent = data.p1.score;
        if (p2Name) p2Name.textContent = data.p2.name;
        if (p2Score) p2Score.textContent = data.p2.score;

        // FIXED: Render board state immediately
        gameBoard = data.board || Array(9).fill("");
        renderBoard();

        if (data.status === 'waiting') {
            if (statusText) statusText.textContent = "Waiting for opponent...";
            if (boardElement) boardElement.classList.add('disabled');
        } else if (data.status === 'playing') {
            if (joinOverlay) joinOverlay.classList.add('hidden');
            if (activeRoomBadge) activeRoomBadge.classList.remove('hidden');
            if (gameRoomCode) gameRoomCode.textContent = `ROOM: ${currentRoomCode}`;
            if (chatBox) chatBox.classList.remove('hidden');

            isMyTurn = (data.turn === playerRole);

            if (isMyTurn) {
                if (statusText) statusText.textContent = "Your Turn!";
                if (boardElement) boardElement.classList.remove('disabled');
            } else {
                if (statusText) statusText.textContent = `${data[data.turn].name}'s Turn...`;
                if (boardElement) boardElement.classList.add('disabled');
            }

            if (p1Box) p1Box.classList.toggle('active-turn', data.turn === 'p1');
            if (p2Box) p2Box.classList.toggle('active-turn', data.turn === 'p2');
        } else if (data.status === 'ended') {
            if (boardElement) boardElement.classList.add('disabled');
            if (p1Box) p1Box.classList.remove('active-turn');
            if (p2Box) p2Box.classList.remove('active-turn');

            if (data.winner === 'draw') {
                if (statusText) statusText.textContent = "It's a Draw! 🤝";
            } else {
                const winnerName = data[data.winner].name;
                if (statusText) statusText.textContent = `${winnerName} Wins! 🎉`;
            }

            if (playerRole === 'p1' && rematchBtn) rematchBtn.classList.remove('hidden');
        }
    });

    listenToChat(code);
}

function renderBoard() {
    cells.forEach((cell, index) => {
        const value = gameBoard[index];
        cell.textContent = value === 'X' ? '❌' : value === 'O' ? '⭕' : '';
    });
}

// FIXED: Move click logic correctly updates the board BEFORE game ends
cells.forEach((cell, index) => {
    cell.addEventListener('click', async () => {
        if (!isMyTurn || gameBoard[index] !== "") return;

        const symbol = playerRole === 'p1' ? 'X' : 'O';
        gameBoard[index] = symbol;

        // Optimistically render move locally so last mark is visible instantly
        renderBoard();

        const winState = checkWinner();
        const roomRef = ref(db, `rooms/${currentRoomCode}`);

        if (winState.hasWinner) {
            const winnerKey = playerRole;
            const currentScore = playerRole === 'p1' ? parseInt(p1Score.textContent) : parseInt(p2Score.textContent);

            // Update board first, then status to 'ended'
            await update(roomRef, { 
                board: gameBoard, 
                status: 'ended', 
                winner: winnerKey 
            });
            await update(ref(db, `rooms/${currentRoomCode}/${winnerKey}`), { score: currentScore + 1 });

            // Increment wins for player/guest
            const uid = currentUser ? currentUser.uid : guestId;
            const userRef = ref(db, `users/${uid}`);
            const snap = await get(userRef);
            const currentWins = snap.val()?.wins || 0;
            await update(userRef, { wins: currentWins + 1 });

        } else if (winState.isDraw) {
            await update(roomRef, { 
                board: gameBoard, 
                status: 'ended', 
                winner: 'draw' 
            });
        } else {
            const nextTurn = playerRole === 'p1' ? 'p2' : 'p1';
            await update(roomRef, { board: gameBoard, turn: nextTurn });
        }
    });
});

function checkWinner() {
    for (let combo of WINNING_COMBOS) {
        const [a, b, c] = combo;
        if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
            return { hasWinner: true, isDraw: false };
        }
    }
    return { hasWinner: false, isDraw: gameBoard.every(cell => cell !== "") };
}

if (rematchBtn) {
    rematchBtn.addEventListener('click', async () => {
        rematchBtn.classList.add('hidden');
        await update(ref(db, `rooms/${currentRoomCode}`), {
            board: Array(9).fill(""),
            turn: 'p1',
            status: 'playing'
        });
    });
}

if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', () => location.reload());

// --- CHAT LOGIC ---
if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = chatInput ? chatInput.value.trim() : '';
        if (!msg || !currentRoomCode) return;

        const senderName = usernameInput ? (usernameInput.value.trim() || 'Player') : 'Player';
        await push(ref(db, `chats/${currentRoomCode}`), {
            sender: senderName, role: playerRole, text: msg, timestamp: Date.now()
        });

        if (chatInput) chatInput.value = '';
    });
}

function listenToChat(code) {
    onValue(ref(db, `chats/${code}`), (snapshot) => {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        if (!snapshot.exists()) return;

        snapshot.forEach((child) => {
            const data = child.val();
            const msgDiv = document.createElement('div');
            msgDiv.classList.add('chat-msg');
            if (data.role === playerRole) msgDiv.classList.add('my-msg');
            msgDiv.innerHTML = `<strong>${data.sender}:</strong> ${data.text}`;
            chatMessages.appendChild(msgDiv);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

if (toggleChatBtn && chatBox) toggleChatBtn.addEventListener('click', () => chatBox.classList.remove('hidden'));
if (closeChatBtn && chatBox) closeChatBtn.addEventListener('click', () => chatBox.classList.add('hidden'));

// --- LEADERBOARD (SHOWS ALL USERS & GUESTS) ---
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', async () => {
        if (leaderboardModal) leaderboardModal.classList.remove('hidden');
        if (leaderboardList) leaderboardList.innerHTML = '<div style="padding:10px;">Loading Leaderboard...</div>';

        try {
            const snapshot = await get(ref(db, 'users'));
            let users = [];
            const currentUid = currentUser ? currentUser.uid : guestId;

            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const val = child.val();
                    const uid = child.key;

                    // Exclude current user from duplicate owner row
                    if (uid === currentUid) return;

                    if (val && typeof val === 'object') {
                        users.push({ 
                            name: val.name || 'Guest', 
                            wins: typeof val.wins === 'number' ? val.wins : 0 
                        });
                    }
                });
            }

            users.sort((a, b) => b.wins - a.wins);

            const activeName = (usernameInput && usernameInput.value.trim()) ? usernameInput.value.trim() : "Himanshu Yadav";

            let html = `
                <div class="lb-row owner-row">
                    <span class="owner-red-name">#1 👑 ${activeName}</span>
                    <span class="owner-tag">Owner</span>
                </div>
            `;

            if (users.length === 0) {
                html += `<div style="padding:12px; font-size:0.8rem; color:#64748b;">No other players yet!</div>`;
            } else {
                html += users.slice(0, 8).map((u, i) => `
                    <div class="lb-row">
                        <span>#${i + 2} ${u.name}</span>
                        <span class="lb-score">🏆 ${u.wins} Wins</span>
                    </div>
                `).join('');
            }

            if (leaderboardList) leaderboardList.innerHTML = html;
        } catch (err) {
            showToast("Failed to load leaderboard.", "error", "🏆");
        }
    });
}

if (closeLeaderboardBtn && leaderboardModal) {
    closeLeaderboardBtn.addEventListener('click', () => leaderboardModal.classList.add('hidden'));
}
