# Azure Static Web App - Mid Auth with Omnichannel

This is an Azure Static Web App that integrates Azure AD authentication with Microsoft Omnichannel Live Chat.

## Features

- Azure AD authentication using MSAL.js
- Direct AAD access token retrieval
- Integration with Microsoft Omnichannel Live Chat widget
- Token display for debugging

## Files

- `index.html` - Main application page with MSAL authentication
- `staticwebapp.config.json` - Azure Static Web Apps configuration

## Setup

1. Deploy to Azure Static Web Apps
2. Configure Azure AD App Registration with redirect URI
3. Update environment variables in Azure Static Web Apps:
   - `AAD_CLIENT_ID`
   - `AAD_CLIENT_SECRET` (if needed)

## Configuration

The app is configured with:
- **Client ID**: a2187d50-1812-4475-a27a-10cfbb98ab43
- **Tenant ID**: 0f7bc4c9-8010-4190-a9fe-1fcedbefc4e8
