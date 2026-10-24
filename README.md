
# streamhunt

  

Instant streaming availability from your terminal, powered by the Watchmode API.

  

Cross-reference any movie or TV show against your paid subscriptions, free-tier accounts (e.g., Sling Freestream, Plex), and open streaming platforms (e.g., Tubi, Pluto TV).

  

## Quick Start

  

### 1. Install

```bash

npm  install  -g  streamhunt

```

  

### 2. Search

```bash

streamhunt  "Severance"

```

  

On your first run, `streamhunt` will prompt for your Watchmode API key and save it to `~/.streamhunt/config.json`. A free API key can be obtained at [api.watchmode.com](https://api.watchmode.com/).

  

## Features

  

-  **Smart Cross-Referencing:**

-  **[Paid Sub]**: Services you pay for (e.g., Max, Netflix, Philo).

-  **[Free Tier]**: Free accounts you maintain (e.g., Sling Freestream, Plex).

-  **[Included Free]**: Free tiers from your active providers.

-  **[Public Free]**: Open ad-supported platforms with no login required (e.g., Tubi, Pluto TV).

-  **[Rent] & [Buy]**: Digital on-demand prices and formats (4K / HD) when requested.

-  **Interactive Stream Launcher:** Use the arrow keys to choose a service and open it directly in your default browser, or select **Done** to exit.

-  **Title Matching:** Interactive selection when a title has multiple matches (e.g., movies vs. TV series).

-  **24-Hour Cache:** Search responses are cached locally to conserve your monthly Watchmode API quota.


  

## Search Examples

  

### Basic Lookup

```bash

streamhunt  "The Dark Knight"

streamhunt  "Breaking Bad"

```

  

If multiple titles match, pick your title from the interactive menu:

```text

? Multiple matches found for "Breaking Bad". Select title:

> Breaking Bad (2008) | [TV Series]

El Camino: A Breaking Bad Movie (2019) | [Movie]

```

  

### View Purchase & Rental Options

Pass `--all` (or `-a`) to include digital rent/buy options and other streaming platforms:

```bash

streamhunt  "Inception"  --all

```

  

### Query Availability in Another Region

Specify any two-letter country code (e.g., `GB`, `CA`, `AU`):

```bash

streamhunt  "Dune"  --region  GB

```

  

### Machine-Readable JSON

For scripts, Alfred, or Raycast workflows:

```bash

streamhunt  "Severance"  --json

```


## Configuration & Subscriptions

  

Settings and active subscriptions are stored in `~/.streamhunt/config.json`.

  

### Fast Terminal One-Liners

  

```bash

# Set or update API key

streamhunt  config  --set-key  YOUR_WATCHMODE_API_KEY

  

# Add paid subscriptions

streamhunt  config  --add-paid  "Netflix, Apple TV+"

  

# Remove paid subscriptions

streamhunt  config  --remove-paid  "Disney+, Hulu"

  

# Add free-tier accounts

streamhunt  config  --add-free  "Tubi, Plex"

  

# Remove free-tier accounts

streamhunt  config  --remove-free  "Sling TV"

  

# Set default region

streamhunt  config  --set-region  US

  

# View active subscriptions and settings

streamhunt  config  --show

```

  

### Interactive Config Wizard

Run the interactive setup menu to toggle services with your keyboard (Space to select, Enter to save):

```bash

streamhunt  config

```

  

### List Supported Providers in Your Region

```bash

streamhunt  config  --list-providers

streamhunt  config  --list-providers  --region  GB

```

  

## Cache Management

  

Responses are cached in `~/.cache/streamhunt/` for 24 hours.

  

```bash

# Check cache statistics

streamhunt  cache  status

  

# Purge cache

streamhunt  cache  clear

```

  
## License

  

[MIT](LICENSE) (c) 2026 Ahmad Saad