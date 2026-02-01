# Power Pages Authentication Demo

A static HTML-based web application that mimics **Microsoft Power Pages** authentication behavior with Microsoft Omnichannel chat widgets. This demo uses MSAL.js for Azure AD authentication and demonstrates mid-authentication flow for chat widgets.

## Features

- **Azure AD Authentication** using MSAL.js (MSAL Browser v2.38.0)
- **Login Behavior**: Redirects back to the page where login was initiated
- **Logout Behavior**: Stays on the current page (no forced redirect)
- **Optional Authentication**: All pages and widgets accessible regardless of auth state
- **Mid-Authentication Support**: Automatically upgrades chat sessions when users log in
- **Persistent Auth State**: Authentication state persists across page reloads
- **Shared Navigation**: Consistent navigation across all pages

## Project Structure

```
jatinjd-midauth-static-app/
├── index.html              # Home page with welcome content
├── support-auth.html       # Authenticated chat widget page
├── support-unauth.html     # Unauthenticated chat widget page
├── auth.js                 # Shared authentication logic (MSAL)
├── styles.css              # Shared styles
├── staticwebapp.config.json # Azure Static Web Apps configuration
└── README.md               # This file
```

## Pages

### 1. Home (index.html)
- Welcome page explaining the application
- Links to both support pages
- Displays current user info if authenticated

### 2. Support (Authenticated Chat) - support-auth.html
- Displays **Widget 1**: Authenticated chat configuration
- Accessible to everyone (auth is optional)
- Auto-upgrades to authenticated mode when user logs in
- App ID: `9c155eb8-61cc-41ff-9433-16355ce73ed2`

### 3. Support (Unauthenticated Chat) - support-unauth.html
- Displays **Widget 2**: Unauthenticated chat configuration
- Accessible to everyone (auth is optional)
- Works anonymously, upgrades to authenticated if user logs in
- App ID: `50fbd2aa-1a19-475f-aeb6-59c8d15c8387`

## Authentication Flow

### Login Flow
1. User clicks "Login" button on any page
2. Current page URL is saved to localStorage (`auth-return-url`)
3. User is redirected to Azure AD login
4. After successful login, user is redirected back to the original page
5. If a chat widget was active, it auto-loads and sends mid-auth token

### Logout Flow
1. User clicks "Logout" button on any page
2. Authentication state is cleared
3. `auth:logout` event is dispatched for pages to handle
4. **Authenticated chat page**: Clears chat context/storage (user cannot reconnect to same session)
5. **Unauthenticated chat page**: Preserves chat context (user can always reconnect to same anonymous session)
6. User stays on the current page (redirect-based logout returns to same page)
7. No extra tabs or popups

### Mid-Authentication Flow
1. User opens a chat widget (authenticated or not)
2. User logs in while chatting
3. After login redirect, widget auto-reloads
4. After 3 seconds (to allow chat restoration), `setMidAuthToken()` is called
5. Chat session is upgraded to authenticated mode

## Configuration

### MSAL Configuration (auth.js)
```javascript
const msalConfig = {
  auth: {
    clientId: "b0565fdb-6754-40e3-9446-72afdf056f0b",
    authority: "https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47",
    redirectUri: window.location.origin + window.location.pathname
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};
```

### Token Scopes
```javascript
const tokenRequest = {
  scopes: ["b0565fdb-6754-40e3-9446-72afdf056f0b/.default"]
};
```

## Widget Configuration

### Widget 1 (Authenticated Chat)
- **App ID**: `9c155eb8-61cc-41ff-9433-16355ce73ed2`
- **Org ID**: `1e9d7bbe-facf-f011-8537-000d3a59231e`
- **Org URL**: `https://m-1e9d7bbe-facf-f011-8537-000d3a59231e.preprod.omnichannelengagementhub.com`
- **Script URL**: `https://msft-lcw-trial.azureedge.net/jatinjdd/0123/v2scripts/LiveChatBootstrapper.js`

### Widget 2 (Unauthenticated Chat)
- **App ID**: `50fbd2aa-1a19-475f-aeb6-59c8d15c8387`
- **Org ID**: `1e9d7bbe-facf-f011-8537-000d3a59231e`
- **Org URL**: `https://m-1e9d7bbe-facf-f011-8537-000d3a59231e.preprod.omnichannelengagementhub.com`
- **Script URL**: `https://msft-lcw-trial.azureedge.net/jatinjdd/0123/v2scripts/LiveChatBootstrapper.js`

## Key Implementation Details

### Authentication Module (auth.js)
- Exports global functions: `login()`, `logout()`, `isAuthenticated()`, `getCurrentUser()`
- Implements `window.auth.getAuthenticationToken()` for widget callbacks
- Handles token refresh automatically
- Saves return URL for post-login redirect
- Dispatches `auth:logout` event when user logs out
- Uses redirect-based logout that returns to current page

### Chat Context Management

**Authenticated Chat (support-auth.html):**
- When user logs out, chat context is **cleared**
- User cannot reconnect to the same authenticated chat session after logout
- This ensures security - authenticated sessions are tied to user identity
- On logout, all chat-related localStorage/sessionStorage is removed

**Unauthenticated Chat (support-unauth.html):**
- When user logs in/out, chat context is **preserved**
- User can always reconnect to the same anonymous chat session
- Login/logout does not affect the anonymous chat experience
- Chat storage persists across authentication state changes

### Widget Management
Each support page includes:
- **Load Widget**: Dynamically loads the Omnichannel chat widget
- **Remove Widget**: Cleans up widget, iframes, and storage
- **Hard Reload**: Removes widget and clears all caches
- **Auto-save**: Saves widget configuration to localStorage

### Mid-Authentication Implementation
```javascript
// When user logs in, token is stored as pending
pendingMidAuthToken = currentAccessToken;

// On lcw:ready event, wait 3 seconds for chat restoration
setTimeout(() => {
  window.Microsoft.Omnichannel.LiveChatWidget.SDK.setMidAuthToken(token);
  alert('✅ Authentication successful! Your chat is now authenticated.');
}, 3000);
```

## Running Locally

1. **Clone or download** this repository
2. **Serve the files** using any static web server:
   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js http-server
   npx http-server

   # Using PHP
   php -S localhost:8000
   ```
3. **Open in browser**: `http://localhost:8000/index.html`

## Deployment to Azure Static Web Apps

1. **Push to GitHub** repository
2. **Create Azure Static Web App** resource
3. **Configure build settings**:
   - App location: `/`
   - Output location: `` (leave empty for static files)
4. **Set environment variables** (optional):
   - `AAD_CLIENT_ID`
   - `AAD_CLIENT_SECRET`

## Browser Requirements

- Modern browser with ES6+ support
- LocalStorage enabled
- Cookies enabled (for MSAL)
- Pop-ups allowed (for logout)

## Security Notes

- All authentication happens client-side using MSAL.js
- No server-side components required
- Tokens are stored in localStorage
- Token refresh happens automatically
- Tokens expire after configured duration (check Azure AD app settings)

## Troubleshooting

### Login doesn't redirect back
- Check `redirectUri` in `msalConfig` matches your deployment URL
- Ensure redirect URI is registered in Azure AD app registration

### Logout causes full page reload
- This is expected if popup logout fails
- Check browser console for errors
- Ensure pop-ups are not blocked

### Widget doesn't load
- Check browser console for errors
- Verify widget configuration values
- Try "Remove & Clear Cache" button

### Mid-auth token not working
- Check browser console for `[MidAuth]` logs
- Ensure user is logged in before loading widget
- Verify token is valid (not expired)
- Check network tab for widget API calls

## License

This is a demo application for testing and development purposes.

## Support

For issues or questions, please contact the development team.
