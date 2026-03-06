# Reference: Project Structure and Technical Patterns

**This document is for skills to reference — not for the user to maintain.**
**Skills read this when scaffolding a project or creating/verifying tasks.**

---

## Ideal Project Structure

Adapt to what exists. Never overwrite existing files without asking.

### Python script project (most common)
```
scripts/           → One script per job
tests/             → pytest tests mirroring scripts/
data/              → Input/output files
docs/              → CONTEXT.md, TRACKER.md, TECHNICAL_GUIDANCE.md, task_breakdowns/
.cursor/skills/    → Process skills
Makefile           → setup, test, lint, format, check, run, help
.cursorrules
.env               → Secrets (never committed)
.env.example       → Template with placeholders
.gitignore
pyproject.toml     → ruff + pytest config
requirements.txt
```

### Python API project
Same as above, plus:
```
src/               → FastAPI application code
  app.py           → Main app with routes
  models.py        → Pydantic models
```
- Always use FastAPI. Swagger docs auto-included at `/docs`.
- Note in TECHNICAL_GUIDANCE.md that API docs are at `/docs`.

### Node/TypeScript project
```
src/               → Application code
tests/             → vitest or jest tests
Makefile           → Same targets, different commands
package.json
tsconfig.json      → If TypeScript
.eslintrc.js
.prettierrc
```

### Adding to an existing project
- Keep existing structure. Add `docs/` and `.cursor/skills/` alongside it.
- Detect existing tools (pytest, jest, ruff, eslint, etc.) and use them.
- Only add a Makefile if one doesn't exist. If it exists, add targets to it.
- Only add linting/testing config if none exists.

---

## Tech Stack Defaults

| Need | Python | Node/TypeScript |
|---|---|---|
| Testing | pytest | vitest |
| Linting | ruff | eslint + prettier |
| API framework | FastAPI | Express or Next.js |
| CSS framework | — | Tailwind CSS or Pico CSS |
| Package management | pip + requirements.txt | npm |
| Database (if needed) | SQLite (simple) or PostgreSQL | Same |
| HTTP client | requests + shared api_client | fetch + shared apiClient |
| LLM calls | openai + shared llm_client | openai (Node SDK) |

---

## Makefile Targets (Standard)

Every project gets these targets. Adapt commands to the stack.

```makefile
make setup     # Install dependencies
make test      # Run all tests
make lint      # Check code style (no changes)
make format    # Auto-fix code style
make check     # Run tests + lint (required before closing tasks)
make run       # Run the main entry point
make help      # Show available commands
```

### Python Makefile template
```makefile
.DEFAULT_GOAL := help
.PHONY: help setup test lint format check run clean

setup:
	pip install -r requirements.txt
test:
	python -m pytest tests/ -v
lint:
	python -m ruff check .
format:
	python -m ruff check --fix . && python -m ruff format .
check: test lint
run:
	@echo "Update this target with your main script"
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'
```

### Node Makefile template
```makefile
setup:
	npm install
test:
	npx vitest run
lint:
	npx eslint .
format:
	npx prettier --write . && npx eslint --fix .
check: test lint
run:
	node src/index.js
```

---

## Python Config Templates

### pyproject.toml
```toml
[tool.ruff]
target-version = "py311"
line-length = 120
[tool.ruff.lint]
select = ["E", "F", "I", "W"]
ignore = ["E501"]
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

### requirements.txt (base quality tools)
```
pytest>=7.0
ruff>=0.4.0
python-dotenv>=1.0
```

---

## Shared API Client Pattern

All external API calls must go through a shared client. Never scatter raw HTTP calls across scripts. The scaffold skill creates this file.

### Key features
- Exponential backoff with jitter on retries
- Rate limit awareness (respect Retry-After headers)
- Configurable max retries and timeout
- Centralized error handling and logging
- Credentials loaded from .env

### Python implementation (scripts/api_client.py)
```python
import logging
import os
import random
import time

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class APIClient:
    def __init__(self, base_url, api_key_env=None, max_retries=3, base_delay=1.0, timeout=30, headers=None):
        self.base_url = base_url.rstrip("/")
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.timeout = timeout
        self.session = requests.Session()
        if api_key_env:
            api_key = os.getenv(api_key_env)
            if not api_key:
                raise ValueError(f"{api_key_env} not set in .env")
            self.session.headers["Authorization"] = f"Bearer {api_key}"
        if headers:
            self.session.headers.update(headers)

    def _request(self, method, path, **kwargs):
        url = f"{self.base_url}/{path.lstrip('/')}"
        kwargs.setdefault("timeout", self.timeout)
        for attempt in range(self.max_retries + 1):
            try:
                resp = self.session.request(method, url, **kwargs)
                if resp.status_code < 400:
                    return resp
                if resp.status_code == 429:
                    wait = int(resp.headers.get("Retry-After", self.base_delay * 2**attempt))
                    logger.warning(f"Rate limited. Waiting {wait}s (attempt {attempt+1})")
                    time.sleep(wait)
                    continue
                if resp.status_code >= 500 and attempt < self.max_retries:
                    delay = self.base_delay * 2**attempt + random.uniform(0, 1)
                    logger.warning(f"Server error {resp.status_code}. Retry in {delay:.1f}s")
                    time.sleep(delay)
                    continue
                resp.raise_for_status()
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                if attempt < self.max_retries:
                    delay = self.base_delay * 2**attempt + random.uniform(0, 1)
                    logger.warning(f"{type(e).__name__}. Retry in {delay:.1f}s")
                    time.sleep(delay)
                    continue
                raise
        resp.raise_for_status()

    def get(self, path, **kw): return self._request("GET", path, **kw)
    def post(self, path, **kw): return self._request("POST", path, **kw)
    def put(self, path, **kw): return self._request("PUT", path, **kw)
    def patch(self, path, **kw): return self._request("PATCH", path, **kw)
    def delete(self, path, **kw): return self._request("DELETE", path, **kw)
```

### Node/TypeScript implementation (src/lib/apiClient.ts)
Follow the same pattern: exponential backoff, centralized errors, env-based credentials.

---

## .env Safety

- All secrets go in `.env`, loaded via `python-dotenv` or `dotenv`.
- `.env` is always in `.gitignore`.
- `.env.example` has every required variable with placeholder values and comments.
- Scripts must fail loudly if a required env var is missing.

## .gitignore Patterns

### Python
```
.env
__pycache__/
*.pyc
.pytest_cache/
.ruff_cache/
venv/
```

### Node
```
.env
node_modules/
dist/
```

### Universal
```
.DS_Store
Thumbs.db
logs/
*.log
```

---

## Cron / Scheduling Guidance

- Scripts must be idempotent (running twice doesn't cause problems).
- Add logging so you can tell when it ran and whether it succeeded.
- Add a `make run-<name>` target for each scheduled script.
- Document the schedule in TECHNICAL_GUIDANCE.md.
- Example: `0 8 * * 1 cd /path/to/project && make run-export >> logs/cron.log 2>&1`

---

## Backwards Compatibility Rule

When modifying existing code:
1. Add new behavior alongside old behavior.
2. Verify both old and new work (tests must cover both).
3. Only then remove old behavior in a separate commit.
Never rip-and-replace in one step.

---

## Database / ORM Patterns

Some projects involve heavy SQL or need a local/remote database.

### When to use what
- **No database:** Most script projects. Read from CSV/API, write to CSV/Sheet.
- **SQLite:** Single-user, local data that needs to persist between runs. No server setup.
- **PostgreSQL:** Multi-user, production, or when data is shared across services.

### Python ORM
- Use **SQLAlchemy** for any project that needs an ORM. It's the standard.
- For FastAPI projects, pair with **Alembic** for migrations.
- Keep models in `src/models.py` or `src/models/` for larger projects.

### Raw SQL
- If the project is SQL-heavy (analytics, reporting), raw SQL is fine. Keep queries in a `sql/` directory as `.sql` files and load them from Python.
- Always use parameterized queries — never string-format user input into SQL.

### Scaffold additions for database projects
- Add `sqlalchemy` (and `alembic` if migrations needed) to requirements.txt.
- Add `psycopg2-binary` for PostgreSQL or use SQLite (no extra dependency).
- Create `src/models.py` with a base setup.
- Add a `make db-migrate` target to the Makefile if using Alembic.

---

## Cloud Document Output — Google Apps Script

Many projects end with updating a Google Sheet, Google Doc, or similar. **Always use Google Apps Script webhooks.** No OAuth, no Google Cloud project, no `credentials.json`, no token refresh. A small script on the Google side gives you a URL, and your Python POSTs JSON to it.

### How it works

1. **Google side (one-time setup, done by the Sheet owner):**

   Open the target Google Sheet → Extensions → Apps Script. Paste a script like:

   ```javascript
   function doPost(e) {
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     var data = JSON.parse(e.postData.contents);

     // data.rows is an array of arrays — each inner array is one row
     if (data.rows) {
       data.rows.forEach(function(row) {
         sheet.appendRow(row);
       });
     }

     return ContentService
       .createTextOutput(JSON.stringify({ status: "ok", rows_added: data.rows.length }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```

   Deploy → New deployment → Web app → "Anyone" can access → Deploy → Copy the URL.

2. **Python side (in your project):**

   The deployed URL is the only "credential" — store it in `.env`:

   ```
   GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/xxxxx/exec
   ```

   Post data from Python:

   ```python
   import os
   import requests
   from dotenv import load_dotenv

   load_dotenv()

   WEBHOOK_URL = os.getenv("GOOGLE_SHEET_WEBHOOK_URL")
   if not WEBHOOK_URL:
       raise ValueError("GOOGLE_SHEET_WEBHOOK_URL not set in .env")

   def send_to_sheet(rows: list[list]):
       """Send rows to Google Sheet via Apps Script webhook.

       Args:
           rows: List of rows, each row is a list of values.
                 e.g. [["Alice", 5, "Great workshop"], ["Bob", 4, "Needs more time"]]
       """
       response = requests.post(WEBHOOK_URL, json={"rows": rows})
       response.raise_for_status()
       return response.json()
   ```

   For projects that make many calls, route through the shared API client instead of raw requests.

3. **Apps Script can do more than write to Sheets:**
   - Read from Sheets (use `doGet` instead of `doPost`)
   - Create new Google Docs from templates
   - Send emails via Gmail
   - Update Google Calendar events
   - Access any Google Workspace service the script owner has access to

   Each of these just needs a different Apps Script function and a corresponding endpoint.

**Security notes:**
- The webhook URL is essentially a key — anyone with it can write to the Sheet. Store it in `.env`, never commit it.
- The script runs with the deployer's Google permissions, not the caller's.
- For internal tools this is the right approach.

### Scaffold additions for Apps Script projects
- Add the webhook URL to `.env.example` with a comment explaining how to get it.
- No additional Python dependencies needed beyond `requests` (already required by the API client).
- Add the Apps Script setup instructions to `docs/TECHNICAL_GUIDANCE.md` so the Sheet owner knows what to deploy.

### Common pattern: script → cloud doc
```
make run-export   # Pull data, transform, push to Google Sheet
```
The Makefile target wraps the full pipeline. Cron can call it on a schedule.

---

## LLM Processing — OpenAI

Many projects involve running data through an LLM: classifying rows, extracting fields, summarising text, rewriting content, or scoring responses. Instawork has a company OpenAI account — use the shared key from `.env`.

### When to use this pattern

- "Run each row of this spreadsheet through a prompt and write the result back"
- "Classify this list of [items] into categories"
- "Extract [fields] from unstructured text"
- "Summarise or rewrite this content"
- Anything that involves sending text to an AI and getting structured text back

### Setup

Add to `requirements.txt`:
```
openai>=1.0
```

Add to `.env.example`:
```
OPENAI_API_KEY=your-key-here   # Get from the company OpenAI account — ask your manager
```

### Shared LLM Client (scripts/llm_client.py)

One client for all LLM calls. Handles retries, rate limits, and structured output.

```python
import logging
import os
import time

from openai import OpenAI, RateLimitError, APIError
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class LLMClient:
    def __init__(self, model="gpt-4o-mini", max_retries=3, base_delay=2.0):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set in .env")
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.max_retries = max_retries
        self.base_delay = base_delay

    def complete(self, prompt: str, system: str = None, json_mode: bool = False) -> str:
        """Send a prompt and return the response text.

        Args:
            prompt: The user message / input text.
            system: Optional system prompt to set context or instructions.
            json_mode: If True, response will be valid JSON (prompt must ask for JSON).
        """
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        kwargs = {"model": self.model, "messages": messages}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.chat.completions.create(**kwargs)
                return response.choices[0].message.content
            except RateLimitError:
                wait = self.base_delay * 2 ** attempt
                logger.warning(f"Rate limited. Waiting {wait:.1f}s (attempt {attempt + 1})")
                time.sleep(wait)
            except APIError as e:
                if attempt < self.max_retries:
                    wait = self.base_delay * 2 ** attempt
                    logger.warning(f"API error: {e}. Retry in {wait:.1f}s")
                    time.sleep(wait)
                else:
                    raise

        raise RuntimeError("LLM request failed after max retries")

    def batch(self, items: list[str], prompt_template: str, system: str = None) -> list[str]:
        """Run a prompt over a list of items. Returns one response per item.

        Args:
            items: List of input strings (e.g. rows from a spreadsheet).
            prompt_template: Prompt with {item} placeholder, e.g. "Classify this: {item}"
            system: Optional system prompt.
        """
        results = []
        for i, item in enumerate(items):
            logger.info(f"Processing item {i + 1}/{len(items)}")
            prompt = prompt_template.format(item=item)
            result = self.complete(prompt, system=system)
            results.append(result)
        return results
```

### Common patterns

**Classify a list of items:**
```python
from scripts.llm_client import LLMClient

client = LLMClient()
labels = client.batch(
    items=df["feedback"].tolist(),
    prompt_template="Classify this feedback as 'positive', 'negative', or 'neutral'. Respond with one word only.\n\n{item}",
)
df["sentiment"] = labels
```

**Extract structured fields (JSON mode):**
```python
import json
from scripts.llm_client import LLMClient

client = LLMClient()

def extract_fields(text: str) -> dict:
    result = client.complete(
        prompt=f"Extract the job title and company from this text. Respond as JSON with keys 'title' and 'company'.\n\n{text}",
        json_mode=True,
    )
    return json.loads(result)
```

**Summarise with a system prompt:**
```python
summary = client.complete(
    prompt=long_text,
    system="You are a concise summariser. Respond in 2–3 sentences.",
)
```

### Model selection

| Use case | Model | Why |
|---|---|---|
| Classification, extraction, summarisation | `gpt-4o-mini` | Fast, cheap, good enough for structured tasks |
| Complex reasoning, nuanced writing | `gpt-4o` | Slower and more expensive — use when quality matters |

Default to `gpt-4o-mini`. Only upgrade to `gpt-4o` if quality is noticeably insufficient.

### Cost and rate limits

- **Rate limits:** OpenAI enforces requests-per-minute (RPM) and tokens-per-minute (TPM). For batch jobs over ~100 rows, add `time.sleep(0.5)` between calls or use the `batch()` method which processes sequentially.
- **Cost awareness:** Log token usage for large batch jobs. `gpt-4o-mini` is ~15x cheaper than `gpt-4o`.
- **Never process the same data twice:** Cache results to a CSV or database column as you go. If the script fails halfway, resume from where it left off.

### Scaffold additions for LLM projects

- Add `openai>=1.0` to `requirements.txt`
- Create `scripts/llm_client.py` from the pattern above
- Add `OPENAI_API_KEY` to `.env.example` with a comment directing to the company account
- Add a test that mocks the OpenAI client (never call the real API in tests)
- Note the model choice and cost rationale in `docs/TECHNICAL_GUIDANCE.md`

### Testing LLM code

Never call the real OpenAI API in tests — mock the client:

```python
from unittest.mock import patch, MagicMock
from scripts.llm_client import LLMClient

def test_classify():
    with patch("scripts.llm_client.OpenAI") as mock_openai:
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "positive"
        mock_openai.return_value.chat.completions.create.return_value = mock_response

        client = LLMClient()
        result = client.complete("Is this good?")
        assert result == "positive"
```

---

## Scripts Collection Pattern

Not every project is a full application. Many projects are a **collection of useful scripts** — each doing one job, easy to run independently, easy to extend later.

This is the right approach when:
- The ask is "transform this data" or "pull from this API and push to that sheet"
- There's no web frontend or API layer needed
- The user will add more scripts over time as new needs come up

### Structure
```
scripts/
├── api_client.py           # Shared API client (always present if calling APIs)
├── pull_bamboohr_data.py   # One script per job
├── transform_payroll.py
├── push_to_sheets.py
└── run_weekly_export.py    # Runner that chains scripts if needed
```

### Key principles
- Each script is independently runnable: `python scripts/pull_bamboohr_data.py`
- Each script has a corresponding `make` target: `make run-pull`, `make run-transform`
- A runner script or Makefile target can chain them: `make run-weekly-export`
- Adding a new script doesn't require changing existing ones
- Keep it flat — don't over-engineer with modules and packages for simple scripts
