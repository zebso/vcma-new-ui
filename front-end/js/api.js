// API functions
function apiCall(endpoint, options = {}) {
  showLoading(true);

  const mergedOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options && options.headers)
    }
  };

  return fetch(`${API_BASE}${endpoint}`, mergedOptions)
    .then((response) =>
      response.json().then((data) => {
        if (!response.ok) {
          throw new Error(data.error || 'API error');
        }
        return data;
      })
    )
    .catch((error) => {
      showNotification(error.message, 'error');
      throw error;
    })
    .finally(() => {
      showLoading(false);
    });
}

function getBalance(id) {
  return apiCall(`/balance/${id}`);
}

function addMoney(id, amount, games = '', dealer = '') {
  return apiCall('/add', {
    method: 'POST',
    body: JSON.stringify({ id, amount, games, dealer })
  });
}

function subtractMoney(id, amount, games = '', dealer = '') {
  return apiCall('/subtract', {
    method: 'POST',
    body: JSON.stringify({ id, amount, games, dealer })
  });
}

function getHistory() {
  return apiCall('/history');
}

function getRanking() {
  return apiCall('/ranking');
}

function createUser(id = null, balance = 0) {
  const body = {};
  if (id) body.id = id;
  if (balance > 0) body.balance = balance;

  return apiCall('/users', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

function getDashboardStats() {
  return apiCall('/dashboard-stats');
}