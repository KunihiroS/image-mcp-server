# image-mcp-server

画像URLを受け取り、OpenAI GPT-4-turboを使用して画像の内容を分析するMCPサーバー。

## 機能

- 画像URLの有効性チェック
- GPT-4-turboを使用した画像分析
- タイムアウト処理の実装（画像URLアクセス：10秒、OpenAI API：60秒）

## 使用方法

1. `.env`ファイルにOpenAI APIキーを設定
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

2. MCPサーバーを起動
   ```
   node dist/index.js
   ```

3. MCPクライアントから`analyze_image`ツールを使用して画像を分析
   ```json
   {
     "imageUrl": "https://example.com/image.jpg"
   }
   ```

## エラー処理

- 画像URLが無効な場合：エラーメッセージを返す
- 画像URLへのアクセスがタイムアウトした場合：タイムアウトエラーメッセージを返す
- OpenAI APIの呼び出しがエラーになった場合：エラーメッセージを返す
