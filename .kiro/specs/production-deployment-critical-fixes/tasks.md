# Implementation Plan

## Bug 1: Alpine Crypto Library Incompatibility

- [x] 1.1 Write bug condition exploration test for crypto library loading
  - **Property 1: Fault Condition** - Backend Crypto Library Loading on Alpine
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the crypto loading bug exists
  - **Scoped PBT Approach**: Test the concrete failing case - Alpine runtime with Erlang crypto
  - Test that backend container with Alpine 3.20 runtime fails to load crypto.so with "EVP_MD_CTX_get_size_ex: symbol not found" error
  - Run test: `docker compose -f docker-compose.prod.yml up backend` and check logs
  - **EXPECTED OUTCOME**: Container crashes and restarts continuously (this is correct - it proves the bug exists)
  - Document counterexamples: specific error messages and restart loop behavior
  - Mark task complete when test is run and failure is documented
  - _Requirements: 2.1_

- [x] 1.2 Write preservation property tests for development environment (BEFORE implementing fix)
  - **Property 2: Preservation** - Development Environment Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Development environment with standard Elixir image works correctly on unfixed code
  - Write test: Verify `docker compose up backend` (dev mode) starts successfully and serves requests
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test PASSES (this confirms baseline behavior to preserve)
  - Mark task complete when test is written, run, and passing on unfixed code
  - _Requirements: 3.1_

- [x] 1.3 Fix Alpine crypto library incompatibility

  - [x] 1.3.1 Replace Alpine runtime with Debian slim
    - Change `FROM alpine:3.20 AS runtime` to `FROM debian:12-slim AS runtime` in backend/Dockerfile
    - Replace `apk add` with `apt-get update && apt-get install -y libstdc++6 openssl libncurses6 locales`
    - Add cleanup: `rm -rf /var/lib/apt/lists/*` to reduce image size
    - Set locale: `RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen`
    - Add environment variables: `ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8`
    - Keep builder stage unchanged (elixir:1.17-alpine)
    - _Bug_Condition: isBugCondition1(container) where container.runtime_image == "alpine:3.20" AND NOT openssl_symbol_exists("EVP_MD_CTX_get_size_ex")_
    - _Expected_Behavior: Backend container starts successfully, crypto.so loads without errors, Phoenix server runs on port 4000_
    - _Preservation: Development environment with standard Elixir image continues to work, migrations and seed execute through bin/chatforge eval_
    - _Requirements: 2.1, 3.1, 3.6_

  - [x] 1.3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Backend Starts Successfully with Debian
    - **IMPORTANT**: Re-run the SAME test from task 1.1 - do NOT write a new test
    - Run: `docker compose -f docker-compose.prod.yml up backend` and verify logs show "Running ChatForgeWeb.Endpoint"
    - **EXPECTED OUTCOME**: Container starts successfully, no crypto loading errors, stable operation
    - _Requirements: 2.1_

  - [x] 1.3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Development Environment Still Works
    - **IMPORTANT**: Re-run the SAME test from task 1.2 - do NOT write a new test
    - Run: `docker compose up backend` (dev mode) and verify it still works
    - **EXPECTED OUTCOME**: Development environment unchanged, all existing behaviors preserved
    - _Requirements: 3.1, 3.6_

## Bug 2: Missing Nginx API Proxying

- [x] 2.1 Write bug condition exploration test for nginx API proxying
  - **Property 1: Fault Condition** - Nginx Returns 404 for API Requests
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate nginx doesn't proxy API requests
  - **Scoped PBT Approach**: Test concrete failing cases - POST to /api/v1/auth/register and WebSocket to /socket
  - Test that POST request to `/api/v1/auth/register` returns 404 instead of being proxied to backend
  - Test that WebSocket connection to `/socket/websocket` returns 404
  - Run test: `curl -X POST https://chatforge.morevslava.duckdns.org/api/v1/auth/register` and check nginx logs
  - **EXPECTED OUTCOME**: 404 errors, nginx tries to find static files (this is correct - it proves the bug exists)
  - Document counterexamples: specific 404 responses and nginx log entries showing static file lookup
  - Mark task complete when test is run and failure is documented
  - _Requirements: 2.2, 2.3_

- [x] 2.2 Write preservation property tests for static files and SPA routing (BEFORE implementing fix)
  - **Property 2: Preservation** - Static Files and SPA Routing Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Static files (JS, CSS, images) are served correctly with caching on unfixed code
  - Observe: SPA routes (/, /login, /dashboard) return index.html on unfixed code
  - Write tests: Verify GET requests to static assets return 200 with cache headers
  - Write tests: Verify GET requests to SPA routes return index.html
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.2, 3.3_

- [x] 2.3 Fix nginx API proxying and frontend API URL

  - [x] 2.3.1 Add nginx upstream and location blocks for API proxying
    - Add upstream backend definition before server block in frontend/nginx.conf
    - Add `location /api` block with proxy_pass to http://backend:4000 BEFORE location /
    - Add `location /socket` block with WebSocket upgrade headers BEFORE location /
    - Set proxy headers: Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto
    - Ensure location order: /api and /socket before /
    - _Bug_Condition: isBugCondition2(request) where request.path STARTS_WITH "/api" OR "/socket" AND nginx_tries_static_file_lookup_
    - _Expected_Behavior: Nginx proxies API requests to backend:4000, returns backend response (200/201/400/401/422), not 404_
    - _Preservation: Static file serving with caching, SPA fallback for non-API routes unchanged_
    - _Requirements: 2.2, 2.3, 3.2, 3.3_

  - [x] 2.3.2 Add VITE_API_URL to frontend build
    - Add `ARG VITE_API_URL` and `ENV VITE_API_URL=$VITE_API_URL` in frontend/Dockerfile after VITE_CHAT_BASE_URL
    - Add build arg in docker-compose.prod.yml: `VITE_API_URL: https://${DOMAIN}/api`
    - Verify frontend code uses VITE_API_URL for API requests
    - _Bug_Condition: Frontend doesn't know backend API URL_
    - _Expected_Behavior: Frontend sends API requests to https://${DOMAIN}/api_
    - _Preservation: Development environment API URL unchanged_
    - _Requirements: 2.4, 3.1_

  - [x] 2.3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Nginx Proxies API Requests Successfully
    - **IMPORTANT**: Re-run the SAME test from task 2.1 - do NOT write a new test
    - Run: `curl -X POST https://chatforge.morevslava.duckdns.org/api/v1/auth/register` with valid payload
    - **EXPECTED OUTCOME**: Backend response (not 404), request is proxied to backend:4000
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 2.3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Static Files and SPA Routing Still Work
    - **IMPORTANT**: Re-run the SAME tests from task 2.2 - do NOT write new tests
    - Run: GET requests to static assets and SPA routes
    - **EXPECTED OUTCOME**: Static files served with caching, SPA routes return index.html
    - _Requirements: 3.2, 3.3_

## Bug 3: Incorrect Subdomain Validation Logic

- [x] 3.1 Write bug condition exploration test for subdomain validation
  - **Property 1: Fault Condition** - Available Subdomains Return "taken"
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate validation returns wrong result
  - **Scoped PBT Approach**: Test concrete failing case - available subdomain "aaaaa" returns "taken"
  - Test that GET `/api/v1/builder/validate-subdomain?subdomain=aaaaa` returns `{"available": false, "reason": "taken"}`
  - Verify "aaaaa" does NOT exist in chat_instances table
  - Run test on UNFIXED code (after Bug 2 is fixed so API requests work)
  - **EXPECTED OUTCOME**: Returns "taken" for available subdomain (this is correct - it proves the bug exists)
  - Document counterexamples: specific subdomains that are available but return "taken"
  - Mark task complete when test is run and failure is documented
  - _Requirements: 2.5_

- [x] 3.2 Write preservation property tests for validation edge cases (BEFORE implementing fix)
  - **Property 2: Preservation** - Invalid Format and Taken Subdomains Still Validated
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Invalid subdomain "INVALID" returns `{"available": false, "reason": "invalid_format"}` on unfixed code
  - Observe: Create subdomain "test", then validate "test" returns `{"available": false, "reason": "taken"}` on unfixed code
  - Write tests: Verify invalid format subdomains return :invalid_format
  - Write tests: Verify genuinely taken subdomains return :taken
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.4, 3.5_

- [x] 3.3 Fix subdomain validation logic

  - [x] 3.3.1 Analyze and fix validate_subdomain function
    - Add logging to validate_subdomain in backend/lib/chatforge/instances/instances.ex
    - Log subdomain input and database query result
    - Run test from 3.1 and examine logs to identify root cause
    - If logic is incorrect, fix the cond condition for database check
    - If logic is correct, investigate controller or request handling
    - _Bug_Condition: isBugCondition3(subdomain) where subdomain matches format AND NOT exists_in_database AND returns :taken_
    - _Expected_Behavior: Available subdomains return {:ok, :available}_
    - _Preservation: Invalid format returns :invalid_format, taken subdomains return :taken_
    - _Requirements: 2.5, 3.4, 3.5_

  - [x] 3.3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Available Subdomains Return "available"
    - **IMPORTANT**: Re-run the SAME test from task 3.1 - do NOT write a new test
    - Run: GET `/api/v1/builder/validate-subdomain?subdomain=aaaaa`
    - **EXPECTED OUTCOME**: Returns `{"available": true}` for available subdomain
    - _Requirements: 2.5_

  - [x] 3.3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Edge Cases Still Validated Correctly
    - **IMPORTANT**: Re-run the SAME tests from task 3.2 - do NOT write new tests
    - Run: Validate invalid format and taken subdomains
    - **EXPECTED OUTCOME**: Invalid format returns :invalid_format, taken returns :taken
    - _Requirements: 3.4, 3.5_

## Final Validation

- [ ] 4. Checkpoint - Ensure all tests pass and system works end-to-end
  - Run full production deployment: `docker compose -f docker-compose.prod.yml up -d`
  - Verify backend starts successfully without crypto errors
  - Verify frontend is accessible through Traefik
  - Verify API requests are proxied correctly (test registration endpoint)
  - Verify subdomain validation returns correct results for all cases
  - Verify static files and SPA routing still work
  - Verify WebSocket connections establish successfully
  - Ensure all tests pass, ask the user if questions arise
