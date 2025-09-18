# Somnia Tradebot

A real-time cryptocurrency transaction monitor for the Somnia blockchain network. This bot monitors token transfers and alerts on significant buy transactions for specified tokens.

## Features

- 🔍 Real-time monitoring of token transfers on Somnia network
- 🚨 Configurable buy alerts with different threshold levels
- 📊 Transaction size classification (Small, Medium, Large, Mega buys)
- ⏱️ Customizable polling intervals
- 🎯 Focused monitoring of specific token contracts

## Prerequisites

- Node.js (v14 or higher)
- Internet connection for API access to Somnia Explorer

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/somnia-tradebot.git
cd somnia-tradebot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your token contract address
```

## Configuration

The bot is configured using environment variables. Copy `.env.example` to `.env` and modify:

- `TARGET_CONTRACT`: Token contract address to monitor
- `POLL_INTERVAL`: How often to check for new transactions in milliseconds (default: 10 seconds)
- `ALERT_THRESHOLD`: Minimum token amount to trigger significant buy alerts (default: 1000 tokens)
- `SOMNIA_EXPLORER`: Somnia Explorer base URL
- `SOMNIA_API_V2`: Somnia API v2 endpoint

## Usage

Run the bot:
```bash
npm start
```

The bot will:
1. Initialize and connect to Somnia Explorer API
2. Set a baseline with the latest transfer
3. Continuously monitor for new transactions
4. Alert when buy transactions are detected

Stop the bot with `Ctrl+C` for graceful shutdown.

## Alert Levels

The bot categorizes buys into different levels:

- 🟢 **Small Buy**: < 10,000 tokens
- 🟡 **Medium Buy**: 10,000 - 50,000 tokens
- 🟠 **Large Buy**: 50,000 - 100,000 tokens
- 🔴 **Mega Buy**: > 100,000 tokens

## API Integration

The bot integrates with:
- Somnia Explorer API v2 (`https://explorer.somnia.network/api/v2`)
- Somnex DEX for direct token viewing

## Module Export

The bot can be imported as a module in other projects:

```javascript
const { SomniaBuyListener } = require('./index.js');

const listener = new SomniaBuyListener();
listener.start();
```

## Methods

- `start()`: Begin monitoring
- `stop()`: Stop monitoring
- `manualCheck()`: Trigger a manual check for new transactions
- `getLatestTransfer()`: Fetch the most recent transfer
- `displayBuyAlert()`: Show formatted buy alert

## Error Handling

The bot includes robust error handling for:
- Network timeouts (10 second timeout)
- API errors
- JSON parsing errors
- HTML responses when expecting JSON

## License

MIT License - See LICENSE file for details

## Disclaimer

This tool is for informational purposes only. Always do your own research before making any trading decisions.