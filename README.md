# image-mcp-server

画像のURLを受け取り、GPT-4-turboモデルを使用して画像の内容を分析するMCPサーバーです。

## 機能

- 画像URLを入力として受け取り、その画像の内容を詳細に分析
- GPT-4-turboモデルを使用した高精度な画像認識と説明
- 画像URLの有効性チェック機能

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/champierre/image-mcp-server.git
cd image-mcp-server

# 依存パッケージのインストール
npm install

# TypeScriptのコンパイル
npm run build
```

## 設定

このサーバーを使用するには、OpenAI APIキーが必要です。以下の環境変数を設定してください：

```
OPENAI_API_KEY=your_openai_api_key
```

## MCPサーバーの設定

Clineなどのツールで使用するには、MCPサーバー設定ファイルに以下の設定を追加してください：

### VSCode Claude拡張機能の場合

`cline_mcp_settings.json`に以下を追加：

```json
{
  "mcpServers": {
    "image-analysis": {
      "command": "node",
      "args": ["/path/to/image-mcp-server/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your_openai_api_key"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Claude Desktop Appの場合

`claude_desktop_config.json`に以下を追加：

```json
{
  "mcpServers": {
    "image-analysis": {
      "command": "node",
      "args": ["/path/to/image-mcp-server/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your_openai_api_key"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## 使用方法

MCPサーバーが設定されると、以下のツールが利用可能になります：

- `analyze_image`: 画像URLを受け取り、その内容を分析します

### 使用例

```
画像URLを分析してください: https://example.com/image.jpg
```

### タイムアウト設定

このサーバーには以下のタイムアウト設定が組み込まれています：

- 画像URLの検証: 30秒
- OpenAI APIリクエスト: 60秒

大きな画像や応答の遅いサーバーからの画像を処理する場合、タイムアウトエラーが発生する可能性があります。タイムアウトエラーが発生した場合は、以下の対処方法を試してください：

1. 別の画像URLを試す
2. 画像サイズが小さい画像を使用する
3. 後でもう一度試す

## 開発

```bash
# 開発モードで実行
npm run dev
```

## ライセンス

ISC
