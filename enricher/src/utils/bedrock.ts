import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
} from '@aws-sdk/client-bedrock-runtime';

// Bedrockクライアントの初期化 (AWS認証情報は環境変数から自動読み込み)
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// Bedrockで利用するモデルID
const MODEL_ID = process.env.BEDROCK_MODEL || 'us.amazon.nova-2-lite-v1:0';

const quota = 250000;
const limit = quota * 2;

const systemPrompt = `
必ず日本語で回答してください。
あなたは優秀なプログラマーであり、コードの説明を行います。
コードの内容は回答に出力せず、必要な場合にのみ引用してください。
`;

const instruction = `
以下のHTTPレスポンスボディの内容について、簡潔に説明してください。
`;

/**
 * 簡易的なトークン数見積もり (Claudeの場合: 英語/コードは約3.5〜4文字で1トークン、日本語は約1文字で1トークン)
 * 厳密に計算したい場合は @anthropic-ai/tokenizer などを使用します
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

async function bedrockExplain(code: string): Promise<string | null> {
  // 文字数制限
  const limitedCode =
    code.length > limit
      ? code.substring(0, limit) + '\n... (content truncated)'
      : code;
  const userContent = instruction + limitedCode;

  // 1. 事前トークン制限チェック (概算)
  const estimatedTokenCount = estimateTokens(systemPrompt + userContent);
  console.log('Bedrock estimated token count:', estimatedTokenCount);

  if (estimatedTokenCount > quota) {
    const errorMessage = `Error: Content too long (${estimatedTokenCount} tokens exceeds limit of ${quota})`;
    console.error(errorMessage);
    return errorMessage;
  }

  // 2. Bedrock Converse API のリクエスト構築
  const input: ConverseCommandInput = {
    modelId: MODEL_ID,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: 'user',
        content: [{ text: userContent }],
      },
    ],
    inferenceConfig: {
      maxTokens: 2000,
      temperature: 0.3,
    },
  };

  try {
    const command = new ConverseCommand(input);
    const response = await client.send(command);

    // Bedrockのレスポンスから実際のトークン数を確認可能
    if (response.usage) {
      console.log('Actual input tokens:', response.usage.inputTokens);
      console.log('Actual output tokens:', response.usage.outputTokens);
    }

    // レスポンス文字列の取得
    const explanation = response.output?.message?.content?.[0]?.text || null;
    console.log(
      'Bedrock explanation generated:',
      explanation?.substring(0, 100) + '...',
    );

    return explanation;
  } catch (error) {
    console.error('AWS Bedrock API Error:', error);
    throw error;
  }
}

export default bedrockExplain;
