// API functions
async function apiCall(endpoint, options = {}) {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API error');
    }

    return data;
  } catch (error) {
    showNotification(error.message, 'error');
    throw error;
  } finally {
    showLoading(false);
  }
}

async function getBalance(id) {
  const data = await apiCall(`/balance/${id}`);
  return data;
}

async function addMoney(id, amount, games = '', dealer = '') {
  const data = await apiCall('/add', {
    method: 'POST',
    body: JSON.stringify({ id, amount, games, dealer })
  });
  return data;
}

async function subtractMoney(id, amount, games = '', dealer = '') {
  const data = await apiCall('/subtract', {
    method: 'POST',
    body: JSON.stringify({ id, amount, games, dealer })
  });
  return data;
}

async function getHistory() {
  const data = await apiCall('/history');
  return data;
}

async function getRanking() {
  const data = await apiCall('/ranking');
  return data;
}

async function createUser(id = null, balance = 0) {
  const body = {};
  if (id) body.id = id;
  if (balance > 0) body.balance = balance;

  const data = await apiCall('/users', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return data;
}

async function getDashboardStats() {
  const data = await apiCall('/dashboard-stats');
  return data;
}