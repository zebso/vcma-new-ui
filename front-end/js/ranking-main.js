const API_BASE = '';
const UPDATE_INTERVAL = 3000;

function formatBalance(balance) {
  return balance.toLocaleString('ja-JP');
}

async function fetchRanking() {
  try {
    const res = await fetch(`${API_BASE}/api/ranking`);
    if (!res.ok) throw new Error('Failed to fetch ranking');
    const data = await res.json();
    return data.slice(0, 5);
  } catch (err) {
    console.error('Error fetching ranking:', err);
    return null;
  }
}

function renderRanking(ranking) {
  const content = document.getElementById('content');

  if (!ranking || ranking.length === 0) {
    content.innerHTML = '<div class="error-message">データがありません</div>';
    return;
  }

  const top3 = ranking.slice(0, 3);
  const others = ranking.slice(3, 5);

  let html = '<div class="podium-container">';

  const order = [1, 0, 2];
  order.forEach(idx => {
    if (top3[idx]) {
      const user = top3[idx];
      const rank = idx + 1;
      html += `
            <div class="podium-item rank-${rank}">
              <div class="podium-rank">#${rank}</div>
              <div class="podium-card">
                <div class="podium-id">${user.id}</div>
                <div class="podium-balance">${formatBalance(user.balance)}</div>
              </div>
            </div>
          `;
    }
  });

  html += '</div>';

  if (others.length > 0) {
    html += '<div class="others-container">';
    others.forEach((user, idx) => {
      const rank = idx + 4;
      html += `
            <div class="other-item">
              <div class="other-rank">#${rank}</div>
              <div class="other-info">
                <div class="other-id">${user.id}</div>
                <div class="other-balance">${formatBalance(user.balance)}</div>
              </div>
            </div>
          `;
    });
    html += '</div>';
  }

  content.innerHTML = html;
}

async function updateRanking() {
  const ranking = await fetchRanking();
  if (ranking) {
    renderRanking(ranking);
  }
}

updateRanking();
setInterval(updateRanking, UPDATE_INTERVAL);