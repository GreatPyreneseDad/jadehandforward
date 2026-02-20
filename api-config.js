// API Configuration
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : window.location.origin; // Same domain in production

// API Helper Functions
async function apiCall(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const token = localStorage.getItem('jade_auth_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Fetch live auction
async function getLiveAuction() {
  return apiCall('/api/auction/live', { skipAuth: true });
}

// Chat with AI agent
async function chatWithAgent(message, history = []) {
  return apiCall('/api/agent/chat', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ message, history }),
  });
}

// Register as hunter
async function registerHunter(data) {
  return apiCall('/api/hunters/register', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify(data),
  });
}

// Get marketplace listings
async function getMarketplaceListings(type = null) {
  const query = type ? `?type=${type}` : '';
  return apiCall(`/api/marketplace/listings${query}`, { skipAuth: true });
}

// Login with magic link
async function loginWithEmail(email) {
  return apiCall('/api/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email }),
  });
}

// Create Stripe checkout for coins
async function createCoinCheckout(tier_usd) {
  return apiCall('/api/coins/checkout', {
    method: 'POST',
    body: JSON.stringify({ tier_usd }),
  });
}

// Get coin balance
async function getCoinBalance() {
  return apiCall('/api/coins/balance');
}

// Place bid on auction lot
async function placeBid(auctionId, lotId, amountCoins) {
  return apiCall(`/api/auction/${auctionId}/bid`, {
    method: 'POST',
    body: JSON.stringify({ lot_id: lotId, amount_coins: amountCoins }),
  });
}
