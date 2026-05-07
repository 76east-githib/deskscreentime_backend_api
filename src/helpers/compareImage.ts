// 'use server'

import fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export const compareImages = (imagePathArr: string[]) => {  
  try {
    if (!fs.existsSync(imagePathArr[0]) || !fs.existsSync(imagePathArr[1])) {
      console.error("Comparison failed: One or both files do not exist", imagePathArr);
      return { diffPixels: -1, width: 0, height: 0 };
    }

    const img1 = PNG.sync.read(fs.readFileSync(imagePathArr[0]));
    const img2 = PNG.sync.read(fs.readFileSync(imagePathArr[1]));  
    
    const { width, height } = img1;
    
    // If dimensions don't match, pixelmatch will throw. We should handle it.
    if (img1.width !== img2.width || img1.height !== img2.height) {
      console.warn(`Dimension mismatch: img1(${img1.width}x${img1.height}), img2(${img2.width}x${img2.height})`);
      return { diffPixels: -1, width: width, height: height };
    }

    const numDifferentPixels = pixelmatch(img1.data, img2.data, null, width, height, { threshold: 0.1 });
    
    return {
      diffPixels: numDifferentPixels,
      width: width,
      height: height
    };
  } catch (error) {
    console.error("Error in compareImages:", error);
    return { diffPixels: -1, width: 0, height: 0 };
  }
}