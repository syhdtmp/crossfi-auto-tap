import WebSocket from 'ws';
import { prettyLog } from './log.js';

// JWT_TOKENS is loaded from a JSON file where each object contains a JWT token and a corresponding worker ID.
// This array is used to manage multiple WebSocket connections for different workers.
import fs from 'fs';

const JWT_TOKENS = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));

JWT_TOKENS.forEach(({ token, workerId }) => {
  const socket = new WebSocket('wss://test-bot.crossfi.org/api/socket.io/?EIO=4&transport=websocket', {
    headers: {
      "accept-language": "en,en-GB;q=0.9,en-US;q=0.8",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-websocket-extensions": "permessage-deflate; client_max_window_bits",
      "sec-websocket-version": "13"
    }
  });

  socket.onopen = function (event) {
    prettyLog(`[${workerId}] Connection established`);
    prettyLog(`[${workerId}] Sent token message`);
    socket.send("40" + JSON.stringify({
      "token": token
    }));

    setInterval(() => {
      socket.send("3");
      prettyLog(`[${workerId}] Sent message "3" to the server`);
    }, 25000);

    let currentBaseDate = 12096.5; // Initialize current base date
    let energyBalance = 0; // Initialize energy balance

    async function fetchEnergyBalance() {
      prettyLog(`[${workerId}] Attempting to fetch energy balance...`);
      try {
        const response = await fetch('https://test-bot.crossfi.org/api/v1/user/wallet/balance/virtual', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'x-authorization': token
          }
        });
        const data = await response.json();
        energyBalance = parseInt(data.energy)
        prettyLog(`[${workerId}] Energy balance updated to ${energyBalance}.`);
      } catch (error) {
        prettyLog(`[${workerId}] Failed to fetch energy balance.`, 'error');
      }
    }

    function generateSimulationData() {
      prettyLog(`[${workerId}] Generating simulation data...`);
      const interval = 1000; // Interval between clicks in milliseconds
      let simulationData = { taps: [] };
      let clicksPossible = Math.min(30, energyBalance); // Calculate how many clicks can be made in 30 seconds without depleting energy

      if (clicksPossible >= 10) {
        for (let i = 0; i < clicksPossible; i++) {
          simulationData.taps.push({
            actions: "CLICK",
            date: currentBaseDate + i * interval
          });
        }
        currentBaseDate += clicksPossible * interval; // Update base date for the next interval
        energyBalance -= clicksPossible; // Decrement energy balance by the number of clicks made
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

      // Withdraw request after sending simulation data
      let amount = simulationData.taps.length * 0.5; // Calculate amount based on number of clicks
      let data = JSON.stringify({
        "amount": amount
      });

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
          const response = await fetch('https://test-bot.crossfi.org/api/v1/user/wallet/withdrawal/mpx', config);
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

    // Fetch energy balance and send simulation data every 30 seconds
    setInterval(async () => {
      prettyLog(`[${workerId}] Interval triggered: Processing tasks...`);
      await fetchEnergyBalance();
      const newSimulationData = generateSimulationData();
      await sendSimulationData(newSimulationData);
    }, 30000);

  };

  socket.onerror = function (error) {
    prettyLog(`[${workerId}] WebSocket Error: ${error}`, 'error');
  };

  socket.onmessage = function (event) {
    prettyLog(`[${workerId}] Message from server: ${event.data}`);
  };

  socket.onclose = function (event) {
    if (event.wasClean) {
      prettyLog(`[${workerId}] WebSocket closed cleanly, code=${event.code}, reason=${event.reason}`);
    } else {
      prettyLog(`[${workerId}] WebSocket closed unexpectedly.`, 'error');
    }
  };
});

