# Quick Fix: Update Render Environment Variables

## Problem

Tasks are not saving to Supabase because:

1. TaskService doesn't use the storage abstraction (see CRITICAL-ISSUE-STORAGE.md)
2. Auth is enabled causing WebSocket issues

## Immediate Fix

Update these environment variables in Render:

### Change This:

```
VERITAS_AUTH_ENABLED=true  ❌
```

### To This:

```
VERITAS_AUTH_ENABLED=false  ✅
```

## Why?

With `VERITAS_AUTH_ENABLED=true`, the app requires authentication which causes:

- WebSocket connections to be rejected
- Frontend can't establish real-time connection
- More complex to test and debug

## Steps

1. Go to Render Dashboard
2. Select your service
3. Go to "Environment" tab
4. Find `VERITAS_AUTH_ENABLED`
5. Change value to `false`
6. Click "Save Changes"
7. Render will automatically redeploy

## Verification

After redeployment, check logs for:

```
✅ "WebSocket client connected"
❌ NO "WebSocket connection rejected" errors
```

## Note

This doesn't fix the main issue (TaskService not using Supabase), but it:

- Removes authentication errors
- Makes debugging easier
- Allows WebSocket to work properly

See `CRITICAL-ISSUE-STORAGE.md` for the main storage issue fix.
