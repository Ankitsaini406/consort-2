import { FileUploadSecurity } from './fileUploadSecurity';
import { getStandardUploadConfig } from './uploadConfig';

/**
 * Predictable Slot-Based File Upload System
 * 
 * Uses predictable slot paths for atomic file replacement.
 * Firebase automatically replaces files with identical paths - no cleanup needed!
 * 
 * Key Features:
 * - ✅ Zero cleanup operations (eliminates rate limit issues)
 * - ✅ Atomic replacement via predictable paths (same path = automatic overwrite)
 * - ✅ 15-second timeout for uploads
 * - ✅ Parallel uploads (no sequential operations)
 * - ✅ Fast UX (no blocking cleanup operations)
 * - ✅ Extension-agnostic (Firebase handles MIME type detection)
 * 
 * Slot Path Patterns (API recognizes these patterns for atomic replacement):
 * - Gallery: products/{id}/gallery/slot_{number}
 * - Resources: products/{id}/resources/{type} (single files, already working)
 * - Highlights: products/{id}/highlights/h{highlight}_v{visual}
 * - Sections: solutions/{id}/sections/section_{number}
 * - Generic: {category}/{id}/{type}/slot_{number}
 */

export interface SlotConfig {
  maxSlots: number;
  basePath: string;
  filePrefix: string;
}

export interface UploadSlot {
  slotIndex: number;
  path: string;
  url?: string;
  filename?: string;
}

export interface SlotUploadResult {
  uploadedSlots: UploadSlot[];
  errors: string[];
}

/**
 * Slot configurations for different content types
 */
export const SLOT_CONFIGS = {
  // Product gallery: up to 8 images (since we now store main+thumbnails separately)
  productGallery: {
    maxSlots: 8,
    basePath: 'portfolio',
    filePrefix: 'photo'
  },
  
  // Product resources: 3 types (datasheet, brochure, case study)
  productResources: {
    maxSlots: 3,
    basePath: 'portfolio',
    filePrefix: 'resource'
  },
  
  // Marketing highlights: up to 5 highlights with 2 visuals each
  marketingHighlights: {
    maxSlots: 10, // 5 highlights × 2 visuals
    basePath: 'portfolio',
    filePrefix: 'highlight'
  },
  
  // Solution content sections: up to 8 sections
  solutionSections: {
    maxSlots: 8,
    basePath: 'solutions',
    filePrefix: 'section'
  },
  
  // Resource content sections: up to 6 sections
  resourceSections: {
    maxSlots: 6,
    basePath: 'resources',
    filePrefix: 'section'
  },
  
  // Post content sections: up to 10 sections
  postSections: {
    maxSlots: 10,
    basePath: 'posts',
    filePrefix: 'section'
  },
  
  // Single file slots (hero images, brochures, etc.)
  singleFile: {
    maxSlots: 1,
    basePath: '',
    filePrefix: 'file'
  }
} as const;

/**
 * Sanitize path components to prevent path traversal attacks
 * Only allows alphanumeric characters, hyphens, and underscores
 */
const sanitizePathComponent = (input: string, fieldName: string): string => {
  if (!input || typeof input !== 'string') {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
    throw new Error(`${fieldName} contains invalid characters. Only letters, numbers, hyphens, and underscores allowed.`);
  }
  
  if (input.length > 100) {
    throw new Error(`${fieldName} is too long (max 100 characters)`);
  }
  
  return input;
};

/**
 * Extract file extension from filename (DEPRECATED - use getSecureExtension instead)
 * @deprecated Use FileUploadSecurity.getSecureExtension() to prevent extension injection
 */
const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot) : '';
};

/**
 * Generate custom filename for atomic replacement
 */
export const generateCustomFilename = (
  slug: string,
  fileType: string,
  file: File,
  index?: number,
  sanitizedOriginalName?: string
): string => {
  // Sanitize inputs to prevent path traversal attacks
  const safeSlug = sanitizePathComponent(slug, 'slug');
  const safeFileType = sanitizePathComponent(fileType, 'fileType');
  
  // Use secure extension from MIME type instead of trusting filename
  // This prevents extension injection attacks like "innocent.jpg<script>.svg"
  const extension = FileUploadSecurity.getSecureExtension(file.type);
  
  // If we have a sanitized original name, incorporate it for better traceability
  let baseName = `${safeSlug}_${safeFileType}`;
  if (sanitizedOriginalName) {
    // Extract base name without extension from sanitized filename
    const sanitizedBase = sanitizedOriginalName.replace(/\.[^/.]+$/, '').substring(0, 20); // Limit length
    baseName = `${safeSlug}_${safeFileType}_${sanitizedBase}`;
  }
  
  if (index !== undefined) {
    return `${baseName}_${index + 1}${extension}`;
  }
  
  return `${baseName}${extension}`;
};

/**
 * Generate slot path with custom filename
 */
export const generateSlotPath = (
  config: SlotConfig,
  documentId: string,
  filename: string,
  subPath?: string
): string => {
  // Sanitize path components to prevent path traversal attacks
  const safeDocumentId = sanitizePathComponent(documentId, 'documentId');
  const safeBasePath = config.basePath; // Config is trusted
  
  if (subPath) {
    const safeSubPath = sanitizePathComponent(subPath, 'subPath');
    return `${safeBasePath}/${safeDocumentId}/${safeSubPath}/${filename}`;
  }
  
  return `${safeBasePath}/${safeDocumentId}/${filename}`;
};

/**
 * Upload files to predefined slots with custom naming for atomic replacement
 */
export const uploadToSlots = async (
  files: (File | null)[],
  config: SlotConfig,
  documentId: string,
  slug: string,
  fileType: string,
  subPath?: string,
  startIndex: number = 0
): Promise<SlotUploadResult> => {
  const uploadedSlots: UploadSlot[] = [];
  const errors: string[] = [];
  
  // Validate input
  if (files.length > config.maxSlots) {
    throw new Error(`Too many files: ${files.length}. Maximum allowed: ${config.maxSlots}`);
  }
  
  // Create upload promises for each file
  const uploadPromises = files.map(async (file, index) => {
    if (!file) return null;
    
    // Validate file security before processing (full validation including content scans)
    let validationResult;
    try {
      validationResult = await FileUploadSecurity.validateFile(file, getStandardUploadConfig());
      
      if (!validationResult.isValid) {
        throw new Error(`File validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Store sanitized filename for use in file naming
      const sanitizedName = validationResult.sanitizedName;
      if (sanitizedName) {
        console.log(`[SLOT_UPLOAD] Using sanitized filename for slot ${startIndex + index + 1}: ${sanitizedName}`);
      }
    } catch (validationError) {
      console.error(`[SLOT_UPLOAD] File validation failed for slot ${startIndex + index + 1}:`, validationError);
      errors.push(`Slot ${startIndex + index + 1}: ${validationError instanceof Error ? validationError.message : 'File validation failed'}`);
      return null;
    }
    
    const slotIndex = startIndex + index + 1; // Make slot index 1-based to match filename
    const filename = generateCustomFilename(slug, fileType, file, index, validationResult.sanitizedName);
    const slotPath = generateSlotPath(config, documentId, filename, subPath);
    
    try {
      console.log(`[SLOT_UPLOAD] Uploading to slot ${slotIndex}: ${slotPath}`);
      const url = await uploadSingleFileWithTimeout(file, slotPath, 15000);
      
      return {
        slotIndex,
        path: slotPath,
        filename,
        url
      } as UploadSlot;
    } catch (error) {
      const errorMsg = `Failed to upload to slot ${slotIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[SLOT_UPLOAD] ${errorMsg}`);
      errors.push(errorMsg);
      return null;
    }
  });
  
  // Wait for all uploads
  const results = await Promise.all(uploadPromises);
  
  // Collect successful uploads
  results.forEach(result => {
    if (result) {
      uploadedSlots.push(result);
    }
  });
  
  console.log(`[SLOT_UPLOAD] Completed: ${uploadedSlots.length} uploaded, ${errors.length} errors`);
  
  return {
    uploadedSlots,
    errors
  };
};

/**
 * Clear all existing files in a directory before uploading new ones
 * DEPRECATED: Firebase Admin SDK on server handles cleanup automatically
 * Client-side cleanup is no longer needed with our secure API approach
 */
export const clearDirectoryFiles = async (
  directoryPath: string
): Promise<void> => {
  console.log(`[CLEANUP] Directory cleanup handled server-side: ${directoryPath}`);
  // No-op: Server-side Firebase Admin SDK handles cleanup
};

/**
 * Clear unused slots when reducing file count
 * DEPRECATED: Server-side API handles slot cleanup automatically
 */
export const clearUnusedSlots = async (
  config: SlotConfig,
  documentId: string,
  slug: string,
  fileType: string,
  usedSlotCount: number,
  subPath?: string
): Promise<void> => {
  console.log(`[SLOT_CLEANUP] Server-side cleanup for ${config.basePath}/${documentId}`);
  // No-op: Server-side Firebase Admin SDK handles slot cleanup
};

/**
 * Upload a single file via secure API with timeout
 */
const uploadSingleFileWithTimeout = async (
    file: File, 
    path: string, 
    timeoutMs: number = 15000
): Promise<string> => {
    // Validate file security before upload (full validation including content scans)
    const validationResult = await FileUploadSecurity.validateFile(file, getStandardUploadConfig());
    
    if (!validationResult.isValid) {
        throw new Error(`File validation failed: ${validationResult.errors.join(', ')}`);
    }
    
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Upload timeout after ${timeoutMs}ms for path: ${path}`));
        }, timeoutMs);

        uploadFileViaAPI(file, path)
            .then((url) => {
                clearTimeout(timeoutId);
                resolve(url);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
};

/**
 * Upload file via secure API endpoint (replaces direct Firebase Storage calls)
 */
const uploadFileViaAPI = async (file: File, path: string): Promise<string> => {
    try {
        console.log(`[API_UPLOAD] Starting secure upload to: ${path}`);
        
        // Get Firebase ID token for authentication
        const { getFirebaseAuth } = await import('@/firebase/firebaseconfig');
        const auth = getFirebaseAuth();
        if (!auth?.currentUser) {
            throw new Error("Authentication required for file upload");
        }
        
        const token = await auth.currentUser.getIdToken();
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);
        
        // Upload via secure API
        const response = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[API_UPLOAD] Error response:`, errorText);
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Upload failed');
        }
        
        console.log(`[API_UPLOAD] Success:`, result.downloadURL);
        return result.downloadURL;
        
    } catch (error) {
        console.error(`[API_UPLOAD] Upload error:`, error);
        throw error;
    }
};

/**
 * Product-specific uploader with custom naming
 */
export class ProductSlotUploader {
    /**
     * Upload gallery images using predictable slot-based paths for atomic replacement
     * Firebase automatically replaces files with identical paths - no cleanup needed
     */
    static async uploadGallery(
        files: File[], 
        productId: string, 
        productSlug: string
    ): Promise<string[]> {
        // Sanitize inputs to prevent path traversal attacks
        const safeProductId = sanitizePathComponent(productId, 'productId');
        
        console.log(`[PRODUCT_GALLERY] Starting parallel upload of ${files.length} files for product: ${safeProductId}`);
        
        // Separate optimized files into main and thumbnail arrays
        const mainFiles: File[] = [];
        const thumbnailFiles: File[] = [];
        
        files.forEach(file => {
            if (file.name.includes('-720.webp')) {
                mainFiles.push(file);
            } else if (file.name.includes('-320.webp')) {
                thumbnailFiles.push(file);
            } else {
                // Original/fallback files - treat as main
                mainFiles.push(file);
            }
        });

        console.log(`[PRODUCT_GALLERY] Separated files: ${mainFiles.length} main, ${thumbnailFiles.length} thumbnails`);

        // Upload main images to gallery/main/ directory
        const mainUploadPromises = mainFiles.map(async (file, index) => {
            const slotNumber = index + 1;
            const path = `portfolio/${safeProductId}/gallery/main/slot_${slotNumber}.webp`;
            
            console.log(`[PRODUCT_GALLERY] Uploading main to slot ${slotNumber}: ${path}`);
            
            try {
                const url = await uploadSingleFileWithTimeout(file, path, 15000);
                console.log(`[PRODUCT_GALLERY] Successfully uploaded main to slot ${slotNumber}: ${path}`);
                return url;
            } catch (error) {
                console.error(`[PRODUCT_GALLERY] Failed to upload main to slot ${slotNumber}:`, error);
                throw error;
            }
        });

        // Upload thumbnail images to gallery/thumbnails/ directory
        const thumbnailUploadPromises = thumbnailFiles.map(async (file, index) => {
            const slotNumber = index + 1;
            const path = `portfolio/${safeProductId}/gallery/thumbnails/slot_${slotNumber}.webp`;
            
            console.log(`[PRODUCT_GALLERY] Uploading thumbnail to slot ${slotNumber}: ${path}`);
            
            try {
                const url = await uploadSingleFileWithTimeout(file, path, 15000);
                console.log(`[PRODUCT_GALLERY] Successfully uploaded thumbnail to slot ${slotNumber}: ${path}`);
                return url;
            } catch (error) {
                console.error(`[PRODUCT_GALLERY] Failed to upload thumbnail to slot ${slotNumber}:`, error);
                throw error;
            }
        });

        // Execute all uploads in parallel (both main and thumbnails)
        await Promise.all([
            ...mainUploadPromises,
            ...thumbnailUploadPromises
        ]);

        // Return only main image URLs for the carousel/gallery display
        const mainUrls = await Promise.all(mainUploadPromises);
        console.log(`[PRODUCT_GALLERY] Returning ${mainUrls.length} main image URLs for gallery display`);
        return mainUrls;
    }

    /**
     * Upload resource files with custom naming: {slug}_{type}.{ext}
     * Atomic replacement for each resource type
     */
    static async uploadResources(
        datasheetFile: File | null,
        brochureFile: File | null,
        caseStudyFile: File | null,
        productId: string,
        productSlug: string
    ): Promise<{ datasheetUrl?: string; brochureUrl?: string; caseStudyUrl?: string }> {
        // Sanitize inputs to prevent path traversal attacks
        const safeProductId = sanitizePathComponent(productId, 'productId');
        const safeProductSlug = sanitizePathComponent(productSlug, 'productSlug');
        
        console.log(`[PRODUCT_RESOURCES] Starting parallel resource upload for product: ${safeProductSlug}`);
        
        // No cleanup needed - Firebase automatically replaces files with same path
        
        const uploadPromises: Promise<{ type: string; url: string }>[] = [];

        // Datasheet upload
        if (datasheetFile) {
            const secureExtension = FileUploadSecurity.getSecureExtension(datasheetFile.type);
            const customFileName = `${safeProductSlug}_datasheet${secureExtension}`;
            const path = `portfolio/${safeProductId}/resources/${customFileName}`;
            
            uploadPromises.push(
                uploadSingleFileWithTimeout(datasheetFile, path, 15000)
                    .then(url => ({ type: 'datasheet', url }))
            );
        }

        // Brochure upload
        if (brochureFile) {
            const secureExtension = FileUploadSecurity.getSecureExtension(brochureFile.type);
            const customFileName = `${safeProductSlug}_brochure${secureExtension}`;
            const path = `portfolio/${safeProductId}/resources/${customFileName}`;
            
            uploadPromises.push(
                uploadSingleFileWithTimeout(brochureFile, path, 15000)
                    .then(url => ({ type: 'brochure', url }))
            );
        }

        // Case study upload
        if (caseStudyFile) {
            const secureExtension = FileUploadSecurity.getSecureExtension(caseStudyFile.type);
            const customFileName = `${safeProductSlug}_casestudy${secureExtension}`;
            const path = `portfolio/${safeProductId}/resources/${customFileName}`;
            
            uploadPromises.push(
                uploadSingleFileWithTimeout(caseStudyFile, path, 15000)
                    .then(url => ({ type: 'casestudy', url }))
            );
        }

        // Execute all uploads in parallel
        const results = await Promise.all(uploadPromises);
        
        // Convert results to expected format
        const resourceUrls: { datasheetUrl?: string; brochureUrl?: string; caseStudyUrl?: string } = {};
        results.forEach(result => {
            if (result.type === 'datasheet') resourceUrls.datasheetUrl = result.url;
            if (result.type === 'brochure') resourceUrls.brochureUrl = result.url;
            if (result.type === 'casestudy') resourceUrls.caseStudyUrl = result.url;
        });

        console.log(`[PRODUCT_RESOURCES] Completed parallel resource upload:`, resourceUrls);
        return resourceUrls;
    }

    /**
     * Upload marketing highlight visuals using predictable slot-based paths
     * Firebase automatically replaces files with identical paths - no cleanup needed
     */
    static async uploadHighlightVisuals(
        highlights: Array<{ visuals: File | File[] }>,
        productId: string,
        productSlug: string
    ): Promise<Array<{ visuals: string[] }>> {
        // Sanitize inputs to prevent path traversal attacks
        const safeProductId = sanitizePathComponent(productId, 'productId');
        
        console.log(`[PRODUCT_HIGHLIGHTS] Starting parallel highlight upload for product: ${safeProductId}`);
        
        const uploadPromises: Promise<{ highlightIndex: number; urls: string[] }>[] = [];

        highlights.forEach((highlight, highlightIndex) => {
            const visualsArray = Array.isArray(highlight.visuals) ? highlight.visuals : [highlight.visuals];
            
            const highlightUploadPromises = visualsArray.map(async (file, visualIndex) => {
                // Use predictable slot-based path - API recognizes slot patterns for atomic replacement
                const highlightNumber = highlightIndex + 1;
                const visualNumber = visualIndex + 1;
                const path = `portfolio/${safeProductId}/highlights/h${highlightNumber}_v${visualNumber}.webp`;
                
                console.log(`[PRODUCT_HIGHLIGHTS] Uploading highlight ${highlightNumber}, visual ${visualNumber}: ${path}`);
                
                try {
                    // Firebase determines extension from content-type automatically
                    const url = await uploadSingleFileWithTimeout(file, path, 15000);
                    console.log(`[PRODUCT_HIGHLIGHTS] Successfully uploaded highlight ${highlightNumber}, visual ${visualNumber}: ${path}`);
                    return url;
                } catch (error) {
                    console.error(`[PRODUCT_HIGHLIGHTS] Failed to upload highlight ${highlightNumber}, visual ${visualNumber}:`, error);
                    throw error;
                }
            });

            uploadPromises.push(
                Promise.all(highlightUploadPromises).then(urls => ({
                    highlightIndex,
                    urls
                }))
            );
        });

        // Execute all highlight uploads in parallel
        const results = await Promise.all(uploadPromises);
        
        // Convert results to expected format
        return results
            .sort((a, b) => a.highlightIndex - b.highlightIndex)
            .map(result => ({ visuals: result.urls }));
    }
}

/**
 * Solution-specific uploader with custom naming
 */
export class SolutionSlotUploader {
    /**
     * Upload hero image with custom naming: {slug}_hero.{ext}
     */
    static async uploadHeroImage(file: File, solutionId: string, solutionSlug: string): Promise<string> {
        // Sanitize inputs to prevent path traversal attacks
        const safeSolutionId = sanitizePathComponent(solutionId, 'solutionId');
        const safeSolutionSlug = sanitizePathComponent(solutionSlug, 'solutionSlug');
        
        const secureExtension = FileUploadSecurity.getSecureExtension(file.type);
        const customFileName = `${safeSolutionSlug}_hero${secureExtension}`;
        const path = `solutions/${safeSolutionId}/hero/${customFileName}`;
        
        console.log(`[SOLUTION_HERO] Uploading: ${path}`);
        return uploadSingleFileWithTimeout(file, path, 15000);
    }

    /**
     * Upload brochure with custom naming: {slug}_brochure.{ext}
     */
    static async uploadBrochure(file: File, solutionId: string, solutionSlug: string): Promise<string> {
        // Sanitize inputs to prevent path traversal attacks
        const safeSolutionId = sanitizePathComponent(solutionId, 'solutionId');
        const safeSolutionSlug = sanitizePathComponent(solutionSlug, 'solutionSlug');
        
        const secureExtension = FileUploadSecurity.getSecureExtension(file.type);
        const customFileName = `${safeSolutionSlug}_brochure${secureExtension}`;
        const path = `solutions/${safeSolutionId}/brochure/${customFileName}`;
        
        console.log(`[SOLUTION_BROCHURE] Uploading: ${path}`);
        return uploadSingleFileWithTimeout(file, path, 15000);
    }

    /**
     * Upload section images using predictable slot-based paths
     * Firebase automatically replaces files with identical paths - no cleanup needed
     */
    static async uploadSectionImages(files: File[], solutionId: string, solutionSlug: string): Promise<string[]> {
        // Sanitize inputs to prevent path traversal attacks
        const safeSolutionId = sanitizePathComponent(solutionId, 'solutionId');
        
        console.log(`[SOLUTION_SECTIONS] Starting parallel upload of ${files.length} section images`);
        
        const uploadPromises = files.map(async (file, index) => {
            // Use predictable slot-based path - API recognizes slot patterns for atomic replacement
            const sectionNumber = index + 1;
            const path = `solutions/${safeSolutionId}/sections/section_${sectionNumber}`;
            
            console.log(`[SOLUTION_SECTIONS] Uploading to section slot ${sectionNumber}: ${path}`);
            // Firebase determines extension from content-type automatically
            return uploadSingleFileWithTimeout(file, path, 15000);
        });

        return Promise.all(uploadPromises);
    }
}

/**
 * Generic uploader for resources and posts with custom naming
 */
export class GenericSlotUploader {
    /**
     * Upload single file with custom naming
     */
    static async uploadSingleFile(
        file: File,
        category: string,
        itemId: string,
        fileType: string,
        itemSlug?: string
    ): Promise<string> {
        // Sanitize inputs to prevent path traversal attacks
        const safeCategory = sanitizePathComponent(category, 'category');
        const safeItemId = sanitizePathComponent(itemId, 'itemId');
        const safeFileType = sanitizePathComponent(fileType, 'fileType');
        const slug = itemSlug ? sanitizePathComponent(itemSlug, 'itemSlug') : safeItemId;
        
        const secureExtension = FileUploadSecurity.getSecureExtension(file.type);
        const customFileName = `${slug}_${safeFileType}${secureExtension}`;
        const path = `${safeCategory}/${safeItemId}/${safeFileType}/${customFileName}`;
        
        console.log(`[GENERIC_UPLOAD] Uploading ${fileType}: ${path}`);
        return uploadSingleFileWithTimeout(file, path, 15000);
    }

    /**
     * Upload multiple files using predictable slot-based paths
     * Firebase automatically replaces files with identical paths - no cleanup needed
     */
    static async uploadMultipleFiles(
        files: File[],
        category: string,
        itemId: string,
        fileType: string,
        itemSlug?: string
    ): Promise<string[]> {
        // Sanitize inputs to prevent path traversal attacks
        const safeCategory = sanitizePathComponent(category, 'category');
        const safeItemId = sanitizePathComponent(itemId, 'itemId');
        const safeFileType = sanitizePathComponent(fileType, 'fileType');
        
        console.log(`[GENERIC_UPLOAD] Starting parallel upload of ${files.length} ${safeFileType} files`);
        
        const uploadPromises = files.map(async (file, index) => {
            // Use predictable slot-based path - API recognizes slot patterns for atomic replacement
            const slotNumber = index + 1;
            const path = `${safeCategory}/${safeItemId}/${safeFileType}/slot_${slotNumber}`;
            
            console.log(`[GENERIC_UPLOAD] Uploading ${fileType} to slot ${slotNumber}: ${path}`);
            // Firebase determines extension from content-type automatically
            return uploadSingleFileWithTimeout(file, path, 15000);
        });

        return Promise.all(uploadPromises);
    }
}