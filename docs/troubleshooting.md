# Troubleshooting Guide

Common issues and solutions for SignalZero LocalChat.

## Installation Issues

### npm install fails

**Symptoms:**
```
npm ERR! code ECONNREFUSED
npm ERR! syscall connect
```

**Solutions:**
1. Check internet connection
2. Clear npm cache:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```
3. Use Node 18+:
   ```bash
   node --version  # Should be v18+
   ```

### TypeScript errors

**Symptoms:**
```
error TS2307: Cannot find module 'lucide-react'
```

**Solutions:**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# Check TypeScript config
npx tsc --noEmit
```

## Development Issues

### "Cannot connect to kernel" error

**Symptoms:**
Red error banner showing connection failure.

**Solutions:**
1. Check LocalNode is running:
   ```bash
   curl http://localhost:3001/api/auth/status
   ```

2. Verify kernel URL in Settings → Connection

3. Check browser console for CORS errors

4. Ensure no firewall blocking port 3001

### Hot reload not working

**Symptoms:**
Changes don't appear in browser.

**Solutions:**
1. Check Vite dev server is running
2. Hard reload: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
3. Check browser console for HMR errors

### Port 3000 already in use

**Symptoms:**
```
Error: Port 3000 is already in use
```

**Solutions:**
```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>

# Or use different port
npm run dev -- --port 3002
```

## Build Issues

### Build fails with TypeScript errors

**Symptoms:**
```
error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'
```

**Solutions:**
```bash
# Check all types
npx tsc --noEmit

# See detailed errors
npx tsc 2>&1 | head -50
```

### Build output is empty

**Symptoms:**
`dist/` directory missing or empty.

**Solutions:**
```bash
# Clean and rebuild
rm -rf dist
npm run build

# Check for build errors
npm run build 2>&1
```

## Runtime Issues

### White screen after login

**Symptoms:**
Blank page after successful authentication.

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify `localStorage` has auth token:
   ```javascript
   localStorage.getItem('signalzero_auth_token')
   ```
3. Clear browser cache and reload
4. Check LocalNode logs for errors

### Chat messages not sending

**Symptoms:**
Clicking send does nothing or shows error.

**Solutions:**
1. Check network tab in dev tools
2. Verify auth token is being sent:
   ```javascript
   // In console
   localStorage.getItem('signalzero_auth_token')
   ```
3. Check LocalNode is responding to `/api/chat`

### Symbols not loading

**Symptoms:**
Domain panel shows empty or error.

**Solutions:**
1. Check `/api/domains` endpoint
2. Verify user has access to domains
3. Check Redis connection on LocalNode

### SSE/streaming not working

**Symptoms:**
Chat responses don't stream; appear all at once.

**Solutions:**
1. Check Nginx proxy settings:
   ```nginx
   proxy_buffering off;
   proxy_cache off;
   ```

2. Verify browser supports EventSource

3. Check for ad blockers interfering

## Authentication Issues

### "Invalid credentials" error

**Symptoms:**
Login fails with credential error.

**Solutions:**
1. Verify username/password
2. Check Caps Lock
3. Reset password via LocalNode API if needed

### Token expired

**Symptoms:**
Suddenly logged out or API calls fail.

**Solutions:**
- Session tokens expire after 24 hours
- Re-login to get new token
- Use "Remember me" if available

### Setup wizard won't complete

**Symptoms:**
Stuck on setup screen or errors during initialization.

**Solutions:**
1. Check all required fields filled
2. Verify inference endpoint is accessible
3. Check LocalNode logs for errors
4. Clear Redis and retry if needed:
   ```bash
   redis-cli FLUSHDB  # Warning: clears all data
   ```

## UI/Display Issues

### Styling broken/missing

**Symptoms:**
Unstyled HTML or missing CSS.

**Solutions:**
1. Check build completed successfully
2. Verify CSS files in `dist/assets/`
3. Check network tab for 404s on CSS files

### Icons not showing

**Symptoms:**
Squares or blanks where icons should be.

**Solutions:**
1. Check Lucide icons imported correctly:
   ```typescript
   import { MessageSquare } from 'lucide-react';
   ```
2. Verify no build errors with icons

### Markdown not rendering

**Symptoms:**
Raw markdown visible in chat.

**Solutions:**
1. Check `react-markdown` is installed:
   ```bash
   npm list react-markdown
   ```
2. Verify imports in ChatMessage component

## Performance Issues

### Slow initial load

**Symptoms:**
Page takes long time to load.

**Solutions:**
1. Enable gzip compression in Nginx
2. Use CDN for static assets
3. Implement code splitting
4. Check bundle size:
   ```bash
   npm run build
   ls -lh dist/assets/
   ```

### Laggy UI

**Symptoms:**
Input delay or choppy scrolling.

**Solutions:**
1. Check React DevTools Profiler
2. Look for unnecessary re-renders
3. Use `useMemo` for expensive calculations
4. Virtualize long lists

### High memory usage

**Symptoms:**
Browser tab using excessive memory.

**Solutions:**
1. Check for memory leaks in components
2. Clear old messages periodically
3. Unsubscribe from unused streams

## Network Issues

### CORS errors

**Symptoms:**
```
Access to fetch blocked by CORS policy
```

**Solutions:**
1. Use Nginx proxy to same origin:
   ```nginx
   location /api/ {
       proxy_pass http://localhost:3001/;
   }
   ```

2. Or configure LocalNode CORS headers

### 502 Bad Gateway

**Symptoms:**
Error when calling API.

**Solutions:**
1. Check LocalNode is running
2. Verify proxy_pass URL is correct
3. Check Nginx error logs

### Request timeouts

**Symptoms:**
API calls timeout, especially chat.

**Solutions:**
1. Increase timeout in Nginx:
   ```nginx
   proxy_read_timeout 300s;
   ```

2. Check LocalNode performance
3. Consider model latency

## Deployment Issues

### 404 on page refresh

**Symptoms:**
Works on first load, 404 on refresh.

**Solutions:**
Configure Nginx for SPAs:
```nginx
try_files $uri $uri/ /index.html;
```

### Assets not loading (404)

**Symptoms:**
JS/CSS files return 404.

**Solutions:**
1. Check files exist in `dist/assets/`
2. Verify Nginx root path
3. Check file permissions

### HTTPS issues

**Symptoms:**
Mixed content warnings or blocked requests.

**Solutions:**
1. Use HTTPS for all resources
2. Update `VITE_KERNEL_URL` to use wss/https
3. Check certificate validity

## Browser Issues

### LocalStorage quota exceeded

**Symptoms:**
```
QuotaExceededError: The quota has been exceeded
```

**Solutions:**
1. Clear old data:
   ```javascript
   localStorage.clear();
   ```

2. Use IndexedDB for large data (future)

### Browser not supported

**Symptoms:**
Blank page or console errors about missing features.

**Solutions:**
- Use modern browser (Chrome/Firefox/Edge/Safari latest)
- Enable JavaScript
- Disable incompatible extensions

## Getting Help

If issues persist:

1. **Check logs:**
   - Browser console (F12)
   - LocalNode logs
   - Nginx logs

2. **Verify versions:**
   ```bash
   node --version
   npm --version
   ```

3. **Minimal reproduction:**
   - Fresh browser profile
   - Clear all data
   - Test with sample project

4. **Contact:**
   - GitHub Issues: [repository]/issues
   - Email: klietus@gmail.com
