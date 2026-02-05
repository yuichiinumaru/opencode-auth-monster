import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const createMonsterModule = require(path.resolve(__dirname, "../../src/index.js"));
const { ConfigManager } = require(path.resolve(__dirname, "../../src/core/config.js"));

export const AuthMonsterPlugin = async () => {
  const configManager = new ConfigManager();
  const config = configManager.loadConfig();
  const storagePath = configManager.getConfigDir();

  const createMonster = createMonsterModule?.default ?? createMonsterModule;
  const monster = createMonster({ config, storagePath });
  await monster.init();

  return {
    "chat.headers": async (input, output) => {
      const modelId = input.model?.modelID ?? input.model?.providerID ?? input.provider?.info?.id;
      const auth = await monster.getAuthDetails(modelId);
      if (!auth?.headers) {
        return;
      }
      output.headers = { ...output.headers, ...auth.headers };
    },
  };
};

export default AuthMonsterPlugin;
