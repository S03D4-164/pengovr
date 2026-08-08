import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';

const ai = new GoogleGenAI({ apiKey });
const quota = 250000;
const limit = quota * 2;

let contents = `
必ず日本語で回答してください。
あなたは優秀なプログラマーであり、コードの説明を行います。
コードの内容は回答に出力せず、必要な場合にのみ引用してください。
`;

contents += `
以下のHTTPレスポンスボディの内容について、簡潔に説明してください。
`;

async function geminiExplain(code: string): Promise<string | null> {
  // Limit content to first 50000 characters to avoid token limit
  const limitedCode =
    code.length > limit
      ? code.substring(0, limit) + '\n... (content truncated)'
      : code;

  const req = {
    model,
    contents: contents + limitedCode,
  };

  const countTokensResponse = await ai.models.countTokens(req);
  console.log('Gemini token count:', countTokensResponse.totalTokens);

  if (
    countTokensResponse?.totalTokens &&
    countTokensResponse.totalTokens > quota
  ) {
    const errorMessage = `Error: Content too long (${countTokensResponse.totalTokens} tokens exceeds limit of ${quota})`;
    console.error(errorMessage);
    return errorMessage;
  }

  const result = await ai.models.generateContent(req);
  const explanation = result.text;
  console.log(
    'Gemini explanation generated:',
    explanation?.substring(0, 100) + '...',
  );
  return explanation || null;
}

export default geminiExplain;
