#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { OpenAI } from 'openai';
import axios from 'axios';
import * as dotenv from 'dotenv';
// .envファイルから環境変数を読み込む
dotenv.config();
// OpenAI APIキーを環境変数から取得
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
}
// OpenAIクライアントの初期化
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    timeout: 60000, // 60秒のタイムアウト設定
    maxRetries: 3, // リトライ回数
});

// axiosのデフォルト設定
axios.defaults.timeout = 10000; // 10秒のタイムアウト設定
// 画像URLの引数の型チェック
const isValidAnalyzeImageArgs = (args) => typeof args === 'object' &&
    args !== null &&
    typeof args.imageUrl === 'string';
class ImageAnalysisServer {
    constructor() {
        this.server = new Server({
            name: 'image-analysis-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        // エラーハンドリング
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
        // ツール一覧の定義
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'analyze_image',
                    description: '画像URLを受け取り、GPT-4-turboを使用して画像の内容を分析します',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            imageUrl: {
                                type: 'string',
                                description: '分析する画像のURL',
                            },
                        },
                        required: ['imageUrl'],
                    },
                },
            ],
        }));
        // ツール実行ハンドラ
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name !== 'analyze_image') {
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
            if (!isValidAnalyzeImageArgs(request.params.arguments)) {
                throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments: imageUrl is required and must be a string');
            }
            const imageUrl = request.params.arguments.imageUrl;
            try {
                // 画像URLが有効かチェック
                await this.validateImageUrl(imageUrl);
                // GPT-4-turboで画像を分析
                const analysis = await this.analyzeImageWithGpt4(imageUrl);
                return {
                    content: [
                        {
                            type: 'text',
                            text: analysis,
                        },
                    ],
                };
            }
            catch (error) {
                console.error('Error analyzing image:', error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `画像分析エラー: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
    // 画像URLが有効かチェックするメソッド
    async validateImageUrl(url) {
        try {
            // タイムアウト設定を追加（10秒）
            const response = await axios.head(url, { timeout: 10000 });
            const contentType = response.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                throw new Error(`URLが画像ではありません: ${contentType}`);
            }
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('画像URLへのリクエストがタイムアウトしました。別の画像URLを試してください。');
                }
                throw new Error(`画像URLにアクセスできません: ${error.message}`);
            }
            throw error;
        }
    }
    // GPT-4-turboで画像を分析するメソッド
    async analyzeImageWithGpt4(imageUrl) {
        try {
            // 画像URLが有効かどうか事前に確認（タイムアウト設定済み）
            await this.validateImageUrl(imageUrl);
            
            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo',
                messages: [
                    {
                        role: 'system',
                        content: '画像の内容を詳細に分析し、日本語で説明してください。',
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: '以下の画像を分析して、内容を詳しく説明してください。' },
                            { type: 'image_url', image_url: { url: imageUrl } },
                        ],
                    },
                ],
                max_tokens: 1000,
            });
            return response.choices[0]?.message?.content || '分析結果を取得できませんでした。';
        }
        catch (error) {
            console.error('OpenAI API error:', error);
            throw new Error(`OpenAI APIエラー: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Image Analysis MCP server running on stdio');
    }
}
const server = new ImageAnalysisServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map
