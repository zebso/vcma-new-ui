// API functions
function apiCall(endpoint, options) {
  if (typeof options === 'undefined') options = {};
  showLoading(true);

  // Object.assign でヘッダーをマージ（スプレッド構文の代替）
  var mergedOptions = Object.assign({}, options);
  var baseHeaders = { 'Content-Type': 'application/json' };
  var optHeaders = (options && options.headers) ? options.headers : {};
  mergedOptions.headers = Object.assign({}, baseHeaders, optHeaders);

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
    .then(
      function (value) { showLoading(false); return value; },
      function (err)   { showLoading(false); throw err; }
    );
}

function getBalance(id) {
  return apiCall(`/balance/${id}`);
}

function addMoney(id, amount, games = '') {
  return apiCall('/add', {
    method: 'POST',
    body: JSON.stringify({ id, amount, games })
  });
}

function subtractMoney(id, amount, games = '') {
  return apiCall('/subtract', {
    method: 'POST',
    body: JSON.stringify({ id, amount, games })
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

function getGameLimits() {
  return apiCall('/game-limits');
}