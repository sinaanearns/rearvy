#!/usr/bin/env node

/**
 * AI-Trader Integration CLI Management Tool
 * 
 * Usage:
 *   node scripts/ai-trader-manager.mjs register          # Register agent on AI-Trader
 *   node scripts/ai-trader-manager.mjs status            # Check registration status
 *   node scripts/ai-trader-manager.mjs publish <symbol>  # Publish test signal
 *   node scripts/ai-trader-manager.mjs follow <leaderId> # Enable copy-trading
 *   node scripts/ai-trader-manager.mjs unfollow <id>     # Disable copy-trading
 *   node scripts/ai-trader-manager.mjs sync-history      # View trade syncs
 */

import https from 'https';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE_URL = process.env.VITE_AI_TRADER_API_URL || 'https://ai4trade.ai/api';
const API_KEY = process.env.VITE_AI_TRADER_API_KEY;
const LOCAL_API_BASE = 'http://localhost:3000/api/trading/ai-trader';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function makeRequest(method, url, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (API_KEY) {
      options.headers['Authorization'] = `Bearer ${API_KEY}`;
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function registerAgent() {
  console.log('\n📝 Registering Rearvy agent on AI-Trader...\n');

  const agentName = await question('Agent name (default: Rearvy AI): ') || 'Rearvy AI';
  const tradingMode = await question('Trading mode [paper/live] (default: paper): ') || 'paper';

  try {
    const response = await makeRequest('POST', `${LOCAL_API_BASE}/register`, {
      agentName,
      tradingMode
    });

    if (response.status === 200 && response.body.success) {
      console.log('\n✅ Agent registered successfully!');
      console.log(`   Agent ID: ${response.body.agentId}`);
      console.log(`   Name: ${response.body.profile?.name}`);
      console.log(`   Status: ${response.body.profile?.status || 'active'}`);
    } else {
      console.log(`\n❌ Registration failed: ${response.body.error}`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

async function checkStatus() {
  console.log('\n🔍 Checking AI-Trader registration status...\n');

  try {
    const response = await makeRequest('GET', `${LOCAL_API_BASE}/register`);

    if (response.status === 200) {
      const data = response.body;
      if (data.registered) {
        console.log('✅ Agent is registered on AI-Trader');
        console.log(`   Agent ID: ${data.agentId}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Registered: ${data.registeredAt}`);
        console.log('\n⚙️  Settings:');
        console.log(`   Trading Mode: ${data.config?.tradingMode || 'N/A'}`);
        console.log(`   Auto-Publish: ${data.config?.autoPublishSignals ? 'Enabled' : 'Disabled'}`);
        console.log(`   Auto-Execute: ${data.config?.autoExecuteCopyTrades ? 'Enabled' : 'Disabled'}`);
        
        if (data.profile) {
          console.log('\n📊 Profile Stats:');
          console.log(`   Win Rate: ${data.profile.winRate || 'N/A'}`);
          console.log(`   Total Trades: ${data.profile.totalTrades || 'N/A'}`);
          console.log(`   Followers: ${data.profile.followers || 'N/A'}`);
        }
      } else {
        console.log('⚠️  Agent is NOT registered on AI-Trader');
        console.log('   Run: node scripts/ai-trader-manager.mjs register');
      }
    } else {
      console.log(`\n❌ Status check failed: ${response.body.error}`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

async function publishTestSignal(symbol) {
  console.log(`\n📤 Publishing test signal for ${symbol}...\n`);

  const action = await question('Action [Buy/Sell] (default: Buy): ') || 'Buy';
  const confidence = parseFloat(await question('Confidence 0-1 (default: 0.75): ') || '0.75');
  const entryPrice = parseFloat(await question('Entry price: '));
  const stopPrice = parseFloat(await question('Stop-loss price: '));
  const targetPrice = parseFloat(await question('Take-profit price: '));
  const reason = await question('Trading reason: ');

  try {
    const response = await makeRequest('POST', `${LOCAL_API_BASE}/publish-signal`, {
      symbol,
      action,
      confidence,
      entryLevel: entryPrice,
      stopLevel: stopPrice,
      targetLevel: targetPrice,
      timeframe: 'H1',
      reasoning: reason
    });

    if (response.status === 200 && response.body.success) {
      console.log('\n✅ Signal published successfully!');
      console.log(`   Signal ID: ${response.body.signal.id}`);
      console.log(`   Symbol: ${response.body.signal.symbol}`);
      console.log(`   Action: ${response.body.signal.action}`);
      console.log(`   Confidence: ${(response.body.signal.confidence * 100).toFixed(0)}%`);
      console.log(`   Tags: ${response.body.signal.tags?.join(', ') || 'N/A'}`);
    } else {
      console.log(`\n❌ Publication failed: ${response.body.error}`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

async function enableCopyTrade(leaderId) {
  console.log(`\n🔗 Enabling copy-trading from ${leaderId}...\n`);

  const symbols = (await question('Symbols (comma-separated, e.g., BTC,ETH): ')).split(',').map(s => s.trim());
  const positionSize = parseFloat(await question('Position size 0-1 (default: 0.5): ') || '0.5');
  const autoExecute = (await question('Auto-execute copies? [y/n] (default: n): ') || 'n').toLowerCase() === 'y';

  try {
    const response = await makeRequest('POST', `${LOCAL_API_BASE}/copytrade`, {
      leaderId,
      symbols,
      positionSize,
      autoExecute
    });

    if (response.status === 200 && response.body.success) {
      console.log('\n✅ Copy-trading enabled!');
      console.log(`   Following: ${response.body.followingAgent}`);
      console.log(`   Symbols: ${response.body.symbols.join(', ')}`);
      console.log(`   Position Size: ${(positionSize * 100).toFixed(0)}%`);
      console.log(`   Auto-Execute: ${autoExecute ? 'Enabled' : 'Manual'}`);
    } else {
      console.log(`\n❌ Failed to enable copy-trading: ${response.body.error}`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

async function disableCopyTrade(leaderId) {
  console.log(`\n🔌 Disabling copy-trading from ${leaderId}...\n`);

  try {
    const response = await makeRequest('DELETE', `${LOCAL_API_BASE}/copytrade`, {
      leaderId
    });

    if (response.status === 200 && response.body.success) {
      console.log('\n✅ Copy-trading disabled!');
    } else {
      console.log(`\n❌ Failed to disable: ${response.body.error}`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

async function viewSyncHistory() {
  console.log('\n📊 AI-Trader Trade Sync History\n');

  try {
    const response = await makeRequest('GET', `${LOCAL_API_BASE}/market-intel?action=sync-history`);

    if (response.status === 200 && response.body.syncs) {
      const syncs = response.body.syncs;
      if (syncs.length === 0) {
        console.log('   No trades synced yet.');
      } else {
        console.log(`   Total syncs: ${syncs.length}\n`);
        syncs.slice(0, 10).forEach(sync => {
          console.log(`   [${sync.symbol}] ${sync.action} ${sync.quantity} @ ${sync.entryPrice}`);
          console.log(`   Status: ${sync.status} | Synced: ${sync.syncedAt}`);
          console.log();
        });
      }
    } else {
      console.log(`❌ Failed to fetch history: ${response.body.error}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  console.log('\n🚀 Rearvy AI-Trader Integration Manager\n');

  if (!API_KEY) {
    console.warn('⚠️  Warning: VITE_AI_TRADER_API_KEY not set in environment');
  }

  switch (command) {
    case 'register':
      await registerAgent();
      break;
    case 'status':
      await checkStatus();
      break;
    case 'publish':
      if (!arg) {
        console.log('❌ Usage: node scripts/ai-trader-manager.mjs publish <symbol>');
        break;
      }
      await publishTestSignal(arg);
      break;
    case 'follow':
      if (!arg) {
        console.log('❌ Usage: node scripts/ai-trader-manager.mjs follow <leaderId>');
        break;
      }
      await enableCopyTrade(arg);
      break;
    case 'unfollow':
      if (!arg) {
        console.log('❌ Usage: node scripts/ai-trader-manager.mjs unfollow <leaderId>');
        break;
      }
      await disableCopyTrade(arg);
      break;
    case 'sync-history':
      await viewSyncHistory();
      break;
    default:
      console.log('Available commands:');
      console.log('  register          - Register agent on AI-Trader');
      console.log('  status            - Check registration and config status');
      console.log('  publish <symbol>  - Publish a test signal');
      console.log('  follow <leaderId> - Enable copy-trading from a leader');
      console.log('  unfollow <id>     - Disable copy-trading');
      console.log('  sync-history      - View trade sync history\n');
  }

  rl.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
