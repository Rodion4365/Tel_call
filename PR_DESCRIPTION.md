# Code review improvements: Security, migrations, and datetime fixes

## 🎯 Overview

This PR implements critical security improvements, database migrations setup, httpOnly cookies migration, and fixes datetime handling issues identified during code review.

## ✅ Changes Included

### 1. Critical Security & Technical Fixes (f45455e)

**Security Improvements:**
- ✅ Mask JWT tokens in frontend console logs to prevent token leakage
- ✅ Add rate limiting with slowapi:
  - Auth endpoint: 5 requests/minute
  - Call creation: 10 requests/minute
  - Global limit: 100 requests/minute
- ✅ Add CORS preflight caching (max_age=600s)

**Technical Improvements:**
- ✅ Replace deprecated `datetime.utcnow()` with `datetime.now(tz=timezone.utc)`
- ✅ Update all datetime fields to use timezone-aware timestamps
- ✅ Python 3.12+ compatibility

### 2. Database Migrations with Alembic (8e97f5b)

- ✅ Install and configure Alembic 1.13.2
- ✅ Create async-compatible env.py for SQLAlchemy
- ✅ Generate initial migration for users, calls, and participants tables
- ✅ Update main.py to use migrations instead of `create_all()`
- ✅ Add README_MIGRATIONS.md with usage instructions

**Benefits:**
- Version-controlled database schema changes
- Safe schema updates in production
- Rollback capability for failed migrations
- Better team collaboration on database changes

### 3. Datetime Comparison Fix (e8d73a0)

**Problem:**
After migrating to timezone-aware datetime, comparison between old naive datetime (from existing DB) and new aware datetime caused `TypeError`.

**Solution:**
- ✅ Add `_make_aware()` helper function to convert naive → aware UTC datetime
- ✅ Apply to all datetime comparisons in signaling.py, calls.py, expire_calls.py
- ✅ Backwards compatible: handles both naive and aware datetime
- ✅ Recreated database using Alembic migrations with timezone-aware schema

### 4. MediaStream Cleanup Improvements (7628d0d)

- ✅ Add `audio.pause()` before removing audio elements
- ✅ Add detailed comments for cleanup steps
- ✅ Ensure proper cleanup order: timers → peers → streams → audio elements
- ✅ Prevents memory leaks from lingering audio elements and media tracks

### 5. httpOnly Cookies Migration (86cb335, b7f899a)

**Security improvement - migrated from localStorage to httpOnly cookies:**

**Backend changes (86cb335):**
- ✅ Updated `/auth/telegram` to set httpOnly cookie instead of returning token
- ✅ Modified `get_current_user()` to read from cookie first, fallback to header
- ✅ Added `/auth/ws-token` endpoint to retrieve token for WebSocket
- ✅ Cookie configuration: `httponly=True`, `secure=True`, `samesite='lax'`

**Frontend changes (86cb335):**
- ✅ Removed localStorage logic from AuthContext
- ✅ Updated apiClient to use `credentials: 'include'`
- ✅ Removed Authorization header (cookies sent automatically)
- ✅ Updated AuthResponse type (no access_token field)

**WebSocket integration (b7f899a):**
- ✅ Add useWebSocketToken hook to fetch token from `/auth/ws-token`
- ✅ Update CallPage to get WebSocket token async before connecting
- ✅ Handle token fetch errors gracefully

**Security benefits:**
- **XSS Protection**: Tokens cannot be accessed by JavaScript
- **Automatic sending**: No manual Authorization header needed
- **CSRF Protection**: SameSite=lax prevents cross-site requests
- **Secure flag**: Only sent over HTTPS in production

---

## 📊 Files Changed

**Backend:**
- `backend/requirements.txt` - Added slowapi, alembic
- `backend/app/main.py` - Rate limiting, removed create_all()
- `backend/app/api/auth.py` - Rate limiting, httpOnly cookies, ws-token endpoint
- `backend/app/api/calls.py` - Rate limiting, datetime fix
- `backend/app/api/signaling.py` - Datetime fix
- `backend/app/services/auth.py` - Cookie authentication
- `backend/app/models/*.py` - Timezone-aware datetime
- `backend/app/tasks/expire_calls.py` - Datetime fix
- `backend/alembic/*` - New migration system
- `backend/README_MIGRATIONS.md` - Migration docs

**Frontend:**
- `frontend/src/contexts/AuthContext.tsx` - Removed localStorage, simplified
- `frontend/src/services/apiClient.ts` - Added credentials: 'include'
- `frontend/src/types/auth.ts` - Removed access_token from response
- `frontend/src/hooks/useWebSocketToken.ts` - New hook for WebSocket auth
- `frontend/src/pages/CallPage.tsx` - WebSocket token integration, cleanup improvements

---

## 🧪 Testing

**Manual Testing:**
- ✅ Create call works correctly
- ✅ Join call via WebSocket works without datetime errors
- ✅ Rate limiting prevents spam
- ✅ Tokens NOT visible in browser console (httpOnly)
- ✅ Database migrations apply cleanly
- ✅ MediaStream cleanup prevents memory leaks
- ✅ Authentication persists across page refreshes (cookies)

**Migration Path:**
```bash
# Apply migrations
cd backend
alembic upgrade head

# Install dependencies
pip install -r requirements.txt
```

---

## 🚀 Deployment Notes

**Before deployment:**
1. Run `pip install -r requirements.txt` to install new dependencies (slowapi, alembic)
2. Run `alembic upgrade head` to apply database migrations
3. Ensure environment variables are set (DATABASE_URL, SECRET_KEY, etc.)
4. Configure CORS_ALLOW_ORIGINS for production domain

**Breaking changes:**
- ⚠️ Old database must be migrated or recreated (timezone schema change)
- ⚠️ Users will need to re-authenticate (localStorage → cookies migration)
- ⚠️ Rate limiting may affect automated clients (adjust limits if needed)

**Cookie requirements:**
- ⚠️ Frontend and backend must be on same domain OR configured for CORS with credentials
- ⚠️ HTTPS required in production (secure flag)

---

## 📈 Impact

**Security:**
- Prevents JWT token exposure via XSS attacks (httpOnly)
- Protects against brute force and spam attacks (rate limiting)
- CSRF protection (SameSite cookies)

**Reliability:**
- Fixes datetime comparison crashes
- Provides database migration safety net
- Prevents MediaStream memory leaks

**Maintainability:**
- Cleaner database schema management
- Python 3.12+ compatibility
- Better authentication flow

---

## 📝 Commits

1. **f45455e** - Fix critical security and technical issues
2. **8e97f5b** - Add Alembic for database migrations
3. **e8d73a0** - Fix naive/aware datetime comparison issue
4. **2e9b7db** - Add PR description for code review improvements
5. **7628d0d** - Improve MediaStream cleanup to prevent memory leaks
6. **86cb335** - Migrate from localStorage to httpOnly cookies for JWT storage
7. **b7f899a** - Update CallPage to use httpOnly cookie WebSocket authentication

---

## 🔗 GitHub Links

**Compare:** https://github.com/Rodion4365/Tel_call/compare/main...claude/code-review-improvements-016dBXa7NBuEjJ934yhQUqdi

**Create PR:** https://github.com/Rodion4365/Tel_call/pull/new/claude/code-review-improvements-016dBXa7NBuEjJ934yhQUqdi
