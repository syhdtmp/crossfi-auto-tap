import fs from 'fs';
import { setupUserConnection } from './socket.js';
import { getUserState, updateUserState } from './state.js';
import { prettyLog } from './log.js';
import { bindReferral, parseTelegramData } from './auth.js'
import dotenv from 'dotenv'

class WorkerInitializer {
  constructor() {
    dotenv.config()
    this.initializeWorkers();
  }

  async initializeWorkers() {
    const tokensData = await this.readTokensData();

    tokensData.forEach(({ tgWebAppData, seedPhrase }) => {
      this.createWorker(tgWebAppData, seedPhrase);
    });
  }

  async readTokensData() {
    const data = await fs.promises.readFile('tokens.json', 'utf8');
    return JSON.parse(data);
  }

  async createWorker(tgWebAppData, seedPhrase) {
    try {
      const { userData } = parseTelegramData(tgWebAppData);
      const initialState = this.createInitialState(userData, tgWebAppData, seedPhrase);

      updateUserState(userData.id, initialState);
      const userState = getUserState(userData.id);
      prettyLog(`[${userState.userName}] Creating worker...`);

      await setupUserConnection(userData.id);
    } catch (error) {
      prettyLog(`Error creating worker: ${error}. Retrying...`, 'error');
      await this.createWorker(tgWebAppData, seedPhrase);
    }
  }

  createInitialState(userData, tgWebAppData, seedPhrase) {
    return {
      currentBaseDate: 10000,
      authToken: '',
      authTokenExpires: 0,
      refreshToken: '',
      refreshTokenExpires: 0,
      userName: `${userData.first_name} ${userData.last_name}`.trim(),
      telegramData: tgWebAppData,
      seedPhrase: seedPhrase,
      userId: userData.id,
      socket: null,
      energy: 0,
      energyPremium: 0,
      mpx: 0,
      xfi: 0
    };
  }
}

new WorkerInitializer();
