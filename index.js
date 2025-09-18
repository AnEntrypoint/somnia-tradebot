const https = require('https');

// Load environment variables
require('dotenv').config();

// Somnia Mainnet API Configuration
const SOMNIA_EXPLORER = process.env.SOMNIA_EXPLORER || 'https://explorer.somnia.network';
const SOMNIA_API_V2 = process.env.SOMNIA_API_V2 || 'https://explorer.somnia.network/api/v2';
const TARGET_CONTRACT = process.env.TARGET_CONTRACT || '0x0000000000000000000000000000000000000000';

// Listener Configuration
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10000'); // Check every 10 seconds
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD || '1000'); // Alert for buys over 1000 tokens

// Utility Functions
function makeHttpsRequest(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    }, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        try {
          if (data.trim().startsWith('<')) {
            resolve({ error: 'HTML_RESPONSE', preview: data.slice(0, 100) });
            return;
          }
          
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`JSON Parse failed: ${error.message}`));
        }
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function formatTokenAmount(amount, decimals = 18) {
  try {
    return (parseFloat(amount) / Math.pow(10, decimals)).toFixed(4);
  } catch (error) {
    return amount || '0';
  }
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';
  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return timestamp;
  }
}

function isSignificantTransaction(transfer, lastKnownTransfer) {
  // Check if this is a new transaction we haven't seen
  if (!lastKnownTransfer) return true;
  
  // Compare by timestamp and amount to detect new transactions
  const currentTime = new Date(transfer.timestamp).getTime();
  const lastTime = new Date(lastKnownTransfer.timestamp).getTime();
  
  return currentTime > lastTime || 
         (currentTime === lastTime && transfer.total?.value !== lastKnownTransfer.total?.value);
}

function isBuyTransaction(transfer) {
  // In your data, buys typically show up as transfers TO the bonding curve contract
  // This is a simplified detection - you might need to adjust based on actual patterns
  const amount = parseFloat(transfer.total?.value || 0) / Math.pow(10, transfer.total?.decimals || 18);
  return amount > 0; // Any positive transfer amount
}

// Token Buy Listener Class
class SomniaBuyListener {
  constructor() {
    this.lastKnownTransfer = null;
    this.isRunning = false;
    this.pollInterval = null;
    
    console.log('🎮 Somnia Buy Listener Initialized');
    console.log(`🎯 Monitoring: ${TARGET_CONTRACT}`);
    console.log(`⏱️  Poll Interval: ${POLL_INTERVAL / 1000}s`);
    console.log(`🚨 Alert Threshold: ${ALERT_THRESHOLD} tokens`);
  }

  async getLatestTransfer() {
    try {
      const transfersUrl = `${SOMNIA_API_V2}/tokens/${TARGET_CONTRACT}/transfers?limit=1`;
      const transfersData = await makeHttpsRequest(transfersUrl);
      
      if (!transfersData || transfersData.error || !transfersData.items) {
        return null;
      }
      
      return transfersData.items[0] || null;
    } catch (error) {
      console.log(`❌ Error fetching latest transfer: ${error.message}`);
      return null;
    }
  }

  displayBuyAlert(transfer) {
    const amount = transfer.total?.value || '0';
    const decimals = transfer.total?.decimals || 18;
    const formattedAmount = formatTokenAmount(amount, decimals);
    const tokenAmount = parseFloat(formattedAmount);
    
    const txHash = transfer.tx_hash || 'N/A';
    const from = transfer.from?.hash || 'N/A';
    const to = transfer.to?.hash || 'N/A';
    const timestamp = formatTimestamp(transfer.timestamp);
    
    // Determine alert level based on size
    let alertLevel = '🟢';
    let alertType = 'SMALL BUY';
    
    if (tokenAmount >= 100000) {
      alertLevel = '🔴';
      alertType = 'MEGA BUY';
    } else if (tokenAmount >= 50000) {
      alertLevel = '🟠';
      alertType = 'LARGE BUY';
    } else if (tokenAmount >= 10000) {
      alertLevel = '🟡';
      alertType = 'MEDIUM BUY';
    }
    
    console.log('\n' + '🚨'.repeat(20));
    console.log(`${alertLevel} NEW ${alertType} DETECTED! ${alertLevel}`);
    console.log('🚨'.repeat(20));
    console.log(`💎 Amount: ${formattedAmount} SCHWEPE tokens`);
    console.log(`⏰ Time: ${timestamp}`);
    console.log(`📤 From: ${from.slice(0, 12)}...${from.slice(-6)}`);
    console.log(`📥 To: ${to.slice(0, 12)}...${to.slice(-6)}`);
    console.log(`🔗 TX: ${txHash !== 'N/A' ? txHash.slice(0, 25) + '...' : 'N/A'}`);
    console.log(`🌐 Explorer: ${SOMNIA_EXPLORER}/token/${TARGET_CONTRACT}`);
    console.log('🚨'.repeat(20) + '\n');
    
    // Extra alert for significant buys
    if (tokenAmount >= ALERT_THRESHOLD) {
      console.log(`🚨🚨🚨 SIGNIFICANT BUY: ${formattedAmount} tokens! 🚨🚨🚨`);
    }
  }

  async checkForNewBuys() {
    try {
      const latestTransfer = await this.getLatestTransfer();
      
      if (!latestTransfer) {
        console.log('⚠️  No transfer data available');
        return;
      }
      
      // If this is our first run, just store the latest transfer
      if (!this.lastKnownTransfer) {
        this.lastKnownTransfer = latestTransfer;
        console.log(`✅ Baseline set - Latest transfer: ${formatTokenAmount(latestTransfer.total?.value, latestTransfer.total?.decimals)} tokens at ${formatTimestamp(latestTransfer.timestamp)}`);
        return;
      }
      
      // Check if this is a new transaction
      if (isSignificantTransaction(latestTransfer, this.lastKnownTransfer)) {
        // Check if it's a buy transaction
        if (isBuyTransaction(latestTransfer)) {
          this.displayBuyAlert(latestTransfer);
        }
        
        // Update our baseline
        this.lastKnownTransfer = latestTransfer;
      } else {
        // Silent check - no new activity
        process.stdout.write('.');
      }
      
    } catch (error) {
      console.log(`💥 Error in buy check: ${error.message}`);
    }
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  Listener is already running!');
      return;
    }
    
    console.log('\n🚀 Starting Buy Listener...');
    console.log('═'.repeat(50));
    
    this.isRunning = true;
    
    // Initial check
    this.checkForNewBuys();
    
    // Set up polling
    this.pollInterval = setInterval(() => {
      this.checkForNewBuys();
    }, POLL_INTERVAL);
    
    console.log(`👂 Listening for new buys on token...`);
    console.log(`🔄 Checking every ${POLL_INTERVAL / 1000} seconds`);
    console.log('Press Ctrl+C to stop\n');
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Listener is not running!');
      return;
    }
    
    console.log('\n🛑 Stopping Buy Listener...');
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    this.isRunning = false;
    console.log('✅ Buy Listener stopped');
  }

  // Manual check method for testing
  async manualCheck() {
    console.log('\n🔍 Manual check triggered...');
    await this.checkForNewBuys();
  }
}

// Main execution
async function main() {
  const listener = new SomniaBuyListener();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Received shutdown signal...');
    listener.stop();
    process.exit(0);
  });
  
  // Start listening
  listener.start();
  
  // Keep the process alive
  process.stdin.resume();
}

// Export for use in other modules
module.exports = { SomniaBuyListener };

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
