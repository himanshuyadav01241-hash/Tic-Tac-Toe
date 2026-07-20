import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, ref, set, get, onValue, update, push, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- REPLACE WITH YOUR FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// App State Variables
let currentUser = null;
let currentRoomId = null;
let playerSymbol = null; // 'X' or 'O'
let isMyTurn = false;
let gameActive = false;

// DOM Elements
const overlay = document.getElementById('join-overlay');
const usernameInput = document.getElementById('username-input');
const googleBtn = document.getElementById('google-login-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinCodeBtn = document.getElementById('join-code-btn');
const roomCodeInput = document.getElementById('room-code-input');
const roomWaitBox = document.getElementById('room-wait-box');
const roomCodeDisplay = document.getElementById('room-code-display');
const copyLinkBtn = document.getElementById('copy-link-btn');

const profileBar = document.getElementById('user-profile-bar');
const userAvatar = document.getElementById('user-avatar');
const userNameDisplay = document.getElementById('user-name-display');
const userStatsDisplay = document.getElementById('user-stats-display');
const logoutBtn = document.getElementById('logout-btn');

const statusText = document.getElementById('status-text');
const boardEl = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const p1Name = document.getElementById('p1-name');
const p2Name = document.getElementById('p2-name');
const p1Score = document.getElementById('p1-score');
const p2Score = document.getElementById('p2-score');
const p1Box = document.getElementById('p1-box');
const p2Box = document.getElementById('p2-box');

const activeRoomBadge = document.getElementById('active-room-badge');
const gameRoomCode = document.getElementById('game-room-code');
const copyGameLinkBtn = document.getElementById('copy-game-link');

const chatBox = document.getElementById('chat-box');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const rematchBtn = document.getElementById('rematch-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const leaderboardList = document.getElementById('leaderboard-list');

// --- AUTHENTICATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userAvatar.src = user.photoURL || 'https://via.placeholder.com/30';
        userNameDisplay.textContent = user.displayName || 'Player';
        profileBar.classList.remove('hidden');
        usernameInput.value = user.displayName || '';

        // Load stats
        const userRef = ref(db, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            userStatsDisplay.textContent = `Wins: ${snapshot.val().wins || 0}`;
        } else {
            await set(userRef, { name: user.displayName, wins: 0 });
            userStatsDisplay.textContent = 'Wins: 0';
        }
    } else {
        currentUser = null;
        profileBar.classList.add('hidden');
    }
});

googleBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (err) {
        alert("Google Sign-In failed: " + err.message);
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- ROOM LOGIC ---
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

createRoomBtn.addEventListener('click', async () => {
    const name = usernameInput.value.trim() || "Host";
    const roomId = generateRoomCode();

    const roomRef = ref(db, `rooms/${roomId}`);
    await set(roomRef, {
        p1: { name: name, score: 0, id: currentUser ? currentUser.uid : 'guest' },
        p2: null,
        board: Array(9).fill(''),
        turn: 'X',
        status: 'waiting',
        winner: null
    });

    joinRoom(roomId, 'X');
    roomCodeDisplay.textContent = roomId;
    roomWaitBox.classList.remove('hidden');
    document.getElementById('lobby-interactive-section').classList.add('hidden');
});

joinCodeBtn.addEventListener('click', async () => {
    const roomId = roomCodeInput.value.trim().toUpperCase();
    if (!roomId) return alert("Please enter a room code!");

    const roomRef = ref(db, `rooms/${roomId}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) return alert("Room not found!");
    const room = snapshot.val();

    if (room.p2) return alert("Room is full!");

    const name = usernameInput.value.trim() || "Guest";
    await update(roomRef, {
        p2: { name: name, score: 0, id: currentUser ? currentUser.uid : 'guest' },
        status: 'playing'
    });

    joinRoom(roomId, 'O');
});

function joinRoom(roomId, symbol) {
    currentRoomId = roomId;
    playerSymbol = symbol;

    overlay.classList.add('hidden');
    activeRoomBadge.classList.remove('hidden');
    gameRoomCode.textContent = `ROOM: ${roomId}`;
    chatBox.classList.remove('hidden');
    leaveRoomBtn.classList.remove('hidden');

    listenToRoom(roomId);
    listenToChat(roomId);
}

// --- GAMEPLAY LISTENER ---
function listenToRoom(roomId) {
    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(roomRef, (snapshot) => {
        const room = snapshot.val();
        if (!room) return;

        p1Name.textContent = room.p1?.name || "Host";
        p2Name.textContent = room.p2?.name || "Waiting...";
        p1Score.textContent = room.p1?.score || 0;
        p2Score.textContent = room.p2?.score || 0;

        renderBoard(room.board);

        if (room.status === 'waiting') {
            statusText.textContent = "Waiting for an opponent...";
            boardEl.classList.add('disabled');
        } else if (room.status === 'playing') {
            gameActive = true;
            isMyTurn = (room.turn === playerSymbol);
            statusText.textContent = isMyTurn ? "Your turn!" : `${room.turn === 'X' ? room.p1.name : room.p2.name}'s turn...`;
            
            p1Box.classList.toggle('active-turn', room.turn === 'X');
            p2Box.classList.toggle('active-turn', room.turn === 'O');
            
            if (isMyTurn) boardEl.classList.remove('disabled');
            else boardEl.classList.add('disabled');
            rematchBtn.classList.add('hidden');
        } else if (room.status === 'ended') {
            gameActive = false;
            boardEl.classList.add('disabled');
            rematchBtn.classList.remove('hidden');

            if (room.winner === 'draw') {
                statusText.textContent = "It's a draw!";
            } else {
                const winnerName = room.winner === 'X' ? room.p1.name : room.p2.name;
                statusText.textContent = `${winnerName} wins!`;
            }
        }
    });
}

function renderBoard(boardState) {
    cells.forEach((cell, i) => {
        cell.textContent = boardState[i] || '';
    });
}

cells.forEach((cell) => {
    cell.addEventListener('click', async () => {
        const index = cell.dataset.index;
        if (!gameActive || !isMyTurn || cell.textContent !== '') return;

        const roomRef = ref(db, `rooms/${currentRoomId}`);
        const snapshot = await get(roomRef);
        const room = snapshot.val();

        const newBoard = [...room.board];
        newBoard[index] = playerSymbol;

        const winner = checkWinner(newBoard);
        const nextTurn = playerSymbol === 'X' ? 'O' : 'X';

        if (winner) {
            let updates = {
                board: newBoard,
                status: 'ended',
                winner: winner
            };

            if (winner !== 'draw') {
                const isP1 = winner === 'X';
                updates[isP1 ? 'p1/score' : 'p2/score'] = (isP1 ? room.p1.score : room.p2.score) + 1;

                // Sync wins for logged in users
                const winnerObj = isP1 ? room.p1 : room.p2;
                if (winnerObj.id && winnerObj.id !== 'guest') {
                    const userWinRef = ref(db, `users/${winnerObj.id}/wins`);
                    const winSnap = await get(userWinRef);
                    await set(userWinRef, (winSnap.val() || 0) + 1);
                }
            }
            await update(roomRef, updates);
        } else {
            await update(roomRef, {
                board: newBoard,
                turn: nextTurn
            });
        }
    });
});

function checkWinner(b) {
    const wins = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    for (let [x, y, z] of wins) {
        if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x];
    }
    return b.includes('') ? null : 'draw';
}

// Rematch Button
rematchBtn.addEventListener('click', async () => {
    const roomRef = ref(db, `rooms/${currentRoomId}`);
    await update(roomRef, {
        board: Array(9).fill(''),
        turn: 'X',
        status: 'playing',
        winner: null
    });
});

// Leave / Reset
leaveRoomBtn.addEventListener('click', () => location.reload());

// --- CHAT SYSTEM ---
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg || !currentRoomId) return;

    const chatRef = ref(db, `chats/${currentRoomId}`);
    const name = usernameInput.value.trim() || playerSymbol;

    await push(chatRef, {
        sender: name,
        text: msg,
        time: serverTimestamp()
    });

    chatInput.value = '';
});

function listenToChat(roomId) {
    const chatRef = ref(db, `chats/${roomId}`);
    onValue(chatRef, (snapshot) => {
        chatMessages.innerHTML = '';
        snapshot.forEach((child) => {
            const data = child.val();
            const msgEl = document.createElement('div');
            msgEl.className = 'chat-msg';
            msgEl.innerHTML = `<strong>${data.sender}:</strong> ${data.text}`;
            chatMessages.appendChild(msgEl);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// --- LEADERBOARD ---
leaderboardBtn.addEventListener('click', async () => {
    leaderboardModal.classList.remove('hidden');
    leaderboardList.innerHTML = 'Loading...';

    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
        leaderboardList.innerHTML = 'No scores recorded yet!';
        return;
    }

    let users = [];
    snapshot.forEach((child) => {
        users.push(child.val());
    });

    users.sort((a, b) => (b.wins || 0) - (a.wins || 0));

    leaderboardList.innerHTML = users.slice(0, 10).map((u, i) => `
        <div class="lb-row">
            <span>#${i + 1} ${u.name || 'Anonymous'}</span>
            <span>🏆 ${u.wins || 0} Wins</span>
        </div>
    `).join('');
});

closeLeaderboardBtn.addEventListener('click', () => leaderboardModal.classList.add('hidden'));

// --- COPY LINK HANDLER ---
const copyAction = (text) => {
    navigator.clipboard.writeText(text);
    alert("Room Link/Code copied to clipboard!");
};

copyLinkBtn.addEventListener('click', () => copyAction(currentRoomId));
copyGameLinkBtn.addEventListener('click', () => copyAction(currentRoomId));
