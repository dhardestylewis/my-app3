// src/lib/server/imageValidation.ts
import path from "path";
import fs from "fs";
import { DEFAULT_CARD_IMAGE_PATH } from "../../data/deckData";

/**
 * [SERVER-SIDE ONLY] Validates if a given image path corresponds to an existing file
 * in the `/public` directory. Returns the original path if valid, otherwise returns
 * the `DEFAULT_CARD_IMAGE_PATH`.
 *
 * @param imagePath The potential image path (relative to /public, e.g., /cards/image.png)
 * @returns A promise resolving to the validated image path (original or default fallback).
 */
export const getValidatedImagePath = async (imagePath: string | undefined | null): Promise<string> => {
  if (!imagePath) {
      return DEFAULT_CARD_IMAGE_PATH;
  }

  try {
      // Construct the full path relative to the project root
      const fullPath = path.join(process.cwd(), 'public', imagePath);
      // Check if the file exists and is accessible
      await fs.promises.access(fullPath, fs.constants.F_OK);
      // If successful, the file exists, return the original path
      return imagePath;
  } catch (error) {
      // If fs.promises.access throws an error, the file doesn't exist or isn't accessible
      console.warn(`[Server Validation] Image path invalid or file missing: ${imagePath}. Using fallback.`);
      return DEFAULT_CARD_IMAGE_PATH;
  }
};