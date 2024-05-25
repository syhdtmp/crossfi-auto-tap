const userStates = {};

function getUserState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = {
      currentBaseDate: 10000,
      authToken: '',
      authTokenExpires: 0,
      refreshToken: '',
      refreshTokenExpires: 0,
      userName: '',
      telegramData: null,
      seedPhrase: null,
      userId: null,
      socket: null,
      energy: 0,
      energyPremium: 0,
      mpx: 0,
      xfi: 0
    };
  }
  return userStates[userId];
}

function updateUserState(userId, updates) {
  const state = getUserState(userId);
  Object.assign(state, updates);
  userStates[userId] = state;
}

function logUserState(userId) {
  const state = getUserState(userId);
  console.log(`State for user ${userId}:`, state);
}

export { getUserState, updateUserState, logUserState };

