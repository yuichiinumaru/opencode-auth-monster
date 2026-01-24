"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const types_1 = require("../core/types");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
async function test() {
    const testStorage = path_1.default.join(__dirname, '../../test-storage');
    if (fs_1.default.existsSync(testStorage)) {
        fs_1.default.rmSync(testStorage, { recursive: true });
    }
    const monster = new index_1.AuthMonster({
        config: {
            active: types_1.AuthProvider.Gemini,
            fallback: [],
            method: 'sticky',
            modelPriorities: {},
            fallbackDirection: 'down',
            providers: {}
        },
        storagePath: testStorage
    });
    await monster.init();
    console.log('Initialized AuthMonster');
    const testAccount = {
        id: 'test-gemini',
        email: 'test@example.com',
        provider: types_1.AuthProvider.Gemini,
        tokens: { accessToken: 'fake-token' },
        apiKey: 'fake-api-key',
        isHealthy: true
    };
    await monster.addAccount(testAccount);
    console.log('Added test account');
    const auth = await monster.getAuthDetails();
    if (auth && auth.headers['x-goog-api-key'] === 'fake-api-key') {
        console.log('SUCCESS: Gemini auth details retrieved correctly');
    }
    else {
        console.log('FAILURE: Could not retrieve Gemini auth details', auth);
        process.exit(1);
    }
}
test().catch(err => {
    console.error(err);
    process.exit(1);
});
