export type TranslateRequest = {
  text: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  terminologyNames?: string[];
};

export type TranslateResourceReference = {
  provider: "aws";
  service: "translate";
  operation: "TranslateText";
  region: string;
};

/**
 * Provider-neutral contract for Amazon Translate.
 *
 * The contract intentionally contains no AWS credentials and performs no
 * network mutation. A concrete AWS SDK adapter can implement it after the
 * staging identity and IAM gates pass.
 */
export interface AwsTranslateAdapter {
  translate(request: TranslateRequest): Promise<string>;
}

export function createTranslateReference(region: string): TranslateResourceReference {
  if (!region.trim()) throw new Error("AWS region is required");

  return {
    provider: "aws",
    service: "translate",
    operation: "TranslateText",
    region: region.trim(),
  };
}
