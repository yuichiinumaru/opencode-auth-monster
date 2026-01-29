"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinimaxProvider = void 0;
const types_1 = require("../../core/types");
class MinimaxProvider {
    static getHeaders(account) {
        const headers = {
            'content-type': 'application/json',
        };
        if (account.apiKey) {
            headers['Authorization'] = `Bearer ${account.apiKey}`;
        }
        return headers;
    }
    static async login() {
        const { Password } = require('enquirer');
        const prompt = new Password({
            name: 'apiKey',
            message: 'Enter your MiniMax API Key'
        });
        const apiKey = await prompt.run();
        return { apiKey };
    }
}
exports.MinimaxProvider = MinimaxProvider;
MinimaxProvider.provider = types_1.AuthProvider.Minimax;
