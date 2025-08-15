/**
 * ExportService - Handles comment export functionality
 * Uses fflate for reliable ZIP generation and iframe isolation for zero screen flashing
 */
class ExportService {
    constructor() {
        this.isExporting = false;
        this.cancelled = false;
        this.exportProgress = {
            current: 0,
            total: 0,
            status: 'Ready'
        };
        this.maxCommentsPerZip = 500; // Much larger with fflate
        
        // Create iframe-based rendering to completely eliminate screen flashing
        this.createIframeRenderer();
        
        // Load fflate library
        this.initializeZipLibrary();
        
        // Canvas-based compositing - no need for blob preloading
    }

    // Removed loadBlankPngBlob() - now using canvas-based approach

    /**
     * Initialize fflate ZIP library
     */
    async initializeZipLibrary() {
        try {
            // Import fflate dynamically
            const fflate = await import('fflate');
            this.fflate = fflate;
            console.log('✅ fflate ZIP library loaded - large batch sizes available');
        } catch (error) {
            console.error('❌ Failed to load fflate library:', error);
            throw new Error('ZIP library unavailable - cannot export');
        }
    }

    /**
     * Create iframe-based renderer for ZERO screen interference
     */
    createIframeRenderer() {
        // Remove any existing iframe
        const existing = document.getElementById('export-iframe');
        if (existing) {
            existing.remove();
        }

        // Create completely isolated iframe
        this.iframe = document.createElement('iframe');
        this.iframe.id = 'export-iframe';
        this.iframe.style.cssText = `
            position: absolute;
            left: -9999px;
            top: -9999px;
            width: 800px;
            height: 600px;
            border: none;
            visibility: hidden;
            pointer-events: none;
            z-index: -9999;
        `;
        
        document.body.appendChild(this.iframe);
        
        // Initialize iframe document
        const doc = this.iframe.contentDocument;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.3/font/bootstrap-icons.css">
                <style>
                    body { margin: 0; padding: 20px; background: white; font-family: 'Roboto', Arial, sans-serif; }
                </style>
            </head>
            <body></body>
            </html>
        `);
        doc.close();
        
        console.log('🖼️ Created iframe-based renderer - ZERO screen interference guaranteed');
    }

    /**
     * Export a single comment as PNG (comment only format)
     */
    async exportSingleComment(comment, videoTitle = '') {
        try {
            const html = this.generateCommentHTML(comment, videoTitle);
            const filename = this.generateFileName(videoTitle, comment.author, comment.text);
            
            await this.generatePNG(html, filename);
            console.log(`✅ Exported comment: ${filename}`);
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            throw error;
        }
    }

    /**
     * Export a single comment with thumbnail as PNG (thumbnail + comment format)
     */
    async exportSingleCommentWithThumbnail(comment, videoTitle = '', videoThumbnail = '') {
        try {
            const blob = await this.generateYouTubeComposite(comment, videoTitle, videoThumbnail);
            const filename = this.generateFileName(videoTitle, comment.author, comment.text, true);
            
            this.downloadBlob(blob, `${filename}.png`);
            console.log(`✅ Exported comment with thumbnail: ${filename}`);
            
        } catch (error) {
            console.error('❌ Export with thumbnail failed:', error);
            throw error;
        }
    }

    /**
     * Export comments for a specific video using fflate
     */
    async exportVideoComments(videoId, dataManager, progressCallback, format = 'comment') {
        if (this.isExporting) {
            throw new Error('Export already in progress');
        }

        this.isExporting = true;
        this.cancelled = false;
        
        try {
            // Get video info and comments
            const video = await dataManager.getVideo(videoId);
            if (!video) {
                throw new Error('Video not found');
            }

            const commentsData = await dataManager.getAllComments(videoId, {});
            const comments = this.flattenComments(commentsData);

            if (comments.length === 0) {
                throw new Error('No comments found for this video');
            }

            // Initialize progress
            this.exportProgress = {
                current: 0,
                total: comments.length,
                status: 'Starting export...'
            };

            progressCallback?.(this.exportProgress);

            // Use fflate for reliable ZIP generation
            const zipFiles = await this.generateFflateZIPs(
                comments, 
                video.title, 
                this.maxCommentsPerZip,
                (progress) => {
                    this.exportProgress.current = progress.completed || 0;
                    this.exportProgress.status = progress.status;
                    progressCallback?.(this.exportProgress);
                },
                format,
                video
            );

            this.exportProgress.current = this.exportProgress.total;
            this.exportProgress.status = `✅ Export complete! Downloaded ${zipFiles.length} ZIP file(s)`;
            progressCallback?.(this.exportProgress);

            return zipFiles;

        } finally {
            this.isExporting = false;
            this.cancelled = false;
        }
    }

    /**
     * Export comments for all videos using fflate
     */
    async exportAllVideos(dataManager, progressCallback, format = 'comment') {
        if (this.isExporting) {
            throw new Error('Export already in progress');
        }

        this.isExporting = true;
        this.cancelled = false;
        
        try {
            // Get all videos
            const allVideosResult = await dataManager.getVideos({}, { page: 1, limit: 10000 });
            const videos = allVideosResult.videos;

            if (videos.length === 0) {
                throw new Error('No videos found');
            }

            // Initialize progress for all videos
            this.exportProgress = {
                currentVideo: 0,
                totalVideos: videos.length,
                currentVideoComments: 0,
                totalVideoComments: 0,
                status: 'Starting export...'
            };

            progressCallback?.(this.exportProgress);

            const zipFiles = [];

            for (let videoIndex = 0; videoIndex < videos.length; videoIndex++) {
                // Check for cancellation
                if (this.cancelled) {
                    throw new Error('Export cancelled by user');
                }
                
                const video = videos[videoIndex];
                
                // Update progress for current video
                this.exportProgress.currentVideo = videoIndex + 1;
                this.exportProgress.currentVideoComments = 0;
                this.exportProgress.status = `Processing video ${videoIndex + 1}/${videos.length}: ${video.title}`;
                progressCallback?.(this.exportProgress);

                try {
                    // Get all comments for this video
                    const commentsData = await dataManager.getAllComments(video.video_id, {});
                    const comments = this.flattenComments(commentsData);

                    if (comments.length === 0) {
                        console.log(`⚠️ Skipping video "${video.title}" - no comments`);
                        continue;
                    }

                    this.exportProgress.totalVideoComments = comments.length;
                    
                    // Use fflate for reliable ZIP generation
                    const videoZipFiles = await this.generateFflateZIPs(
                        comments, 
                        video.title, 
                        this.maxCommentsPerZip,
                        (batchProgress) => {
                            this.exportProgress.currentVideoComments = batchProgress.completed || 0;
                            this.exportProgress.status = `Video ${videoIndex + 1}/${videos.length}: ${batchProgress.status}`;
                            progressCallback?.(this.exportProgress);
                        },
                        format,
                        video
                    );

                    zipFiles.push(...videoZipFiles);
                    console.log(`✅ Successfully exported ${comments.length} comments from "${video.title}" in ${videoZipFiles.length} ZIP file(s)`);

                } catch (error) {
                    console.error(`❌ Failed to export video "${video.title}":`, error);
                }

                // Small delay between videos
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.exportProgress.status = `✅ Export complete! Downloaded ${zipFiles.length} video archive(s)`;
            progressCallback?.(this.exportProgress);

            return zipFiles;

        } finally {
            this.isExporting = false;
            this.cancelled = false;
        }
    }

    /**
     * Generate ZIP files using fflate - MUCH more reliable than JSZip
     */
    async generateFflateZIPs(comments, videoTitle, batchSize = 500, progressCallback, format = 'comment', video = null) {
        const zipFiles = [];
        const totalBatches = Math.ceil(comments.length / batchSize);
        
        console.log(`🚀 Generating ${totalBatches} fflate ZIP batches of ${batchSize} comments each`);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            // Check for cancellation
            if (this.cancelled) {
                throw new Error('Export cancelled by user');
            }
            
            const startIndex = batchIndex * batchSize;
            const endIndex = Math.min(startIndex + batchSize, comments.length);
            const batchComments = comments.slice(startIndex, endIndex);
            
            const zipSuffix = totalBatches > 1 ? `_part${batchIndex + 1}` : '';
            const zipName = `${this.sanitizeFilename(videoTitle)}${zipSuffix}_comments.zip`;
            
            console.log(`⚡ Processing fflate batch ${batchIndex + 1}/${totalBatches}: ${batchComments.length} comments`);
            
            try {
                // Step 1: Generate all images for this batch
                const imageFiles = {};
                
                for (let i = 0; i < batchComments.length; i++) {
                    // Check for cancellation in comment processing loop
                    if (this.cancelled) {
                        throw new Error('Export cancelled by user');
                    }
                    
                    const comment = batchComments[i];
                    const globalIndex = startIndex + i;
                    
                    // Update progress
                    this.exportProgress.completed = globalIndex;
                    this.exportProgress.status = `Batch ${batchIndex + 1}/${totalBatches}: Generating image ${i + 1}/${batchComments.length}`;
                    progressCallback?.(this.exportProgress);

                    try {
                        // Generate PNG based on format
                        let pngBlob;
                        const filename = this.generateFileName(videoTitle, comment.author, comment.text, format === 'thumbnail');
                        
                        if (format === 'thumbnail') {
                            // Generate YouTube thumbnail URL from video_id
                            const thumbnailUrl = video ? `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg` : '';
                            // Use canvas-based composite generation
                            pngBlob = await this.generateYouTubeComposite(comment, videoTitle, thumbnailUrl);
                        } else {
                            // Use HTML-based generation for comment-only format
                            const html = this.generateCommentHTML(comment, videoTitle);
                            pngBlob = await this.generatePNGBlobIframe(html);
                        }
                        
                        if (pngBlob && pngBlob.size > 0) {
                            // Convert blob to Uint8Array for fflate
                            const arrayBuffer = await pngBlob.arrayBuffer();
                            imageFiles[`${filename}.png`] = new Uint8Array(arrayBuffer);
                            console.log(`✅ Generated image ${i + 1}/${batchComments.length}: ${filename}.png (${(pngBlob.size / 1024).toFixed(1)}KB)`);
                        } else {
                            console.warn(`⚠️ Invalid PNG blob for comment ${comment.comment_id}, skipping`);
                        }
                        
                        // Yield control periodically
                        if (i % 5 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 10));
                        }
                        
                    } catch (error) {
                        console.warn(`⚠️ Failed to generate PNG for comment ${comment.comment_id}:`, error);
                    }
                }

                // Step 2: Create ZIP using fflate
                if (Object.keys(imageFiles).length > 0) {
                    this.exportProgress.status = `Batch ${batchIndex + 1}/${totalBatches}: Creating ZIP with ${Object.keys(imageFiles).length} images...`;
                    progressCallback?.(this.exportProgress);

                    await this.createFflateZIP(zipName, imageFiles);
                    zipFiles.push(zipName);
                    
                    console.log(`✅ fflate ZIP generated successfully: ${zipName} with ${Object.keys(imageFiles).length} files`);
                    
                    // Update progress
                    this.exportProgress.status = `✅ Completed batch ${batchIndex + 1}/${totalBatches}`;
                    progressCallback?.(this.exportProgress);
                } else {
                    console.warn(`⚠️ No valid images generated for batch ${batchIndex + 1}, skipping ZIP creation`);
                }

                // Clear memory
                Object.keys(imageFiles).forEach(key => delete imageFiles[key]);
                
                // Small delay between batches
                if (batchIndex < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

            } catch (error) {
                console.error(`❌ Failed to process batch ${batchIndex + 1}:`, error);
            }
        }

        console.log(`🎉 fflate export complete! Generated ${zipFiles.length} ZIP files`);
        return zipFiles;
    }

    /**
     * Create ZIP file using fflate - much more reliable than JSZip
     */
    async createFflateZIP(zipName, imageFiles) {
        return new Promise((resolve, reject) => {
            try {
                // Use fflate's zip function for reliable compression
                this.fflate.zip(imageFiles, {
                    level: 1, // Fast compression
                    mem: 8    // Memory level
                }, (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Create blob and download
                    const blob = new Blob([data], { type: 'application/zip' });
                    this.downloadBlob(blob, zipName);
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate PNG using iframe rendering - ZERO screen interference
     */
    async generatePNGBlobIframe(html) {
        return new Promise(async (resolve, reject) => {
            try {
                // Get iframe document
                const doc = this.iframe.contentDocument;
                doc.body.innerHTML = html;

                // Find the element to render - look for phone-container first (thumbnail format), then comment-container
                const commentElement = doc.querySelector('.phone-container') || doc.querySelector('.export-container') || doc.querySelector('.comment-container') || doc.body.firstElementChild;
                if (!commentElement) {
                    throw new Error('No renderable element found');
                }

                // Wait for any images to load
                const images = commentElement.getElementsByTagName('img');
                const imagePromises = [];
                for (let img of images) {
                    if (!img.complete) {
                        imagePromises.push(new Promise(resolve => { 
                            img.onload = resolve; 
                            img.onerror = resolve; 
                        }));
                    }
                }
                await Promise.all(imagePromises);

                // Short delay for rendering
                await new Promise(resolve => setTimeout(resolve, 100));

                // Generate canvas using iframe content (isolated from main window)
                // Check if this is a thumbnail format by looking for phone-container
                const isThumbFormat = commentElement.classList.contains('phone-container') || commentElement.classList.contains('export-container');
                const canvas = await html2canvas(commentElement, {
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: isThumbFormat ? null : '#ffffff',
                    scale: 2,
                    logging: false,
                    width: isThumbFormat ? 590 : 600,
                    height: isThumbFormat ? 1280 : commentElement.offsetHeight,
                    foreignObjectRendering: true
                });

                // Convert to blob
                canvas.toBlob(blob => {
                    if (blob && blob.size > 0) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to generate PNG - invalid blob'));
                    }
                }, 'image/png');

            } catch (error) {
                console.error('PNG generation error:', error);
                reject(error);
            } finally {
                // Clear iframe content
                if (this.iframe.contentDocument) {
                    this.iframe.contentDocument.body.innerHTML = '';
                }
            }
        });
    }

    /**
     * Generate PNG from HTML and download it
     */
    async generatePNG(html, filename) {
        const blob = await this.generatePNGBlobIframe(html);
        this.downloadBlob(blob, `${filename}.png`);
    }

    /**
     * Generate YouTube thumbnail composite for export (canvas-based, copied from MMInstaArchive)
     */
    async generateYouTubeComposite(comment, videoTitle = '', videoThumbnail = '') {
        // Create a canvas for compositing
        const canvas = document.createElement('canvas');
        canvas.width = 590;   // iPhone portrait width for YouTube
        canvas.height = 1280; // iPhone portrait height
        const ctx = canvas.getContext('2d');
        
        try {
            // Save initial canvas state
            ctx.save();
            
            // 1. Fill the canvas with background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 2. Load and draw the blank phone background
            try {
                const phoneBackground = await this.loadImage('/assets/blank.png');
                console.log(`✅ Successfully loaded phone background: blank.png`);
                // Draw the phone background to fill the entire canvas
                ctx.drawImage(phoneBackground, 0, 0, canvas.width, canvas.height);
            } catch (error) {
                console.warn(`⚠️ Could not load phone background: ${error.message}`);
                // Create fallback phone frame
                this.drawFallbackPhoneFrame(ctx);
            }
            
            // 3. Load and draw the YouTube video thumbnail with padding
            if (videoThumbnail) {
                try {
                    const thumbnail = await this.loadImage(videoThumbnail);
                    console.log(`📐 YouTube thumbnail dimensions: ${thumbnail.width} x ${thumbnail.height}`);
                    
                    // YouTube video area positioning with padding and shifted down
                    const padding = 20;
                    const contentX = padding;
                    const contentY = 185; // Shifted down from 165
                    const contentWidth = 590 - (padding * 2); // 550px with padding
                    const contentHeight = 311; // Slightly smaller to maintain aspect ratio
                    
                    // Draw rounded rectangle for thumbnail
                    this.drawRoundedRect(ctx, contentX, contentY, contentWidth, contentHeight, 20);
                    ctx.clip(); // Clip future drawing to rounded rectangle
                    
                    // Draw the thumbnail scaled to fit YouTube video area
                    ctx.drawImage(thumbnail, contentX, contentY, contentWidth, contentHeight);
                    console.log(`✅ Drew YouTube thumbnail at ${contentX}, ${contentY} with padding`);
                    
                    // Restore canvas state (remove clipping)
                    ctx.restore();
                    ctx.save();
                } catch (error) {
                    console.warn(`⚠️ Could not load YouTube thumbnail: ${error.message}`);
                    // Draw placeholder video with padding
                    const padding = 20;
                    this.drawVideoPlaceholder(ctx, padding, 185, 590 - (padding * 2), 311);
                }
            } else {
                // Draw placeholder when no thumbnail provided with padding
                const padding = 20;
                this.drawVideoPlaceholder(ctx, padding, 185, 590 - (padding * 2), 311);
            }
            
            // 4. Draw video title area (shifted down)
            this.drawVideoTitle(ctx, videoTitle, 520, 536); // Shifted down
            
            // 5. Draw the comment (shifted down more)
            const commentY = 630; // Shifted down more from 600
            this.drawYouTubeComment(ctx, comment, commentY);
            
            // Convert canvas to blob
            return new Promise((resolve, reject) => {
                canvas.toBlob(blob => {
                    if (blob && blob.size > 0) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to generate YouTube composite image'));
                    }
                }, 'image/png');
            });
            
        } catch (error) {
            console.error('Error creating YouTube composite:', error);
            throw error;
        }
    }
    
    /**
     * Load an image and return a promise (copied from MMInstaArchive)
     */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                console.log(`✅ Successfully loaded image: ${src}`);
                resolve(img);
            };
            img.onerror = () => {
                console.error(`❌ Failed to load image: ${src}`);
                reject(new Error(`Failed to load image: ${src}`));
            };
            img.crossOrigin = 'anonymous'; // For CORS
            img.src = src;
        });
    }
    
    /**
     * Draw fallback phone frame when blank.png fails to load
     */
    drawFallbackPhoneFrame(ctx) {
        const canvas = ctx.canvas;
        
        // Basic phone-style frame
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Status bar area
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, 50);
        
        // YouTube header area
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 50, canvas.width, 115);
        
        // YouTube logo
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText('YouTube', 20, 85);
        
        console.log('✅ Created fallback phone frame');
    }
    
    /**
     * Draw rounded rectangle
     */
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    /**
     * Draw video placeholder
     */
    drawVideoPlaceholder(ctx, x, y, width, height) {
        // Save state and draw rounded rectangle
        ctx.save();
        this.drawRoundedRect(ctx, x, y, width, height, 20);
        ctx.clip();
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, width, height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '60px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▶', x + width/2, y + height/2);
        
        ctx.restore();
    }
    
    /**
     * Draw video title area
     */
    drawVideoTitle(ctx, videoTitle, x, y) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, y - 20, ctx.canvas.width, 60);
        
        ctx.fillStyle = '#030303';
        ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif'; // Made bold and increased from 20px to 26px
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        // Wrap title text
        const maxWidth = ctx.canvas.width - 32;
        const titleLines = this.wrapText(ctx, videoTitle, maxWidth);
        let currentY = y;
        
        titleLines.slice(0, 2).forEach(line => { // Max 2 lines
            ctx.fillText(line, 16, currentY);
            currentY += 32; // Increased line height for larger font
        });
    }
    
    /**
     * Draw YouTube comment
     */
    drawYouTubeComment(ctx, comment, yPosition) {
        const avatarColor = this.generateAvatarColor(comment.author);
        const firstLetter = comment.author[1]?.toUpperCase() || comment.author[0]?.toUpperCase() || 'U';
        const formattedDate = this.formatDate(comment.published_at);
        const authorName = comment.author;
        const commentText = comment.text;
        
        // YouTube comment positioning with more padding
        const leftMargin = 16;
        const rightMargin = 16;
        const avatarSize = 44; // Increased from 40
        const avatarMargin = 16; // Increased from 12
        const cardPadding = 20; // Internal padding inside the rounded rectangle
        
        // Calculate text area with internal padding
        const textStartX = leftMargin + cardPadding + avatarSize + avatarMargin;
        const maxTextWidth = ctx.canvas.width - textStartX - rightMargin - cardPadding;
        
        // Background for comment
        const bgColor = '#f2f2f2';
        const textColor = '#030303';
        const metaColor = '#606060';
        
        ctx.font = '26px -apple-system, BlinkMacSystemFont, sans-serif'; // Increased from 22px for even better readability
        
        // Wrap comment text
        const commentLines = this.wrapText(ctx, commentText, maxTextWidth);
        const lineHeight = 32; // Increased from 28 for larger font
        const bgHeight = (commentLines.length * lineHeight) + 100 + (cardPadding * 2); // More padding
        
        // Draw comment card background with rounded corners
        ctx.fillStyle = bgColor;
        const bgY = yPosition - cardPadding;
        const bgWidth = ctx.canvas.width - (leftMargin * 2);
        
        // Save state and draw rounded rectangle
        ctx.save();
        this.drawRoundedRect(ctx, leftMargin, bgY, bgWidth, bgHeight, 24); // Much more rounded corners - increased from 16 to 24
        ctx.fill();
        ctx.restore();
        
        // Draw avatar circle (with internal padding offset)
        const avatarCenterX = leftMargin + cardPadding + avatarSize / 2;
        const avatarCenterY = yPosition + cardPadding + avatarSize / 2;
        
        ctx.fillStyle = avatarColor;
        ctx.beginPath();
        ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw avatar letter
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif'; // Increased from 18px
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(firstLetter, avatarCenterX, avatarCenterY);
        
        // Draw author name and date (with internal padding)
        ctx.fillStyle = textColor;
        ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, sans-serif'; // Increased from 16px
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        
        let currentY = yPosition + cardPadding + 22;
        ctx.fillText(authorName, textStartX, currentY);
        
        // Draw date
        const authorWidth = ctx.measureText(authorName).width;
        ctx.fillStyle = metaColor;
        ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif'; // Increased from 14px
        ctx.fillText(formattedDate, textStartX + authorWidth + 10, currentY);
        
        // Draw comment text
        ctx.fillStyle = textColor;
        ctx.font = '26px -apple-system, BlinkMacSystemFont, sans-serif'; // Increased from 22px for maximum readability
        currentY += 12;
        
        commentLines.forEach(line => {
            currentY += lineHeight;
            ctx.fillText(line, textStartX, currentY);
        });
        
        // Draw likes
        ctx.fillStyle = metaColor;
        ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif'; // Increased from 14px
        const likeDisplay = this.formatLikes(comment.like_count);
        ctx.fillText(`👍 ${likeDisplay}`, textStartX, currentY + 32);
    }
    
    /**
     * Wrap text to fit within a maximum width (copied from MMInstaArchive)
     */
    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    /**
     * Generate HTML for a comment with video thumbnail (portrait format) - DEPRECATED
     * Now using canvas-based generateYouTubeComposite() instead
     */
    generateCommentWithThumbnailHTML(comment, videoTitle = '', videoThumbnail = '') {
        // This method is now deprecated - we use generateYouTubeComposite() instead
        console.warn('⚠️ generateCommentWithThumbnailHTML is deprecated, use generateYouTubeComposite instead');
        return this.generateCommentHTML(comment, videoTitle);
    }

    /**
     * Generate HTML for a comment in YouTube style (FROM WORKING GITHUB VERSION)
     */
    generateCommentHTML(comment, videoTitle = '') {
        const avatarColor = this.generateAvatarColor(comment.author);
        const firstLetter = comment.author[1]?.toUpperCase() || comment.author[0]?.toUpperCase() || 'U';
        const formattedDate = this.formatDate(comment.published_at);
        const likeDisplay = this.formatLikes(comment.like_count);
        const heartIcon = comment.channel_owner_liked ? '❤️' : '';
        
        // Escape HTML
        const commentText = this.escapeHTML(comment.text);
        const authorName = this.escapeHTML(comment.author);
        const videoTitleEscaped = this.escapeHTML(videoTitle);

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.3/font/bootstrap-icons.css">
    <style>
        body {
            font-family: 'Roboto', Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            width: 600px;
        }
        .comment-container {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            background-color: #ffffff;
        }
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: ${avatarColor};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            font-weight: 500;
            flex-shrink: 0;
        }
        .comment-content {
            flex: 1;
            min-width: 0;
        }
        .comment-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        .author-name {
            font-size: 13px;
            font-weight: 500;
            color: #030303;
        }
        .comment-date {
            font-size: 12px;
            color: #606060;
        }
        .comment-text {
            font-size: 14px;
            line-height: 1.4;
            color: #030303;
            margin-bottom: 8px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .comment-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .like-button {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            border-radius: 18px;
            background-color: #f2f2f2;
            color: #030303;
            font-size: 12px;
            font-weight: 500;
        }
        .like-icon {
            width: 16px;
            height: 16px;
            stroke: currentColor;
        }
        .heart-icon {
            margin-left: 8px;
            font-size: 14px;
        }
        .video-title {
            font-size: 11px;
            color: #606060;
            margin-bottom: 8px;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="comment-container">
        <div class="avatar">${firstLetter}</div>
        <div class="comment-content">
            ${videoTitle ? `<div class="video-title">From: ${videoTitleEscaped}</div>` : ''}
            <div class="comment-header">
                <span class="author-name">${authorName}</span>
                <span class="comment-date">${formattedDate}</span>
            </div>
            <div class="comment-text">${commentText}</div>
            <div class="comment-actions">
                <div class="like-button">
                    <svg class="like-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    ${likeDisplay}
                </div>
                ${heartIcon ? `<span class="heart-icon">${heartIcon}</span>` : ''}
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Flatten comments with replies into a single array
     */
    flattenComments(commentsWithReplies) {
        const flattened = [];
        
        for (const comment of commentsWithReplies) {
            flattened.push(comment);
            if (comment.replies && comment.replies.length > 0) {
                flattened.push(...comment.replies);
            }
        }
        
        return flattened;
    }

    /**
     * Split array into chunks
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Generate consistent avatar color for username
     */
    generateAvatarColor(username) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F39C12',
            '#E74C3C', '#9B59B6', '#3498DB', '#2ECC71'
        ];
        const hash = this.hashString(username);
        return colors[hash % colors.length];
    }

    /**
     * Simple string hash function
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Format date for display
     */
    formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Format like count (1000 -> 1K)
     */
    formatLikes(count) {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
        }
        return count.toString();
    }

    /**
     * Escape HTML characters
     */
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate filename for export
     */
    generateFileName(videoTitle, username, commentText, withThumbnail = false) {
        const cleanTitle = this.sanitizeFilename(videoTitle, 30);
        const cleanUsername = this.sanitizeFilename(username, 20);
        const cleanComment = this.sanitizeFilename(commentText, 40);
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '');
        const format = withThumbnail ? 'thumb' : 'comment';
        
        return `${cleanTitle}_${cleanUsername}_${cleanComment}_${format}_${timestamp}`;
    }

    /**
     * Sanitize filename by removing invalid characters
     */
    sanitizeFilename(text, maxLength = 50) {
        return text
            .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .substring(0, maxLength) // Limit length
            .replace(/_+$/, ''); // Remove trailing underscores
    }

    /**
     * Download blob as file
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Get export progress
     */
    getProgress() {
        return { ...this.exportProgress };
    }

    /**
     * Check if export is in progress
     */
    isExportInProgress() {
        return this.isExporting;
    }

    /**
     * Cancel current export
     */
    cancelExport() {
        this.cancelled = true;
        this.isExporting = false;
        this.exportProgress = {
            current: 0,
            total: 0,
            status: 'Export cancelled'
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.iframe) {
            this.iframe.remove();
        }
    }
}

// Export for use in other modules
window.ExportService = ExportService; 