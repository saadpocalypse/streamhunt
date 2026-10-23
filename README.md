# 🎬 streamfind

> **Production-grade streaming availability CLI tool powered by the Watchmode API.**  
> Instantly discover where any movie or TV show is streaming, cross-referenced against your specific paid subscriptions, free-tier accounts (e.g., Sling Freestream, Philo Free Channels), and open ad-supported platforms (e.g., Tubi, Pluto TV).

---

## ⚡ Features

- **🎯 Smart Cross-Referencing:** Categorizes platforms into:
  - 🟢 **[Paid Sub]**: Content streaming on services you pay for (e.g., Max, Netflix, Philo).
  - 🟡 **[Free Tier]**: Content streaming on free/freemium accounts you maintain (e.g., Sling Freestream, Plex).
  - 🟢 **[Included Free]**: Free streams offered by providers in your subscription list.
  - 🔵 **[Public Free]**: Open, ad-supported streaming platforms requiring no account (e.g., Tubi, Pluto TV).
  - 🟣 **[Rent]** & 🔵 **[Buy]**: Digital video on-demand pricing and highest available resolution (4K/HD).
  - ⚪ **[Other Sub]**: Other subscription providers with `--all`.
- **🍿 Interactive Title Resolution:** If a query matches multiple titles (e.g., *"Batman"* or *"Breaking Bad"*), an interactive terminal prompt lets you choose the exact movie or TV series.
- **🔗 Clickable Terminal Deep Links:** Direct stream URLs rendered as native OSC 8 hyperlinks (`➜ Open Stream`) to launch directly into your browser or app.
- **⚡ 24-Hour Local Cache:** Cached in `~/.cache/streamfind/` to minimize external HTTP requests and conserve Watchmode API quota.
- **⚙️ Interactive Config Wizard:** Run `streamfind config` to configure your subscriptions, free tiers, and target region.
- **🛡️ Type-Safe & Robust:** Built with strict TypeScript, Zod schema validation, native `fetch` with timeout and rate-limit detection, and comprehensive unit tests.

---

## 📦 Installation & Setup

### 1. Prerequisites
- **Node.js** v20.0.0 or higher
- **Watchmode API Key** (Free tier available at [api.watchmode.com](https://api.watchmode.com/))

### 2. Install Dependencies & Build
```bash
git clone https://github.com/your-username/streamfind.git
cd streamfind
npm install
npm run build
```

### 3. Expose Globally
Expose `streamfind` across your entire system shell:
```bash
npm link
```
Verify the installation:
```bash
streamfind --version
```

### 4. Configure Your API Key
Add your key to the project `.env` file or export it in your shell (`~/.zshrc` / `~/.bashrc`):
```bash
# In your .env file:
WATCHMODE_API_KEY=your_watchmode_api_key_here
STREAMFIND_DEFAULT_REGION=US
```
Or export directly:
```bash
export WATCHMODE_API_KEY="your_watchmode_api_key_here"
```

---

## 🚀 Usage

### 1. Basic Movie & TV Show Lookup
```bash
streamfind "The Dark Knight"
```
```bash
streamfind "Breaking Bad"
```

If multiple fuzzy matches exist, an interactive prompt will appear:
```text
? Multiple matches found for "Breaking Bad". Select title:
❯ Breaking Bad (2008) • [TV Series]
  El Camino: A Breaking Bad Movie (2019) • [Movie]
```

### 2. View All Platforms (Rent, Buy & Non-Subscribed Services)
Pass `-a` or `--all` to display digital purchase/rental prices and other SVOD services:
```bash
streamfind "Inception" --all
```

### 3. Override Target Market / Country Region
Query availability in Canada, Great Britain, etc.:
```bash
streamfind "Dune" --region GB
streamfind "Succession" --region CA
```

### 4. JSON Output (Scripting & Automation)
Output machine-readable JSON for integration into scripts or Raycast/Alfred workflows:
```bash
streamfind "Severance" --json
```

---

## ⚙️ Configuration & Subscriptions

User preferences are stored at `~/.streamfind/config.json`. The file is automatically created with sensible defaults on first run.

### Interactive Configuration Wizard
Run the interactive CLI wizard to select your paid subscriptions, free-tier accounts, and preferences:
```bash
streamfind config
```

### List Supported Providers in Your Region
Inspect the exact names recognized by Watchmode (useful for verifying spelling like `"Sling TV"` vs `"Philo"`):
```bash
streamfind config --list-providers
```
To check providers in another region:
```bash
streamfind config --list-providers --region GB
```

### Manual Configuration Schema
You can edit `~/.streamfind/config.json` directly:
```json
{
  "region": "US",
  "subscriptions": {
    "paid": [
      "Max",
      "Philo",
      "Netflix",
      "Disney+"
    ],
    "free_tier_only": [
      "Sling TV",
      "Plex"
    ]
  },
  "always_include_public_free": true,
  "include_rent_buy": false
}
```

---

## 🗄️ Cache Management

Search queries and source responses are cached in `~/.cache/streamfind/` for 24 hours to conserve API limits.

### View Cache Metrics
```bash
streamfind cache status
```
Output:
```text
Cache Statistics:
  • Location: /Users/username/.cache/streamfind
  • Cached entries: 9
  • Total size: 15.4 KB
  • Cache TTL: 24 hours
```

### Clear Cache
```bash
streamfind cache clear
```

---

## 🧪 Testing

Run the automated test suite covering monetization matching, quality deduplication, alias normalization, error handling, and cache expiration:
```bash
npm test
```

To run TypeScript compiler in watch mode during development:
```bash
npm run watch
```

---

## 🏗️ Architecture & Project Structure

```text
streamfind/
├── .env.example          # Environment variable template
├── .env                  # Local environment file (ignored by Git)
├── package.json          # Project metadata, scripts, and dependencies
├── tsconfig.json         # Strict TypeScript compiler options
├── src/
│   ├── index.ts          # Programmatic library exports
│   ├── cli.ts            # Commander CLI commands and action handlers
│   ├── config.ts         # User config (~/.streamfind) & .env loader
│   ├── cache.ts          # Local file-based 24-hr TTL cache manager
│   ├── api.ts            # Typed Watchmode API client with rate limit detection
│   ├── matcher.ts        # Categorization engine (paid, free tier, public free, rent/buy)
│   ├── formatter.ts      # Terminal layout engine: boxen cards, badges, hyperlinks
│   ├── wizard.ts         # Interactive configuration wizard (@inquirer/prompts)
│   ├── types.ts          # Zod validation schemas & TypeScript interfaces
│   └── utils/
│       ├── terminal.ts   # OSC 8 terminal hyperlink sequences & string helpers
│       └── mockData.ts   # Offline mock data for testing & demonstrations
└── test/
    ├── matcher.test.ts   # Tier categorization & alias deduplication tests
    ├── cache.test.ts     # Local cache TTL & file management tests
    ├── config.test.ts    # Config validation & region priority tests
    └── api.test.ts       # Watchmode client & error handling tests
```

---

## 📄 License
MIT © [Ahmad Saad](https://github.com/)
