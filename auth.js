// MSAL Configuration
const msalConfig = {
  auth: {
    clientId: "b0565fdb-6754-40e3-9446-72afdf056f0b",
    authority: "https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47",
    redirectUri: window.location.origin + "/index.html"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

// Scopes for token request
const tokenRequest = {
  scopes: ["b0565fdb-6754-40e3-9446-72afdf056f0b/.default"]
};

// Initialize MSAL
const msalInstance = new msal.PublicClientApplication(msalConfig);

// Global authentication state
let currentAccessToken = null;
let tokenExpiresOn = null;
let pendingMidAuthToken = null;
let chatRestored = false;

// Check if token is expired or will expire soon (within 5 minutes)
function isTokenExpired() {
  if (!tokenExpiresOn) return true;
  const now = new Date();
  const expiryTime = new Date(tokenExpiresOn);
  const timeUntilExpiry = expiryTime - now;
  const fiveMinutes = 5 * 60 * 1000;
  return timeUntilExpiry < fiveMinutes;
}

// Refresh the access token
async function refreshToken() {
  console.log('[Auth] Refreshing access token...');
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    console.error('[Auth] No accounts found for token refresh');
    return null;
  }

  const request = {
    ...tokenRequest,
    account: accounts[0]
  };

  try {
    const response = await msalInstance.acquireTokenSilent(request);
    currentAccessToken = response.accessToken;
    tokenExpiresOn = response.expiresOn;
    console.log('[Auth] Token refreshed successfully');
    console.log('[Auth] New token expires:', new Date(tokenExpiresOn));
    return currentAccessToken;
  } catch (error) {
    console.error('[Auth] Token refresh failed:', error);
    // Fall back to interactive redirect
    await msalInstance.acquireTokenRedirect(request);
    return null;
  }
}

// Define window.auth.getAuthenticationToken for Omnichannel authenticated chat
window.auth = {};
window.auth.getAuthenticationToken = async function(callback) {
  console.log('[Auth] window.auth.getAuthenticationToken() called by Omnichannel widget');

  try {
    // Check if token exists and is valid
    if (currentAccessToken && !isTokenExpired()) {
      console.log('[Auth] Returning cached AAD access token');
      callback(currentAccessToken);
    } else if (currentAccessToken && isTokenExpired()) {
      // Token exists but is expired or expiring soon - refresh it
      console.log('[Auth] Token expired or expiring soon, refreshing...');
      const newToken = await refreshToken();
      if (newToken) {
        callback(newToken);
      } else {
        console.error('[Auth] Token refresh failed');
        callback(null);
      }
    } else {
      console.log('[Auth] No access token available. User may not be logged in.');
      callback(null);
    }
  } catch (error) {
    console.error('[Auth] Error in getAuthenticationToken:', error);
    callback(null);
  }
};

// Login function - saves return URL and initiates login
async function login() {
  try {
    console.log('[Auth] Initiating MSAL login redirect...');

    // Save the current page URL to return to after login
    const returnUrl = window.location.pathname + window.location.search + window.location.hash;
    localStorage.setItem('auth-return-url', returnUrl);
    console.log('[Auth] Saved return URL:', returnUrl);

    // Save widget state if widget is loaded
    if (typeof widgetLoaded !== 'undefined' && widgetLoaded) {
      const widgetState = {
        widgetWasLoaded: true,
        timestamp: Date.now()
      };
      localStorage.setItem('widget-state-before-login', JSON.stringify(widgetState));
      console.log('[Auth] Saved widget state before login redirect');
    }

    await msalInstance.loginRedirect(tokenRequest);
  } catch (error) {
    console.error('[Auth] Login failed:', error);
    alert('Login failed: ' + error.message);
  }
}

// Logout function - stays on current page
function logout() {
  console.log('[Auth] Initiating logout...');

  // Clear auth state
  currentAccessToken = null;
  tokenExpiresOn = null;
  pendingMidAuthToken = null;
  chatRestored = false;

  // Save current page to return to after logout
  const currentPage = window.location.href;
  const currentPath = window.location.pathname;
  localStorage.setItem('auth-logout-return-url', currentPage);

  // Mark that we need to clear chat storage after logout redirect
  // Store which page type to determine what to clear
  if (currentPath.includes('support-auth.html') || currentPath.includes('reconnect.html')) {
    localStorage.setItem('auth-clear-chat-on-return', 'true');
    console.log('[Auth] ⚠️ MARKED CHAT FOR CLEARING AFTER LOGOUT - Flag set to true');
    console.log('[Auth] Current path:', currentPath);
  } else {
    console.log('[Auth] Not marking for clearing - current path:', currentPath);
  }

  // Trigger logout event for pages to handle (e.g., clear chat for authenticated chat pages)
  const logoutEvent = new CustomEvent('auth:logout', {
    detail: { timestamp: Date.now() }
  });
  window.dispatchEvent(logoutEvent);
  console.log('[Auth] Dispatched auth:logout event');

  // Update UI
  updateAuthUI();

  // Clear user info display if it exists
  const userInfoElement = document.getElementById('user-info');
  if (userInfoElement) {
    userInfoElement.innerHTML = '';
  }

  // IMPORTANT: Add a small delay to ensure event handlers complete before redirect
  setTimeout(() => {
    // Verify flag was set before redirecting
    const flagCheck = localStorage.getItem('auth-clear-chat-on-return');
    console.log('[Auth] 🔍 Flag check before redirect:', flagCheck);
    console.log('[Auth] 🔍 Return URL before redirect:', localStorage.getItem('auth-logout-return-url'));

    // Use logoutRedirect with postLogoutRedirectUri set to current page
    const account = msalInstance.getAllAccounts()[0];
    if (account) {
      console.log('[Auth] 🚪 Calling logoutRedirect to:', currentPage);
      msalInstance.logoutRedirect({
        account: account,
        postLogoutRedirectUri: currentPage
      });
    } else {
      // No account found, just clear cache and reload
      console.log('[Auth] No account found, clearing cache');
      msalInstance.clearCache();
      window.location.reload();
    }
  }, 100); // 100ms delay to allow event handlers to complete
}

// Get access token silently
async function getToken() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    console.error('[Auth] No accounts found');
    return null;
  }

  const request = {
    ...tokenRequest,
    account: accounts[0]
  };

  try {
    // Try to get token silently
    const response = await msalInstance.acquireTokenSilent(request);
    currentAccessToken = response.accessToken;
    tokenExpiresOn = response.expiresOn;

    console.log('[Auth] AAD Access Token acquired');
    console.log('[Auth] Token length:', currentAccessToken.length);
    console.log('[Auth] Token expires:', new Date(tokenExpiresOn));

    // Update UI
    updateAuthUI(response.account);

    // Store as pending if widget is loaded
    if (typeof widgetLoaded !== 'undefined' && widgetLoaded) {
      console.log('[Auth] Widget loaded - storing pending token');
      pendingMidAuthToken = currentAccessToken;

      // Check if chat already restored
      if (chatRestored) {
        console.log('[Auth] Chat already restored - sending token now');
        sendMidAuthToken();
      } else {
        console.log('[Auth] Waiting for chat to restore from cache...');
      }
    }

    return currentAccessToken;

  } catch (error) {
    console.error('[Auth] Silent token acquisition failed:', error);
    // Fall back to interactive redirect method
    await msalInstance.acquireTokenRedirect(request);
    return null;
  }
}

// Update authentication UI
function updateAuthUI(account) {
  const authButton = document.getElementById('auth-button');
  const userInfo = document.getElementById('user-info-text');

  if (!authButton) return;

  if (account) {
    // User is logged in
    authButton.textContent = 'Logout';
    authButton.className = 'auth-button logout';
    authButton.onclick = logout;

    if (userInfo) {
      userInfo.textContent = account.name || account.username;
    }
  } else {
    // User is not logged in
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      authButton.textContent = 'Logout';
      authButton.className = 'auth-button logout';
      authButton.onclick = logout;

      if (userInfo) {
        userInfo.textContent = accounts[0].name || accounts[0].username;
      }
    } else {
      authButton.textContent = 'Login';
      authButton.className = 'auth-button';
      authButton.onclick = login;

      if (userInfo) {
        userInfo.textContent = '';
      }
    }
  }
}

// Handle redirect promise on page load
async function handleAuthRedirect() {
  console.log('[Auth] 🚀 handleAuthRedirect() called - checking for redirects...');

  try {
    const response = await msalInstance.handleRedirectPromise();
    console.log('[Auth] MSAL redirect response:', response ? 'Login response received' : 'No response');

    if (response) {
      console.log('[Auth] Redirect response received');
      console.log('[Auth] Login successful via redirect');

      // Store token
      currentAccessToken = response.accessToken;
      tokenExpiresOn = response.expiresOn;
      console.log('[Auth] AAD Access Token acquired:', currentAccessToken ? 'Token acquired' : 'No token');
      console.log('[Auth] Token expires:', new Date(tokenExpiresOn));

      // Store as pending for widget
      pendingMidAuthToken = currentAccessToken;

      // Update UI
      updateAuthUI(response.account);

      // Check if widget was loaded before login
      const widgetState = localStorage.getItem('widget-state-before-login');
      if (widgetState) {
        try {
          const state = JSON.parse(widgetState);
          console.log('[Auth] Widget was loaded before login - will auto-reload...', state);

          // Remove the state flag
          localStorage.removeItem('widget-state-before-login');

          // Trigger widget reload (if function exists)
          if (typeof loadWidget === 'function') {
            setTimeout(() => {
              console.log('[Auth] Auto-loading widget after login...');
              loadWidget();
            }, 1000);
          }
        } catch (e) {
          console.error('[Auth] Error parsing widget state:', e);
        }
      }

      // Check for return URL
      const returnUrl = localStorage.getItem('auth-return-url');
      if (returnUrl && returnUrl !== window.location.pathname) {
        console.log('[Auth] Redirecting to return URL:', returnUrl);
        localStorage.removeItem('auth-return-url');
        window.location.href = returnUrl;
        return;
      } else {
        localStorage.removeItem('auth-return-url');
      }

    } else {
      // Check if this is a logout redirect return
      const logoutReturnUrl = localStorage.getItem('auth-logout-return-url');
      console.log('[Auth] Checking logout return - logoutReturnUrl:', logoutReturnUrl);

      if (logoutReturnUrl) {
        console.log('[Auth] ✅ RETURNED FROM LOGOUT REDIRECT');
        localStorage.removeItem('auth-logout-return-url');

        // Check if we need to clear chat storage
        const shouldClearChat = localStorage.getItem('auth-clear-chat-on-return');
        console.log('[Auth] Should clear chat flag value:', shouldClearChat);

        if (shouldClearChat === 'true') {
          console.log('[Auth] 🧹 CLEARING CHAT STORAGE AFTER LOGOUT...');
          localStorage.removeItem('auth-clear-chat-on-return');

          // Clear all chat-related storage
          clearChatStorage();

          console.log('[Auth] ✅ Chat storage clearing completed');
        } else {
          console.log('[Auth] ⚠️ Flag not set or not true - skipping chat clearing');
        }

        // Already on the correct page, just update UI
        updateAuthUI();
        return;
      } else {
        console.log('[Auth] Not a logout return - normal page load');
      }

      // No redirect response, check if user is already logged in
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        console.log('[Auth] User already logged in');
        await getToken();

        // Auto-load widget if user is logged in and widget config exists
        const savedConfig = localStorage.getItem('widget-config-current');
        if (savedConfig && typeof widgetLoaded !== 'undefined' && !widgetLoaded && typeof loadWidget === 'function') {
          console.log('[Auth] User logged in + widget config found - auto-loading widget...');
          setTimeout(() => {
            loadWidget();
          }, 1000);
        }
      } else {
        console.log('[Auth] No user logged in');
        updateAuthUI();
      }
    }
  } catch (error) {
    console.error('[Auth] Error handling redirect:', error);
    updateAuthUI();
  }
}

// Get current user info
function getCurrentUser() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    return {
      username: accounts[0].username,
      name: accounts[0].name,
      accountId: accounts[0].homeAccountId,
      tenantId: accounts[0].tenantId
    };
  }
  return null;
}

// Check if user is authenticated
function isAuthenticated() {
  const accounts = msalInstance.getAllAccounts();
  return accounts.length > 0 && currentAccessToken && !isTokenExpired();
}

// Clear chat storage (for authenticated and reconnect chat pages)
function clearChatStorage() {
  console.log('');
  console.log('========================================');
  console.log('🧹 CLEAR CHAT STORAGE FUNCTION CALLED');
  console.log('========================================');
  console.log('');

  // Clear localStorage
  try {
    const localStorageKeys = Object.keys(localStorage);
    console.log('[Auth] 📋 Total localStorage keys found:', localStorageKeys.length);
    console.log('[Auth] 📋 All localStorage keys:', localStorageKeys);
    let clearedCount = 0;

    localStorageKeys.forEach(key => {
      let shouldClear = false;

      // Check for standard Omnichannel keys
      if (key.startsWith('oc-lcw-') ||
          key.includes('Omnichannel') ||
          key.includes('livechat') ||
          key.includes('reconnectId') ||
          key.includes('chatToken')) {
        shouldClear = true;
      }

      // Check for keys containing liveChatContext in their value
      if (!shouldClear) {
        try {
          const value = localStorage.getItem(key);
          if (value && typeof value === 'string') {
            // Check if the value contains liveChatContext or domainStates
            if (value.includes('liveChatContext') ||
                value.includes('domainStates') ||
                value.includes('conversationId') ||
                value.includes('chatId')) {
              console.log('[Auth] Found chat context in key:', key);
              shouldClear = true;
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      if (shouldClear) {
        const value = localStorage.getItem(key);
        console.log('[Auth] ✅ CLEARING localStorage key:', key);
        console.log('[Auth] Key value (first 200 chars):', value ? value.substring(0, 200) : 'null');
        localStorage.removeItem(key);
        clearedCount++;
      }
    });

    if (clearedCount === 0) {
      console.log('[Auth] ⚠️ WARNING: No localStorage items matched clearing criteria');
      console.log('[Auth] This could mean:');
      console.log('[Auth] 1. Chat storage uses different key names than expected');
      console.log('[Auth] 2. Storage was already cleared');
      console.log('[Auth] 3. No chat session existed yet');
    }

    console.log(`[Auth] ✅ Cleared ${clearedCount} localStorage items`);
  } catch (e) {
    console.warn('[Auth] Could not clear localStorage:', e);
  }

  // Clear sessionStorage
  try {
    const sessionStorageKeys = Object.keys(sessionStorage);
    console.log('[Auth] 📋 Total sessionStorage keys found:', sessionStorageKeys.length);
    console.log('[Auth] 📋 All sessionStorage keys:', sessionStorageKeys);
    let clearedCount = 0;

    sessionStorageKeys.forEach(key => {
      let shouldClear = false;

      // Check for standard Omnichannel keys
      if (key.startsWith('oc-lcw-') ||
          key.includes('Omnichannel') ||
          key.includes('livechat') ||
          key.includes('reconnectId') ||
          key.includes('chatToken')) {
        shouldClear = true;
      }

      // Check for keys containing liveChatContext in their value
      if (!shouldClear) {
        try {
          const value = sessionStorage.getItem(key);
          if (value && typeof value === 'string') {
            if (value.includes('liveChatContext') ||
                value.includes('domainStates') ||
                value.includes('conversationId') ||
                value.includes('chatId')) {
              console.log('[Auth] Found chat context in sessionStorage key:', key);
              shouldClear = true;
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      if (shouldClear) {
        console.log('[Auth] ✅ CLEARING sessionStorage key:', key);
        sessionStorage.removeItem(key);
        clearedCount++;
      }
    });

    if (clearedCount === 0) {
      console.log('[Auth] ⚠️ WARNING: No sessionStorage items matched clearing criteria');
    }

    console.log(`[Auth] ✅ Cleared ${clearedCount} sessionStorage items`);
  } catch (e) {
    console.warn('[Auth] Could not clear sessionStorage:', e);
  }

  // Also clear IndexedDB databases used by Omnichannel
  if (window.indexedDB) {
    try {
      console.log('[Auth] Attempting to clear IndexedDB databases...');

      // Common Omnichannel IndexedDB names
      const dbNamesToDelete = [
        'msal.db',
        'OmnichannelDB',
        'LiveChatWidgetDB'
      ];

      dbNamesToDelete.forEach(dbName => {
        const deleteRequest = window.indexedDB.deleteDatabase(dbName);
        deleteRequest.onsuccess = () => {
          console.log(`[Auth] Deleted IndexedDB: ${dbName}`);
        };
        deleteRequest.onerror = () => {
          console.log(`[Auth] Could not delete IndexedDB: ${dbName} (may not exist)`);
        };
      });
    } catch (e) {
      console.warn('[Auth] Could not clear IndexedDB:', e);
    }
  }
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Auth] Initializing authentication...');
  handleAuthRedirect();
});

// Set active navigation link
function setActiveNavLink() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.site-nav a');

  navLinks.forEach(link => {
    const linkPath = new URL(link.href).pathname;
    if (linkPath === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Set active nav on page load
document.addEventListener('DOMContentLoaded', setActiveNavLink);
