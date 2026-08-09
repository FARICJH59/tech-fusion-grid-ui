import type { ShelfObservation } from "@/lib/shelf-scouter/types";

const DEMO_OBSERVATION: ShelfObservation = {
  productName: "Coca-Cola",
  brand: "Coca-Cola",
  category: "Soft Drinks",
  confidence: 0.61,
};

function extractJson(text: string): ShelfObservation | undefined {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  try {
    const value = JSON.parse(match[0]) as Partial<ShelfObservation>;
    if (typeof value.productName !== "string") return undefined;
    return {
      productName: value.productName,
      brand: typeof value.brand === "string" ? value.brand : undefined,
      barcode: typeof value.barcode === "string" ? value.barcode : undefined,
      category: typeof value.category === "string" ? value.category : undefined,
      confidence: Math.max(0, Math.min(1, Number(value.confidence ?? 0.5))),
    };
  } catch {
    return undefined;
  }
}

export async function analyzeShelfImage(image: Buffer, mimeType: string): Promise<{
  observation: ShelfObservation;
  mode: "vision" | "demo";
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { observation: DEMO_OBSERVATION, mode: "demo" };

  const model = process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = [
    "Identify the primary retail product visible in this shelf photo.",
    "Return JSON only with: productName, brand, barcode, category, confidence.",
    "Do not invent a barcode. confidence must be between 0 and 1.",
  ].join(" ");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: image.toString("base64") } },
        ],
      }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    throw new Error(`VISION_PROVIDER_${response.status}`);
  }

  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join(" ") ?? "";
  const observation = extractJson(text);
  if (!observation) throw new Error("VISION_INVALID_RESULT");
  return { observation, mode: "vision" };
}
