/**
 * The image data a MealAnalyzer needs, deliberately narrower than an
 * Express file upload - the analyzer layer must not know about HTTP,
 * multer, or the Request object.
 */
export interface MealAnalysisInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}
