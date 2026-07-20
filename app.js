// --- LEADERBOARD (PURE SCORE-BASED) ---
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', async () => {
        if (leaderboardModal) leaderboardModal.classList.remove('hidden');
        if (leaderboardList) leaderboardList.innerHTML = '<div style="padding:10px;">Fetching Top Players...</div>';

        try {
            const snapshot = await get(ref(db, 'users'));
            let users = [];

            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const val = child.val();
                    if (val && typeof val === 'object') {
                        users.push({ 
                            uid: child.key, 
                            name: val.name || 'Anonymous', 
                            wins: typeof val.wins === 'number' ? val.wins : 0 
                        });
                    }
                });
            }

            // Sort players by highest wins first
            users.sort((a, b) => b.wins - a.wins);

            let html = '';

            if (users.length === 0) {
                html = `<div style="padding:10px; font-size:0.8rem; color:#64748b;">No rank history found yet! Play a match to get listed.</div>`;
            } else {
                html = users.slice(0, 10).map((u, i) => {
                    const isCrown = i === 0 ? '👑 ' : '';
                    const isMe = currentUser && u.uid === currentUser.uid;
                    const nameDisplay = isMe ? `${u.name} (You)` : u.name;

                    return `
                        <div class="lb-row ${isMe ? 'owner-row' : ''}">
                            <span class="${isMe ? 'owner-name' : ''}">#${i + 1} ${isCrown}${nameDisplay}</span>
                            <span class="lb-score">🏆 ${u.wins} Wins</span>
                        </div>
                    `;
                }).join('');
            }

            if (leaderboardList) leaderboardList.innerHTML = html;
        } catch (err) {
            showToast("Failed to load leaderboard.", "error", "🏆");
        }
    });
}
