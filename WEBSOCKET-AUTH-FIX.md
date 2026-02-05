# WebSocket Authentication Fix

## Problem

After deploying to Render with `VERITAS_AUTH_ENABLED=false`, WebSocket connections were still being rejected with:

```
{"level":40,"time":"2026-02-05T01:48:54.077Z","pid":1,"hostname":"srv-d619aq4r85hc7390ekig-hibernate-5d9dd7c45f-7rfld","component":"server","error":"Authentication required. Provide api_key query parameter.","msg":"WebSocket connection rejected"}
```

## Root Cause

The authentication middleware checked TWO sources:

1. **`VERITAS_AUTH_ENABLED`** environment variable (from `.env` or Render settings)
2. **`security.json`** file config (created when password auth is set up)

The original logic required **BOTH** to be disabled:

```typescript
// OLD CODE - Both had to be false
if (!config.enabled && !passwordAuthEnabled) {
  return { authenticated: true, role: 'admin', isLocalhost };
}
```

If you had previously set up password authentication in Render (which creates `security.json` with `authEnabled: true`), the env var alone couldn't disable auth.

## Solution

Made the **environment variable take priority** over the file config:

```typescript
// NEW CODE - Env var takes priority
if (!config.enabled) {
  return { authenticated: true, role: 'admin', isLocalhost };
}
```

This change was applied to both:

- `authenticate()` - HTTP request authentication (line ~288)
- `authenticateWebSocket()` - WebSocket authentication (line ~441)

## Files Modified

- `server/src/middleware/auth.ts`
  - Line ~288: HTTP authentication - env var now takes priority
  - Line ~441: WebSocket authentication - env var now takes priority

## Testing

After this fix, setting `VERITAS_AUTH_ENABLED=false` will:

- ✅ Allow all HTTP API requests without authentication
- ✅ Allow WebSocket connections without API key or JWT
- ✅ Override any `security.json` file configuration
- ✅ Assign `admin` role to all requests

## Deployment

```bash
# 1. Commit the fix
git add server/src/middleware/auth.ts
git commit -m "fix: make VERITAS_AUTH_ENABLED env var take priority over security.json"
git push origin main

# 2. Render will auto-deploy

# 3. Verify in logs - you should see:
#    - No more "WebSocket connection rejected" errors
#    - "WebSocket client connected" messages instead
```

## Verification

After deployment, check these:

### 1. WebSocket Connection

Open browser console on your Render app:

```javascript
// Should connect successfully without errors
const ws = new WebSocket('wss://veritas-kanban.onrender.com/ws');
ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (e) => console.error('❌ Error:', e);
```

### 2. Render Logs

Look for these SUCCESS messages:

```
{"level":30,"msg":"WebSocket client connected"}
```

Instead of ERROR:

```
{"level":40,"msg":"WebSocket connection rejected"}
```

### 3. API Access

```bash
# Should work without API key
curl https://veritas-kanban.onrender.com/api/tasks

# Should return tasks from Supabase
```

## Security Note

**This fix is appropriate for:**

- ✅ Free tier / personal projects
- ✅ Development environments
- ✅ Internal tools behind VPN/firewall
- ✅ Testing deployments

**For production with public access**, you should:

- Set `VERITAS_AUTH_ENABLED=true`
- Set up password authentication via `/auth/setup`
- OR use API keys with proper roles

## Alternative: Password Auth (Production)

If you want authentication enabled:

1. **Keep auth enabled:**

   ```env
   VERITAS_AUTH_ENABLED=true
   ```

2. **Set up password on first visit:**
   - Visit `https://your-app.onrender.com/auth/setup`
   - Create a password
   - Frontend will receive JWT cookie automatically
   - WebSocket will use the cookie for authentication

3. **No code changes needed** - the app already supports cookie-based auth for both HTTP and WebSocket

## Summary

✅ **Fixed**: `VERITAS_AUTH_ENABLED=false` now properly disables all authentication  
✅ **Impact**: WebSocket connections work without API keys  
✅ **Breaking**: None - only affects behavior when env var is set to `false`  
✅ **Security**: Environment variable is the source of truth for auth state
