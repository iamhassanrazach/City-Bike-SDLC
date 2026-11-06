Hassan Raza

Project: 04-citybike-sdlc
Tech Stack: Windows PowerShell, Docker Desktop, Git, Node.js 20 & Alpine Linux
1. Mission 1: Runtime Versions & The "It Works on My Machine" Trap
•	What happened: When I ran the app with the new station snapshot using Node 16, it instantly crashed with a ReferenceError: structuredClone is not defined. Upgrading the environment to Node 20 fixed it right away, and /health and /api/stations started returning the right responses.
•	Why it matters: This proved why runtime version mismatches break apps. Containers solve this by bundling the exact correct runtime right inside the image so it behaves identically everywhere.

2. Missions 2 & 3: Containerization, Caching, & Multi-Stage Builds
Size & Rebuild Comparison Table
Dockerfile Approach	Image Disk Size	Content Size	Rebuild Time (After 1-Line Frontend Change)
Naive Single-Stage (citybike:naive)	~2.04 GB	~494 MB	Slow (~1–2 min) — Forces a full npm ci re-run every time
Cache-Optimized (citybike:cached)	~385 MB	~79.9 MB	Fast — Reuses cached dependency layers
Multi-Stage Alpine (citybike:v1)	~193 MB	48.4 MB	Instant build with zero runtime bloat
Key Takeaways:
•	Why npm ci kept re-running in the naive build: Because COPY . . came before npm ci. Changing a single frontend file threw away the entire Docker cache. Fixing the order to copy package.json and package-lock.json first solved this.
•	Why --omit=dev failed on single-stage builds: Build tools like TypeScript are needed during the build step. Omitting them early breaks npm run build. Multi-stage builds fix this by using a heavy builder stage and a tiny production runtime stage.
•	Why dropping devDependencies rocks: It shrinks the image down to 48.4 MB, reduces our security attack surface, and speeds up deployments drastically.

3. Mission 4: The Five-Environment Promotion Pipeline (v1)
I built an automated PowerShell harness (pipeline.ps1) to push our immutable citybike:v1 image through all five gates in order:
.	Staging: Checked container health and build manifest presence (hasBuildManifest: true).
.	UAT: Verified static assets, station data contracts (4 stations, Riverside Park at 0 bikes), and reservation rules (validating emails and rejecting zero-bike bookings).
.	OAT: Tested malformed JSON payloads (HTTP 400), payload size flood guards (>10KB, HTTP 413), and request burst load handling.

.	Preprod: Audited image size, confirmed devDependencies were absent, and checked that PROD_API_KEY was injected properly (secureKeyConfigured: true).

.	Prod: Reserved port 4173, brought citybike-prod live, and ran smoke tests.
•	Why this works: Building once and promoting the exact same image ensures no configuration drift happens between testing and production.

4. Mission 5: Bad Push (v2) vs. Automated Pipeline
Part A: The Un-Gated Crash
I added a v2 feature to server.js that tried to read process.env.DB_URL:
JavaScript
const dbHost = new URL(process.env.DB_URL).hostname;
When I pushed citybike:v2 straight to production without running the pipeline, it crashed instantly on startup:
Plaintext
TypeError: Invalid URL
    at new URL (node:internal/url:806:29)
  code: 'ERR_INVALID_URL',
  input: 'undefined'
•	The fix: I immediately rolled production back to citybike:v1, which brought /health back online instantly.
Part B: Pipeline Interception
When I ran citybike:v2 through ./scripts/pipeline.ps1, the pipeline caught the missing DB_URL configuration during the early gates and blocked the deployment before it could touch production.

5. Conclusion
Lab 04 proved why CI/CD pipelines, multi-stage Alpine builds, and strict environment promotion gates are mandatory. By catching configuration bugs and missing variables automatically, we protect production from crashing and keep deployments fast and reliable.