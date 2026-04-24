class GameState {
  constructor() {
    this.currentRaceConfig = null;
    this.currentTiktokConnection = null;
  }

  setRaceConfig(config) {
    this.currentRaceConfig = config;
  }

  getRaceConfig() {
    return this.currentRaceConfig;
  }

  setTiktokConnection(connection) {
    this.currentTiktokConnection = connection;
  }

  getTiktokConnection() {
    return this.currentTiktokConnection;
  }
}

module.exports = new GameState();
