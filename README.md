# streamhunt

> Production-grade streaming availability CLI tool powered by the Watchmode API.
> Instantly discover where any movie or TV show is streaming, cross-referenced against your specific paid subscriptions, free-tier accounts (e.g., Sling Freestream, Philo Free Channels), and open ad-supported platforms (e.g., Tubi, Pluto TV).

---

## Features

- **Smart Cross-Referencing:** Categorizes platforms into:
  - **[Paid Sub]**: Content streaming on services you pay for (e.g., Max, Netflix, Philo).
  - **[Free Tier]**: Content streaming on free/freemium accounts you maintain (e.g., Sling Freestream, Plex).
  - **[Included Free]**: Free streams offered by providers in your subscription list.
  - **[Public Free]**: Open, ad-supported streaming platforms requiring no account (e.g., Tubi, Pluto TV).
  - **[Rent]** & **[Buy]**: Digital video on-demand pricing and highest available resolution (4K/HD).
  - **[Other Sub]**: Other subscription providers with `--all`.
- **Interactive Title Resolution:** If a query matches multiple titles (e.g., *"Batman"* or *"Breaking Bad"*), an interactive terminal prompt lets you choose the exact movie or TV series.
- **Keyboard-Controlled Stream Selector:** Navigate available streams using the arrow keys to open any service in your default browser, or select **Done** to return to your normal terminal.
- **24-Hour Local Cache:** Cached in `~/.cache/streamhunt/` to minimize external HTTP requests and conserve Watchmode API quota.
- **Interactive Config Wizard:** Run `streamhunt config` to configure your subscriptions, free tiers, and target region.
- **Type-Safe and Robust:** Built with strict TypeScript, Zod schema validation, native `fetch` with timeout and rate-limit detection, and comprehensive unit tests.

---

## Installation and Setup

### 1. Prerequisites
- **Node.js** v20.0.0 or higher
- **Watchmode API Key** (Free tier available at [api.watchmode.com](https://api.watchmode.com/))

### 2. Global Installation (via npm)
```bash
npm install -g streamhunt
```

Or for local development from source:
```bash
git clone https://github.com/your-username/streamhunt.git
cd streamhunt
npm install
npm run build
npm link
```

### 3. Configure Your API Key
You can configure your key in any of the following ways (no local `.env` required):

**Option A: Fast one-liner**
```bash
streamhunt config --set-key YOUR_WATCHMODE_API_KEY
```

**Option B: Automatic on first search**
Simply run your first search. If no key is detected, `streamhunt` will prompt you to enter it and save it automatically:
```bash
streamhunt "The Dark Knight"
```

**Option C: Interactive wizard**
```bash
streamhunt config
```

**Option D: Environment variable (Optional / CI)**
```bash
export WATCHMODE_API_KEY="your_watchmode_api_key_here"
```

---

## Usage

### 1. Basic Movie & TV Show Lookup
```bash
streamhunt "The Dark Knight"
```
```bash
streamhunt "Breaking Bad"
```

If multiple fuzzy matches exist, an interactive prompt will appear:
```text
? Multiple matches found for "Breaking Bad". Select title:
> Breaking Bad (2008) | [TV Series]
  El Camino: A Breaking Bad Movie (2019) | [Movie]
```

### 2. View All Platforms (Rent, Buy & Non-Subscribed Services)
Pass `-a` or `--all` to display digital purchase/rental prices and other SVOD services:
```bash
streamhunt "Inception" --all
```

### 3. Override Target Market / Country Region
Query availability in Canada, Great Britain, etc.:
```bash
streamhunt "Dune" --region GB
streamhunt "Succession" --region CA
```

### 4. JSON Output (Scripting & Automation)
Output machine-readable JSON for integration into scripts or Raycast/Alfred workflows:
```bash
streamhunt "Severance" --json
```

---

## Configuration and Subscriptions

User preferences are stored at `~/.streamhunt/config.json`. The file is automatically created with sensible defaults on first run.

### View Active Subscriptions and Settings
Display a formatted card of your active subscriptions, free tiers, and region:
```bash
streamhunt config --show
```

### Add Services (Terminal One-Liners)
Add one or more services (comma-separated) to your paid subscriptions or free-tier accounts:
```bash
# Add paid subscriptions
streamhunt config --add-paid "Netflix, Apple TV+"

# Add free-tier accounts
streamhunt config --add-free "Tubi, Plex"
```

### Remove Services (Terminal One-Liners)
Remove services when you cancel or change subscriptions:
```bash
# Remove from paid subscriptions
streamhunt config --remove-paid "Disney+, Hulu"

# Remove from free-tier accounts
streamhunt config --remove-free "Sling TV"
```

### Interactive Configuration Wizard
Alternatively, run the interactive CLI wizard to toggle services using an interactive checkbox menu (Spacebar to toggle, Enter to confirm):
```bash
streamhunt config
```

### List Supported Providers in Your Region
Inspect all platforms recognized by Watchmode in your region:
```bash
streamhunt config --list-providers
```
To check providers in another region:
```bash
streamhunt config --list-providers --region GB
```

### Manual Configuration Schema
You can edit `~/.streamhunt/config.json` directly:
```json
{
  "api_key": "your_watchmode_api_key_here",
  "region": "US",
  "subscriptions": {
    "paid": [
      "Disney+",
      "Prime Video",
      "Hulu",
      "Peacock"
    ],
    "free_tier_only": [
      "Sling TV",
      "Philo",
      "The Roku Channel",
      "Plex",
      "Cineverse",
      "Google TV Freeplay",
      "Hoopla",
      "YouTube"
    ]
  },
  "always_include_public_free": true,
  "include_rent_buy": false
}
```

---

## Cache Management

Search queries and source responses are cached in `~/.cache/streamhunt/` for 24 hours to conserve API limits.

### View Cache Metrics
```bash
streamhunt cache status
```
Output:
```text
Cache Statistics:
  - Location: /Users/username/.cache/streamhunt
  - Cached entries: 9
  - Total size: 15.4 KB
  - Cache TTL: 24 hours
```

### Clear Cache
```bash
streamhunt cache clear
```

---

## Testing

Run the automated test suite covering monetization matching, quality deduplication, alias normalization, error handling, and cache expiration:
```bash
npm test
```

To run TypeScript compiler in watch mode during development:
```bash
npm run watch
```

---

## Architecture and Project Structure

```text
streamhunt/
├── .env.example          # Environment variable template
├── .env                  # Local environment file (ignored by Git)
├── package.json          # Project metadata, scripts, and dependencies
├── tsconfig.json         # Strict TypeScript compiler options
├── src/
│   ├── index.ts          # Programmatic library exports
│   ├── cli.ts            # Commander CLI commands and action handlers
│   ├── config.ts         # User config (~/.streamhunt) and .env loader
│   ├── cache.ts          # Local file-based 24-hr TTL cache manager
│   ├── api.ts            # Typed Watchmode API client with rate limit detection
│   ├── matcher.ts        # Categorization engine (paid, free tier, public free, rent/buy)
│   ├── formatter.ts      # Terminal layout engine: clean cards, badges, hyperlinks
│   ├── wizard.ts         # Interactive configuration wizard (@inquirer/prompts)
│   ├── types.ts          # Zod validation schemas and TypeScript interfaces
│   └── utils/
│       ├── terminal.ts   # OSC 8 terminal hyperlink sequences and string helpers
│       └── mockData.ts   # Offline mock data for testing and demonstrations
└── test/
    ├── matcher.test.ts   # Tier categorization and alias deduplication tests
    ├── cache.test.ts     # Local cache TTL and file management tests
    ├── config.test.ts    # Config validation and region priority tests
    └── api.test.ts       # Watchmode client and error handling tests
```

---

## License
MIT
