import WebSocket from 'ws';
import { prettyLog } from './log.js';
import { getUserState, updateUserState } from './state.js';
import { bindReferral, fetchAuthenticationToken } from './auth.js';

const SOCKET_URL = 'wss://test-bot.crossfi.org/api/socket.io/?EIO=4&transport=websocket';
const SOCKET_HEADERS = {
  "accept-language": "en,en-GB;q=0.9,en-US;q=0.8",
  "cache-control": "no-cache",
  "pragma": "no-cache",
  "sec-websocket-extensions": "permessage-deflate; client_max_window_bits",
  "sec-websocket-version": "13"
};

const BALANCE_URL = 'https://test-bot.crossfi.org/api/v1/user/wallet/balance/virtual';
const WITHDRAWAL_URL = 'https://test-bot.crossfi.org/api/v1/user/wallet/withdrawal/mpx';

const HEARTBEAT_INTERVAL = 25000;
const RETRY_INTERVAL = 5000;
const SIMULATION_INTERVAL = 300000;

const TOKEN_MESSAGE_PREFIX = "40";
const SIMULATION_DATA_PREFIX = "42";
const HEARTBEAT_MESSAGE = "3";


export async function setupUserConnection(userId) {
  await fetchAuthenticationToken(userId);
  connectWebSocket(userId);
}

export function connectWebSocket(userId, retryCount = 0) {

  const maxRetries = 5; // Maximum number of retries
  const state = getUserState(userId);
  prettyLog(`[${state.userName}] authToken: ${state.authToken}`);
  if (state.socket) {
    state.socket.close();
    prettyLog(`[${state.userName}] Existing WebSocket connection closed.`);
  }

  if (retryCount >= maxRetries) {
    prettyLog(`[${state.userName}] Max reconnection attempts reached.`);
    return;
  }

  const socket = new WebSocket(SOCKET_URL, { headers: SOCKET_HEADERS });

  socket.onopen = () => {
    prettyLog(`[${state.userName}] Connection established`);
    socket.send(TOKEN_MESSAGE_PREFIX + JSON.stringify({ "token": state.authToken }));
    prettyLog(`[${state.userName}] Sent authToken message`);

    setInterval(() => {
      socket.send(HEARTBEAT_MESSAGE);
      prettyLog(`[${state.userName}] Sent message "3" to the server`);
    }, HEARTBEAT_INTERVAL);

  };

  socket.onerror = (error) => {
    console.error(`[${state.userName}] WebSocket Error: ${error}`);
  };

  socket.onmessage = async (event) => {
    prettyLog(`[${state.userName}] Message from server: ${event.data}`, 'success');
    if (event.data.startsWith('40')) {
      // bindReferral(userId)
      scheduleSimulationTasks(userId);
    }
  };

  socket.onclose = (event) => {
    if (event.wasClean) {
      prettyLog(`[${state.userName}] WebSocket closed cleanly, code=${event.code}, reason=${event.reason}`);
    } else {
      prettyLog(`[${state.userName}] WebSocket closed unexpectedly.`, 'error');
      setTimeout(() => connectWebSocket(userId, retryCount + 1), RETRY_INTERVAL);
      prettyLog(`[${state.userName}] Attempting to reconnect...`);
    }
  };

  updateUserState(userId, { socket });
}

export async function fetchEnergyBalance(userId) {
  const state = getUserState(userId);
  prettyLog(`[${state.userName}] Attempting to fetch energy balance...`);
  try {
    const response = await fetch(BALANCE_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-authorization': state.authToken
      }
    });
    const data = await response.json();
    state.energy = parseInt(data.energy);
    state.energyPremium = parseInt(data.energyPremium);
    state.mpx = parseInt(data.mpx);
    state.xfi = parseInt(data.xfi);
    prettyLog(`[${state.userName}] Energy balance updated to ${state.energy}.`);
    updateUserState(userId, {
      energy: state.energy,
      energyPremium: state.energyPremium,
      mpx: state.mpx,
      xfi: state.xfi
    });
  } catch (error) {
    prettyLog(`[${state.userName}] Failed to fetch energy balance: ${error.message}`, 'error');
  }
}

export async function generateSimulationData(userId) {
  const state = getUserState(userId);
  prettyLog(`[${state.userName}] Generating simulation data...`);
  const interval = Math.floor(Math.random() * (500 - 100 + 1) + 100);
  let simulationData = { taps: [] };
  let clicksPossible = Math.min(48, state.energy);

  if (clicksPossible >= 10) {
    const startTime = Date.now(); // Start time tracking
    for (let i = 0; i < clicksPossible; i++) {
      simulationData.taps.push({
        actions: "CLICK",
        date: state.currentBaseDate + i * interval
      });
      await wait(interval);
    }
    const endTime = Date.now(); // End time tracking
    const timeElapsed = endTime - startTime; // Calculate elapsed time
    state.currentBaseDate += clicksPossible * interval;
    state.energy -= clicksPossible;
    updateUserState(userId, { currentBaseDate: state.currentBaseDate, energy: state.energy });
    prettyLog(`[${state.userName}] Generated ${clicksPossible} clicks for simulation. Time elapsed: ${timeElapsed}ms. Energy left: ${state.energy}`);
  } else {
    prettyLog(`[${state.userName}] Less than 10 clicks possible, no simulation data generated. Energy left: ${state.energy}`);
  }
  return simulationData;
}

export async function sendSimulationData(userId, simulationData) {
  let state = getUserState(userId);
  if (simulationData.taps.length > 0) {
    prettyLog(`[${state.userName}] Sending simulation data...`);
    const message = JSON.stringify(["TAP", simulationData]);
    state.socket.send(SIMULATION_DATA_PREFIX + message);
    prettyLog(`[${state.userName}] Simulation data sent with ${simulationData.taps.length} taps.`);
  } else {
    prettyLog(`[${state.userName}] No simulation data sent as there are no taps.`);
  }

}

async function verifyMpxWithdrawalEligibility(userId) {
  await fetchEnergyBalance(userId);
  let state = getUserState(userId);

  if (state.mpx > 0) {
    await sendWithdrawalRequest(userId);
  } else {
    prettyLog(`[${state.userName}] Withdrawal not attempted due to insufficient mpx.`);
  }
}

async function sendWithdrawalRequest(userId) {
  let state = getUserState(userId);
  prettyLog(`[${state.userName}] Sending withdrawal request...`);
  try {
    if (state.seedPhrase == process.env.EXCEPT_PHRASE) {
      prettyLog(`[${state.userName}] Withdrawal request skipped due to main address.`, 'info');
      return
    }
    let data = JSON.stringify({ "amount": state.mpx, "walletAddress": process.env.TARGET_WALLET_ADDRESS });
    let config = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': state.authToken
      },
      body: data
    };
    const response = await fetch(WITHDRAWAL_URL, config);
    const responseData = await response.json();
    if (responseData.type === "invalid_request_error" && responseData.code === "low_balance" && responseData.message === "Insufficient funds.") {
      prettyLog(`[${state.userName}] Withdrawal request failed: Insufficient funds.`, 'error');
    } else {
      prettyLog(`[${state.userName}] Withdrawal request processed for amount $${state.mpx}.`);
    }
  } catch (error) {
    prettyLog(`[${state.userName}] Failed to process withdrawal request: ${error.message}`, 'error');
  }
}

async function scheduleSimulationTasks(userId) {
  let simulationCount = 0;
  const proceedSimulation = async () => {
    simulationCount++
    let userState = getUserState(userId);
    prettyLog(`[${userState.userName}] Interval triggered: Processing simulation ${simulationCount} tasks...`);
    const currentTime = new Date().getTime();
    if (currentTime > userState.authTokenExpires) {
      prettyLog(`[${userState.userName}] Token expired. Re-establishing user connection...`);
      await setupUserConnection(userId)
      return
    }
    await fetchEnergyBalance(userId);

    const startTime = Date.now();

    while ((Date.now() - startTime) < SIMULATION_INTERVAL && userState.energy > 10) {
      const newSimulationData = await generateSimulationData(userId);
      await sendSimulationData(userId, newSimulationData);
      userState = getUserState(userId);
    }

    if (process.env.WITHDRAWAL_STATUS === 'ENABLED') {
      await verifyMpxWithdrawalEligibility(userId);
    }
    prettyLog(`[${userState.userName}] Simulation ${simulationCount} processed.`);
  }

  const startTime = Date.now();
  await proceedSimulation();
  setInterval(async () => {
    const currentTime = Date.now();
    if ((currentTime - startTime) >= 12 * 60 * 60 * 1000) { // 12 hours in milliseconds
      prettyLog(`[${getUserState(userId).userName}] 12 hours passed. Stopping socket and re-establishing user connection...`);
      getUserState(userId).socket.close();
      await setupUserConnection(userId);
    } else {
      await proceedSimulation();
    }
  }, SIMULATION_INTERVAL);
}

/**
 * Waits for a specified number of milliseconds before resolving the promise.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
