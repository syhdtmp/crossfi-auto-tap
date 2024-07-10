import { Wallet } from 'ethers';
import { prettyLog } from './log.js';
import { getUserState, logUserState, updateUserState } from './state.js';
import fs from 'fs';

const chainId = "0x103d";

export async function fetchAuthenticationToken(userId) {
  try {
    const userState = getUserState(userId);
    if (!userState.seedPhrase) {
      throw new Error('Invalid seed phrase.');
    }
    const wallet = initializeWallet(userState.seedPhrase);

    const address = await wallet.getAddress();
    prettyLog(`[${userState.userName}] Wallet address retrieved: ${address}`, 'info');

    const message = await fetchAndLogNonce(address, chainId, userId);
    const signature = await signAndLogMessage(wallet, message, userId);
    const authData = await authenticateAndLogUser(address, chainId, signature, userId);
    updateUserState(userId, {
      authToken: authData.authToken,
      authTokenExpires: authData.authTokenExpires,
      refreshToken: authData.refreshToken,
      refreshTokenExpires: authData.refreshTokenExpires
    });
  } catch (error) {
    prettyLog(`Authentication failed: ${error.message}`, 'error');
    throw error;
  }
}

function initializeWallet(seedPhrase) {
  if (!seedPhrase) {
    throw new Error('Seed phrase is required.');
  }
  return Wallet.fromPhrase(seedPhrase);
}

async function fetchAndLogNonce(address, chainId, userId) {
  try {
    const message = await fetchNonce(address, chainId);
    prettyLog(`[${getUserState(userId).userName}] Nonce fetched: ${message}`, 'info');
    return message;
  } catch (error) {
    prettyLog(`Failed to fetch nonce: ${error.message}`, 'error');
    throw error;
  }
}

async function signAndLogMessage(wallet, message, userId) {
  try {
    const signature = await wallet.signMessage(message);
    prettyLog(`[${getUserState(userId).userName}] Message signed: ${signature}`, 'info');
    return signature;
  } catch (error) {
    prettyLog(`Failed to sign message: ${error.message}`, 'error');
    throw error;
  }
}

async function authenticateAndLogUser(address, chainId, signature, userId) {
  try {
    const response = await authenticateUserWithWeb3AndTelegram(address, chainId, signature, userId);
    prettyLog(`[${getUserState(userId).userName}] User authenticated with Web3 and Telegram`, 'success');
    return {
      authToken: response.authorizationToken.token,
      authTokenExpires: response.authorizationToken.expiresIn,
      refreshToken: response.refreshToken.token,
      refreshTokenExpires: response.refreshToken.expiresIn
    };
  } catch (error) {
    prettyLog(`Authentication failed: ${error.message}`, 'error');
    throw error;
  }
}

export async function fetchNonce(address, chainId) {
  const url = `https://testpad.xfi.foundation/api/v1/web3/utils/nonce?address=${address}&chainId=${chainId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    }
  });
  if (!response.ok) {
    prettyLog('Failed to fetch nonce', 'error');
    throw new Error('Failed to fetch nonce');
  }
  return (await response.json()).msg;
}

export async function authenticateUserWithWeb3AndTelegram(address, chainId, signature, userId) {
  const userState = getUserState(userId);
  const bodyContent = JSON.stringify({
    address: address,
    chainId: chainId,
    signature: signature,
    telegramId: userState.userId
  });

  const response = await fetch("https://testpad.xfi.foundation/api/v1/authenticate/web3-wallet-and-telegram", {
    method: 'POST',
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "origin": "https://bot.crossfi.org",
      "referer": "https://bot.crossfi.org/",
      "x-tg-data": extractTelegramDataToString(userState.telegramData)
    },
    body: bodyContent
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to authenticate user: ${errorText}`);
  }

  return await response.json();
}

export function extractTelegramDataToString(telegramData) {
  const decodedData = decodeURIComponent(telegramData);
  const params = new URLSearchParams(decodedData);

  return `${params.get('tgWebAppData')}&user=${encodeURIComponent(params.get('user'))}&auth_date=${params.get('auth_date')}&hash=${params.get('hash')}`
}

export function parseTelegramData(telegramData) {
  const decoded = decodeURIComponent(telegramData);
  const params = new URLSearchParams(decoded);
  const userData = JSON.parse(params.get('user'));
  return {
    userData: userData,
    chatInstance: params.get('chat_instance'),
    chatType: params.get('chat_type'),
    authDate: params.get('auth_date'),
    hash: params.get('hash')
  };
}


export async function fetchUserProfile(userId) {
  const userState = getUserState(userId);
  const config = {
    method: 'GET',
    headers: {
      'x-authorization': userState.authToken
    }
  };

  try {
    const response = await fetch('https://testpad.xfi.foundation/api/v1/profile', config);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const profileData = await response.json();
    const evmWallet = profileData.wallets.find(wallet => wallet.isEVMWallet);
    const nonEvmWallet = profileData.wallets.find(wallet => !wallet.isEVMWallet);

    updateUserState(userId, {
      evmAddress: evmWallet ? evmWallet.address : null,
      mxAddress: nonEvmWallet ? nonEvmWallet.address : null,
      balance: profileData.balance
    });
    console.log(`User profile fetched and updated for user ID: ${userId}`);
  } catch (error) {
    console.error(`Failed to fetch user profile for user ID: ${userId}`, error);
  }
}

export async function bindReferral(userId) {
  const userState = getUserState(userId);
  const config = {
    method: 'POST',
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "origin": "https://bot.crossfi.org",
      "referer": "https://bot.crossfi.org/",
      'x-authorization': userState.authToken
    },
    body: JSON.stringify({ referralCode: String(process.env.REFERRAL_CODE) })
  };

  try {
    const response = await fetch('https://test-bot.crossfi.org/api/v1/user/referral/bind-referrer', config);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
    }
    await response.json();

    prettyLog(`[${userState.userName}] Referral bound successfully.`, 'success');
  } catch (error) {
    prettyLog(`[${userState.userName}] Failed to bind referral: ${error.message}`, 'error');
  }
}
