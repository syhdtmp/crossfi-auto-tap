import WebSocket from 'ws';
import { prettyLog } from './log.js';
import fs from 'fs';

const JWT_TOKENS = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));

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
const SIMULATION_INTERVAL = 30000;

JWT_TOKENS.forEach(({ token, workerId }) => {
  const socket = new WebSocket(SOCKET_URL, { headers: SOCKET_HEADERS });

  socket.onopen = () => {
    prettyLog(`[${workerId}] Connection established`);
    socket.send("40" + JSON.stringify({ "token": token }));
    prettyLog(`[${workerId}] Sent token message`);

    setInterval(() => {
      socket.send("3");
      prettyLog(`[${workerId}] Sent message "3" to the server`);
    }, HEARTBEAT_INTERVAL);

    let currentBaseDate = 12096.5;
    let energyBalance = 0;

    async function fetchEnergyBalance() {
      prettyLog(`[${workerId}] Attempting to fetch energy balance...`);
      try {
        const response = await fetch(BALANCE_URL, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'x-authorization': token
          }
        });
        const data = await response.json();
        energyBalance = parseInt(data.energy);
        prettyLog(`[${workerId}] Energy balance updated to ${energyBalance}.`);
      } catch (error) {
        prettyLog(`[${workerId}] Failed to fetch energy balance.`, 'error');
      }
    }
    function generateSimulationData() {
      prettyLog(`[${workerId}] Generating simulation data...`);
      const interval = 1000;
      let simulationData = { taps: [] };
      let clicksPossible = Math.min(SIMULATION_INTERVAL / interval, energyBalance);

      if (clicksPossible >= 10) {
        for (let i = 0; i < clicksPossible; i++) {
          simulationData.taps.push({
            actions: "CLICK",
            date: currentBaseDate + i * interval
          });
        }
        currentBaseDate += clicksPossible * interval;
        energyBalance -= clicksPossible;
        prettyLog(`[${workerId}] Generated ${clicksPossible} clicks for simulation.`);
      } else {
        prettyLog(`[${workerId}] Less than 10 clicks possible, no simulation data generated.`);
      }
      return simulationData;
    }

    async function sendSimulationData(simulationData) {
      if (simulationData.taps.length > 0) {
        prettyLog(`[${workerId}] Sending simulation data...`);
        const message = JSON.stringify(["TAP", simulationData]);
        socket.send("42" + message);
        prettyLog(`[${workerId}] Simulation data sent with ${simulationData.taps.length} taps.`);
      } else {
        prettyLog(`[${workerId}] No simulation data sent as there are no taps.`);
      }

      let amount = simulationData.taps.length * 0.5;
      let data = JSON.stringify({ "amount": amount });
      let config = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-authorization': token
        },
        body: data
      };

      if (amount > 0) {
        prettyLog(`[${workerId}] Sending withdrawal request...`);
        try {
          const response = await fetch(WITHDRAWAL_URL, config);
          const responseData = await response.json();
          if (responseData.type === "invalid_request_error" && responseData.code === "low_balance" && responseData.message === "Insufficient funds.") {
            prettyLog(`[${workerId}] Withdrawal request failed: Insufficient funds.`, 'error');
          } else {
            prettyLog(`[${workerId}] Withdrawal request processed for amount $${amount}.`);
          }
        } catch (error) {
          prettyLog(`[${workerId}] Failed to process withdrawal request.`, 'error');
        }
      } else {
        prettyLog(`[${workerId}] No withdrawal made due to zero amount.`);
      }
    }

    setInterval(async () => {
      prettyLog(`[${workerId}] Interval triggered: Processing tasks...`);
      await fetchEnergyBalance();
      const newSimulationData = generateSimulationData();
      await sendSimulationData(newSimulationData);
    }, SIMULATION_INTERVAL);
  };

  socket.onerror = (error) => {
    prettyLog(`[${workerId}] WebSocket Error: ${error}`, 'error');
  };

  socket.onmessage = (event) => {
    prettyLog(`[${workerId}] Message from server: ${event.data}`, 'success');
  };

  socket.onclose = (event) => {
    if (event.wasClean) {
      prettyLog(`[${workerId}] WebSocket closed cleanly, code=${event.code}, reason=${event.reason}`);
    } else {
      prettyLog(`[${workerId}] WebSocket closed unexpectedly.`, 'error');
    }
  };
});
