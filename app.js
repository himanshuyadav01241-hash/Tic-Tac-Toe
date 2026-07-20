import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, ref, set, get, onValue, update, push, serverTimestamp, onDisconnect 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- FIREBASE CONFIG ---
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

// --- MASTER DEVELOPER ACCOUNT ---
const MASTER_DEVELOPER_EMAIL = "himanshu.yadav01241@gmail.com";

let currentUser = null;
let currentRoomId = null;
let playerSymbol = null;
let isMyTurn = false;
let gameActive = false;
let isMusicPlaying = false;

// DOM Elements
const overlay = document.getElementById('join-overlay');
const gameContainer = document.querySelector('.game-container');
const usernameInput = document.getElementById('username-input');
const googleBtn = document.getElementById('google-login-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinCodeBtn = document.getElementById('join-code-btn');
const roomCodeInput = document.getElementById('room-code-input');
const lobbyInteractiveSection = document.getElementById('lobby-interactive-section');
const roomWaitBox = document.getElementById('room-wait-box');
const roomCodeDisplay = document.getElementById('room-code-display');
const copyLinkBtn = document.getElementById('copy-link-btn');

const profileBar = document.getElementById('user-profile-bar');
const userAvatar = document.getElementById('user-avatar');
const userNameDisplay = document.getElementById('user-name-display');
const userStatsDisplay = document.getElementById('user-stats-display');
const editProfileBtn = document.getElementById('edit-profile-btn');
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
const toggleChatBtn = document.getElementById('toggle-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');

const rematchBtn = document.getElementById('rematch-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const leaderboardList = document.getElementById('leaderboard-list');

const musicToggleBtn = document.getElementById('music-toggle-btn');
const bgMusic = document.getElementById('bg-music');

if (overlay && !overlay.classList.contains('hidden') && gameContainer) {
    gameContainer.classList.add('hidden');
}

// --- BACKGROUND MUSIC TOGGLE ---
if (musicToggleBtn && bgMusic) {
    bgMusic.volume = 0.3;

    musicToggleBtn.addEventListener('click', () => {
        if (isMusicPlaying) {
            bgMusic.pause();
            musicToggleBtn.textContent = '🔇';
            isMusicPlaying = false;
        } else {
            bgMusic.play().then(() => {
                musicToggleBtn.textContent = '🎵';
                isMusicPlaying = true;
            }).catch(err => console.log("Audio playback blocked:", err));
        }
    });
}

// --- ADVANCED NAME & PROFILE SYNC FUNCTION ---
async function syncUserProfile(user, newName = null) {
    if (!user) return;

    const targetName = newName || user.displayName || 'Player';

    // 1. Update Auth Profile
    if (newName && user.displayName !== newName) {
        await updateProfile(user, { displayName: targetName });
    }

    // 2. Update/Preserve Database record with Email
    const userRef = ref(db, `users/${user.uid}`);
    await update(userRef, { 
        name: targetName,
        email: user.email || '',
        isDeveloper: (user.email === MASTER_DEVELOPER_EMAIL)
    });

    // 3. UI Updates
    if (userNameDisplay) userNameDisplay.textContent = targetName;
    if (usernameInput) usernameInput.value = targetName;
    if (googleBtn) {
        googleBtn.innerHTML = `✓ Signed in as ${targetName.split(' ')[0]}`;
        googleBtn.classList.add('signed-in');
    }

    // 4. Active Room Updates
    if (currentRoomId && playerSymbol) {
        const roomPlayerRef = ref(db, `rooms/${currentRoomId}/${playerSymbol === 'X' ? 'p1' : 'p2'}`);
        await update(roomPlayerRef, { name: targetName });
    }
}

// --- AUTHENTICATION & PROFILE MANAGEMENT ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (userAvatar) userAvatar.src = user.photoURL || 'https://via.placeholder.com/30';
        if (profileBar) profileBar.classList.remove('hidden');

        await syncUserProfile(user);

        const userRef = ref(db, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            if (userStatsDisplay) userStatsDisplay.textContent = `Wins: ${snapshot.val().wins || 0}`;
        } else {
            await set(userRef, { 
                name: user.displayName || 'Player', 
                email: user.email || '',
                wins: 0, 
                isDeveloper: (user.email === MASTER_DEVELOPER_EMAIL) 
            });
            if (userStatsDisplay) userStatsDisplay.textContent = 'Wins: 0';
        }
    } else {
        currentUser = null;
        if (profileBar) profileBar.classList.add('hidden');
        if (usernameInput) usernameInput.value = '';
        if (googleBtn) {
            googleBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18"> Link Account with Google`;
            googleBtn.classList.remove('signed-in');
        }
    }
});

// --- CHANGE NAME ACTION ---
if (editProfileBtn) {
    editProfileBtn.addEventListener('click', async () => {
        const currentName = currentUser ? currentUser.displayName : (usernameInput ? usernameInput.value : '');
        const newName = prompt("Enter your new display name:", currentName);

        if (!newName || !newName.trim()) return;
        const trimmedName = newName.trim();

        try {
            if (currentUser) {
                await syncUserProfile(currentUser, trimmedName);
            } else {
                if (usernameInput) usernameInput.value = trimmedName;
                if (currentRoomId && playerSymbol) {
                    const roomPlayerRef = ref(db, `rooms/${currentRoomId}/${playerSymbol === 'X' ? 'p1' : 'p2'}`);
                    await update(roomPlayerRef, { name: trimmedName });
                }
            }
            alert("Display name updated everywhere!");
        } catch (err) {
            alert("Failed to update profile: " + err.message);
        }
    });
}

if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        if (currentUser) return;
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                alert("Google Sign-In failed: " + err.message);
            }
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth));
}

// --- ROOM CREATION & JOINING LOGIC ---
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

if (createRoomBtn) {
    createRoomBtn.addEventListener('click', async () => {
        const name = usernameInput.value.trim() || (currentUser ? currentUser.displayName : "Host");
        const roomId = generateRoomCode();

        const playerId = currentUser ? currentUser.uid : 'guest_' + name.replace(/\s+/g, '_');

        const roomRef = ref(db, `rooms/${roomId}`);
        await set(roomRef, {
            p1: { name: name, score: 0, id: playerId, connected: true },
            p2: null,
            board: Array(9).fill(''),
            turn: 'X',
            status: 'waiting',
            winner: null
        });

        const p1StatusRef = ref(db, `rooms/${roomId}/p1/connected`);
        onDisconnect(p1StatusRef).set(false);

        if (lobbyInteractiveSection) lobbyInteractiveSection.classList.add('hidden');
        if (roomWaitBox) roomWaitBox.classList.remove('hidden');
        if (roomCodeDisplay) roomCodeDisplay.textContent = roomId;

        joinRoom(roomId, 'X', false);
    });
}

if (joinCodeBtn) {
    joinCodeBtn.addEventListener('click', async () => {
        const roomId = roomCodeInput.value.trim().toUpperCase();
        if (!roomId) return alert("Please enter a room code!");

        const roomRef = ref(db, `rooms/${roomId}`);
        const snapshot = await get(roomRef);

        if (!snapshot.exists()) return alert("Room not found!");
        const room = snapshot.val();

        if (room.p2) return alert("Room is full!");

        const name = usernameInput.value.trim() || (currentUser ? currentUser.displayName : "Guest");
        const playerId = currentUser ? currentUser.uid : 'guest_' + name.replace(/\s+/g, '_');

        await update(roomRef, {
            p2: { name: name, score: 0, id: playerId, connected: true },
            status: 'playing'
        });

        const p2StatusRef = ref(db, `rooms/${roomId}/p2/connected`);
        onDisconnect(p2StatusRef).set(false);

        joinRoom(roomId, 'O', true);
    });
}

function joinRoom(roomId, symbol, closeOverlayImmediately = false) {
    currentRoomId = roomId;
    playerSymbol = symbol;

    if (closeOverlayImmediately) {
        if (overlay) overlay.classList.add('hidden');
        if (gameContainer) gameContainer.classList.remove('hidden');
    }

    if (activeRoomBadge) activeRoomBadge.classList.remove('hidden');
    if (gameRoomCode) gameRoomCode.textContent = `ROOM: ${roomId}`;
    if (chatBox) chatBox.classList.remove('hidden');
    if (toggleChatBtn) toggleChatBtn.classList.remove('hidden');
    if (leaveRoomBtn) leaveRoomBtn.classList.remove('hidden');

    listenToRoom(roomId);
    listenToChat(roomId);
}

// --- GAMEPLAY & WIN LOGIC ---
function listenToRoom(roomId) {
    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(roomRef, (snapshot) => {
        const room = snapshot.val();
        if (!room) return;

        if (room.status === 'playing') {
            if (overlay) overlay.classList.add('hidden');
            if (gameContainer) gameContainer.classList.remove('hidden');
        }

        if (room.status === 'playing') {
            if (room.p1 && room.p1.connected === false) {
                update(roomRef, { status: 'abandoned', winner: 'O' });
            } else if (room.p2 && room.p2.connected === false) {
                update(roomRef, { status: 'abandoned', winner: 'X' });
            }
        }

        if (p1Name) p1Name.textContent = room.p1?.name || "Host";
        if (p2Name) p2Name.textContent = room.p2?.name || "Waiting...";
        if (p1Score) p1Score.textContent = room.p1?.score || 0;
        if (p2Score) p2Score.textContent = room.p2?.score || 0;

        renderBoard(room.board);

        if (room.status === 'waiting') {
            if (statusText) statusText.textContent = "Waiting for an opponent...";
            if (boardEl) boardEl.classList.add('disabled');
        } else if (room.status === 'playing') {
            gameActive = true;
            isMyTurn = (room.turn === playerSymbol);
            if (statusText) statusText.textContent = isMyTurn ? "Your turn!" : `${room.turn === 'X' ? room.p1.name : room.p2.name}'s turn...`;
            
            if (p1Box) p1Box.classList.toggle('active-turn', room.turn === 'X');
            if (p2Box) p2Box.classList.toggle('active-turn', room.turn === 'O');
            
            if (boardEl) {
                if (isMyTurn) boardEl.classList.remove('disabled');
                else boardEl.classList.add('disabled');
            }
            if (rematchBtn) rematchBtn.classList.add('hidden');
        } else if (room.status === 'abandoned') {
            gameActive = false;
            if (boardEl) boardEl.classList.add('disabled');
            const winnerSymbol = room.winner;
            if (winnerSymbol === playerSymbol) {
                if (statusText) statusText.textContent = "Opponent disconnected. You win by default! 🎉";
            } else {
                if (statusText) statusText.textContent = "You left the game.";
            }
            if (rematchBtn) rematchBtn.classList.add('hidden');
        } else if (room.status === 'ended') {
            gameActive = false;
            if (boardEl) boardEl.classList.add('disabled');

            if (rematchBtn) {
                rematchBtn.textContent = "Next Round 🔄";
                if (playerSymbol === 'X') {
                    rematchBtn.classList.remove('hidden');
                } else {
                    rematchBtn.classList.add('hidden');
                }
            }

            if (statusText) {
                if (room.winner === 'draw') {
                    statusText.textContent = "It's a draw!";
                } else {
                    const winnerName = room.winner === 'X' ? room.p1.name : room.p2.name;
                    statusText.textContent = `${winnerName} wins!`;
                }
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

                const winnerObj = isP1 ? room.p1 : room.p2;
                if (winnerObj.id) {
                    const userWinRef = ref(db, `users/${winnerObj.id}`);
                    const winSnap = await get(userWinRef);
                    const currentWins = winSnap.exists() ? (winSnap.val().wins || 0) : 0;
                    
                    // Safely update wins without destroying email or developer flags
                    await update(userWinRef, {
                        name: winnerObj.name,
                        wins: currentWins + 1,
                        isGuest: winnerObj.id.startsWith('guest_')
                    });
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

if (rematchBtn) {
    rematchBtn.addEventListener('click', async () => {
        if (playerSymbol !== 'X') return;
        const roomRef = ref(db, `rooms/${currentRoomId}`);
        await update(roomRef, {
            board: Array(9).fill(''),
            turn: 'X',
            status: 'playing',
            winner: null
        });
    });
}

if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener('click', async () => {
        if (currentRoomId) {
            const playerStatusRef = ref(db, `rooms/${currentRoomId}/${playerSymbol === 'X' ? 'p1' : 'p2'}/connected`);
            await set(playerStatusRef, false);
        }
        location.reload();
    });
}

// --- CHAT SYSTEM ---
if (toggleChatBtn) {
    toggleChatBtn.addEventListener('click', () => chatBox.classList.remove('hidden'));
}

if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => chatBox.classList.add('hidden'));
}

if (chatForm) {
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
}

function listenToChat(roomId) {
    const chatRef = ref(db, `chats/${roomId}`);
    onValue(chatRef, (snapshot) => {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        const myName = usernameInput.value.trim() || playerSymbol;

        snapshot.forEach((child) => {
            const data = child.val();
            const isMe = data.sender === myName;

            const msgEl = document.createElement('div');
            msgEl.className = `chat-msg ${isMe ? 'my-msg' : ''}`;
            msgEl.innerHTML = `<strong>${data.sender}:</strong> ${data.text}`;
            chatMessages.appendChild(msgEl);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// --- LEADERBOARD LOGIC (MASTER EMAIL ALWAYS AT #1) ---
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', async () => {
        if (leaderboardModal) leaderboardModal.classList.remove('hidden');
        if (leaderboardList) leaderboardList.innerHTML = 'Loading leaderboard...';

        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);

        if (!snapshot.exists()) {
            if (leaderboardList) leaderboardList.innerHTML = 'No scores recorded yet!';
            return;
        }

        let allUsers = [];
        snapshot.forEach((child) => {
            const val = child.val();
            allUsers.push({
                uid: child.key,
                name: val.name || 'Anonymous',
                email: val.email || '',
                wins: val.wins || 0,
                isGuest: val.isGuest || child.key.startsWith('guest_')
            });
        });

        // Match Developer entry by email
        let developerUser = allUsers.find(u => u.email === MASTER_DEVELOPER_EMAIL);
        
        let devName = 'Himanshu Yadav';
        let devWins = 0;

        if (developerUser) {
            devName = developerUser.name;
            devWins = developerUser.wins;
        } else if (currentUser && currentUser.email === MASTER_DEVELOPER_EMAIL) {
            devName = currentUser.displayName || 'Himanshu Yadav';
        }

        // Exclude master developer from remaining rankings
        let otherUsers = allUsers.filter(u => u.email !== MASTER_DEVELOPER_EMAIL);
        otherUsers.sort((a, b) => b.wins - a.wins);

        let htmlContent = `
            <div class="lb-row developer-account">
                <span class="lb-name">#1 ${devName} [Developer]</span>
                <span class="lb-score">🏆 ${devWins} Wins</span>
            </div>
        `;

        otherUsers.slice(0, 9).forEach((u, i) => {
            const rank = i + 2;
            const rowClass = u.isGuest ? 'guest-account' : '';
            const label = u.isGuest ? ' (Guest)' : '';

            htmlContent += `
                <div class="lb-row ${rowClass}">
                    <span class="lb-name">#${rank} ${u.name}${label}</span>
                    <span class="lb-score">🏆 ${u.wins} Wins</span>
                </div>
            `;
        });

        if (leaderboardList) {
            leaderboardList.innerHTML = htmlContent;
        }
    });
}

if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener('click', () => {
        if (leaderboardModal) leaderboardModal.classList.add('hidden');
    });
}

const copyAction = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert("Room code copied to clipboard!");
};

if (copyLinkBtn) copyLinkBtn.addEventListener('click', () => copyAction(currentRoomId));
if (copyGameLinkBtn) copyGameLinkBtn.addEventListener('click', () => copyAction(currentRoomId));
