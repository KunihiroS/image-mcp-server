#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
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
  timeout: 120000, // 120秒のグローバルタイムアウト設定
});

// 画像URLの引数の型チェック
const isValidAnalyzeImageArgs = (
  args: any
): args is { imageUrl: string } =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.imageUrl === 'string';

class ImageAnalysisServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'image-analysis-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // エラーハンドリング
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
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
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      if (!isValidAnalyzeImageArgs(request.params.arguments)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid arguments: imageUrl is required and must be a string'
        );
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
      } catch (error) {
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
  private async validateImageUrl(url: string): Promise<void> {
    // リトライ回数と待機時間の設定
    const maxRetries = 3;
    const retryDelay = 2000; // 2秒
    
    // URLからドメインを抽出
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // ドメインに基づいてタイムアウト設定を調整
    let timeout = 60000; // デフォルト: 60秒
    if (domain.includes('gyazo.com')) {
      timeout = 120000; // gyazo.com: 120秒
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.error(`画像URL検証: 試行 ${attempt}/${maxRetries} - ${url}`);
        
        // GETリクエストを使用して画像を取得
        const response = await axios.get(url, {
          timeout: timeout,
          responseType: 'arraybuffer', // バイナリデータとして取得
          maxContentLength: 10 * 1024 * 1024, // 10MBの最大サイズ制限
          headers: {
            // 一般的なブラウザのユーザーエージェントを設定
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            // 参照元を設定
            'Referer': 'https://www.google.com/'
          }
        });
        
        const contentType = response.headers['content-type'];
        
        if (!contentType || !contentType.startsWith('image/')) {
          throw new Error(`URLが画像ではありません: ${contentType}`);
        }
        
        // 成功した場合はループを抜ける
        return;
      } catch (error) {
        // 最後の試行でエラーが発生した場合はエラーをスロー
        if (attempt === maxRetries) {
          if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
              throw new Error(`画像URLへのリクエストがタイムアウトしました（${timeout/1000}秒）。別の画像URLを試すか、後でもう一度お試しください。`);
            }
            if (error.response) {
              throw new Error(`画像URLにアクセスできません: HTTPステータス ${error.response.status}`);
            }
            throw new Error(`画像URLにアクセスできません: ${error.message}`);
          }
          throw error;
        }
        
        // リトライ前に待機
        console.error(`画像URL検証エラー（リトライ中）: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // GPT-4-turboで画像を分析するメソッド
  private async analyzeImageWithGpt4(imageUrl: string): Promise<string> {
    try {
      // OpenAI APIリクエスト
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
    } catch (error) {
      console.error('OpenAI API error:', error);
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error('OpenAI APIリクエストがタイムアウトしました。後でもう一度お試しください。');
      }
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
