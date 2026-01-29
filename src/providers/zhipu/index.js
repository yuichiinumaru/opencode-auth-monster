"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZhipuProvider = void 0;
const types_1 = require("../../core/types");
class ZhipuProvider {
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
        // Simple prompt simulation, in real CLI this would be passed
        const { Password } = require('enquirer');
        const prompt = new Password({
            name: 'apiKey',
            message: 'Enter your Zhipu AI API Key'
        });
        const apiKey = await prompt.run();
        return { apiKey };
    }
}
exports.ZhipuProvider = ZhipuProvider;
ZhipuProvider.provider = types_1.AuthProvider.Zhipu;
