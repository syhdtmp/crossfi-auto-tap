import fs from 'fs';
import { setupUserConnection } from './socket.js';
import { getUserState, updateUserState } from './state.js';
import { prettyLog } from './log.js';
import { parseTelegramData } from './auth.js'

class WorkerInitializer {
  constructor() {
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
    const { userData } = parseTelegramData(tgWebAppData);
    const initialState = this.createInitialState(userData, tgWebAppData, seedPhrase);

    updateUserState(userData.id, initialState);
    const userState = getUserState(userData.id);
    prettyLog(`[${userState.userName}] Creating worker...`);

    await setupUserConnection(userData.id);
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
