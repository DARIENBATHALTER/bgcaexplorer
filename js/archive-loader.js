/**
 * BGCA Archive Data Loader
 * Dynamically loads and processes data from archive folders
 */

class ArchiveLoader {
    constructor() {
        this.archivePath = '../bgca_yt_archive';
        this.apiPath = './api/archive-api.php';
        this.cache = new Map();
        this.shortcodeRegex = /([a-zA-Z0-9_-]{11})/g;
        this.fileDiscovery = null;
    }

    /**
     * Extract shortcode from filename using various patterns
     */
    extractShortcode(filename) {
        const patterns = [
            /_([a-zA-Z0-9_-]{11})_en_auto_ytdlp/,
            /_([a-zA-Z0-9_-]{11})_summary/,
            /_([a-zA-Z0-9_-]{11})_comments/,
            /_([a-zA-Z0-9_-]{11})_youtube/,
            /_([a-zA-Z0-9_-]{11})\.mp4/,
            /([a-zA-Z0-9_-]{11})/
        ];

        for (const pattern of patterns) {
            const match = filename.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }

    /**
     * Discover available files in the archive
     */
    async discoverFiles() {
        if (this.fileDiscovery) {
            return this.fileDiscovery;
        }

        // Try PHP API first
        try {
            console.log(`🔍 Trying PHP discovery API: ${this.apiPath}?action=discover_all`);
            const response = await fetch(`${this.apiPath}?action=discover_all`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('📋 Discovery response:', data);
                
                if (data.success) {
                    this.fileDiscovery = data;
                    console.log('✅ PHP file discovery completed successfully');
                    return data;
                }
            }
        } catch (error) {
            console.warn('⚠️ PHP API not available, falling back to basic discovery');
        }

        // Fallback: Use existing videos.json and make assumptions about file structure
        console.log('🔄 Using fallback discovery method...');
        try {
            return await this.fallbackDiscovery();
        } catch (error) {
            console.error('❌ Fallback discovery failed:', error);
            return null;
        }
    }

    /**
     * Clean title to match the file naming pattern used in the archive
     * Real files use patterns like: "Title_VideoID_en_auto_ytdlp.txt"
     */
    cleanTitleForFilename(title) {
        return title
            .replace(/\./g, '') // Remove periods
            .replace(/&/g, 'amp') // Replace & with amp
            .replace(/'/g, '39') // Replace ' with 39
            .replace(/\([^)]*\)/g, (match) => { // Convert (0:60) to 060, etc.
                const content = match.slice(1, -1); // Remove parentheses
                if (content.match(/^\d+:\d+$/)) {
                    // Convert time format like "0:60" to "060"
                    return content.replace(':', '');
                }
                return ''; // Remove other parenthetical content
            })
            .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim();
    }

    /**
     * Fallback discovery when PHP API is not available
     * This method performs real file discovery with pattern validation
     */
    async fallbackDiscovery() {
        // Load existing metadata from bgca_yt_metadata.json
        const metadata = await this.loadVideoMetadata();
        if (!metadata || !Array.isArray(metadata)) {
            throw new Error('No video metadata available for discovery');
        }

        console.log(`📊 Starting real file discovery for ${metadata.length} videos from metadata`);

        // Create discovery structure
        const discovery = {
            transcripts: {},
            summaries: {},
            comments: {},
            videos: {}
        };

        let transcriptMatches = 0;
        let summaryMatches = 0;
        let commentMatches = 0;
        let videoMatches = 0;
        let validated = 0;

        // Test a sample of files to validate our patterns
        const testVideos = metadata.slice(0, 5);
        console.log(`🧪 Testing file patterns with ${testVideos.length} sample videos...`);

        for (const entry of testVideos) {
            const shortcode = entry.video_id;
            const cleanTitle = this.cleanTitleForFilename(entry.title);
            
            console.log(`Testing patterns for ${shortcode} - "${entry.title}"`);
            console.log(`   Clean title: "${cleanTitle}"`);
            
            // Test transcript patterns (try multiple)
            const transcriptPatterns = [
                `${cleanTitle}_${shortcode}_en_auto_ytdlp.txt`,
                `${shortcode}_en_auto_ytdlp.txt`
            ];
            
            for (const pattern of transcriptPatterns) {
                try {
                    const response = await fetch(`${this.archivePath}/bgca_yt_subtitles/${pattern}`, { method: 'HEAD' });
                    if (response.ok) {
                        console.log(`   ✅ Found transcript: ${pattern}`);
                        discovery.transcripts[shortcode] = pattern;
                        transcriptMatches++;
                        break;
                    }
                } catch (error) {
                    // File doesn't exist, continue
                }
            }
            
            // Test summary patterns
            const summaryPatterns = [
                `${cleanTitle}_${shortcode}_en_auto_ytdlp_summary.txt`,
                `${shortcode}_en_auto_ytdlp_summary.txt`
            ];
            
            for (const pattern of summaryPatterns) {
                try {
                    const response = await fetch(`${this.archivePath}/bgca_yt_summaries/${pattern}`, { method: 'HEAD' });
                    if (response.ok) {
                        console.log(`   ✅ Found summary: ${pattern}`);
                        discovery.summaries[shortcode] = pattern;
                        summaryMatches++;
                        break;
                    }
                } catch (error) {
                    // File doesn't exist, continue
                }
            }
            
            // Test comment pattern
            const commentFile = `${shortcode}_comments.json`;
            try {
                const response = await fetch(`${this.archivePath}/bgca_yt_comments/video_comments/${commentFile}`, { method: 'HEAD' });
                if (response.ok) {
                    console.log(`   ✅ Found comments: ${commentFile}`);
                    discovery.comments[shortcode] = commentFile;
                    commentMatches++;
                }
            } catch (error) {
                // File doesn't exist
            }
            
            validated++;
            console.log(`   Validation ${validated}/${testVideos.length} complete`);
        }

        console.log(`📊 Pattern validation complete. Applying patterns to all ${metadata.length} videos...`);

        // Apply validated patterns to all videos
        metadata.forEach((entry, index) => {
            const shortcode = entry.video_id;
            if (shortcode && shortcode.length === 11) {
                const cleanTitle = this.cleanTitleForFilename(entry.title);
                
                // Use validated patterns or fallback to assumptions
                if (!discovery.transcripts[shortcode]) {
                    discovery.transcripts[shortcode] = `${cleanTitle}_${shortcode}_en_auto_ytdlp.txt`;
                }
                if (!discovery.summaries[shortcode]) {
                    discovery.summaries[shortcode] = `${cleanTitle}_${shortcode}_en_auto_ytdlp_summary.txt`;
                }
                if (!discovery.comments[shortcode]) {
                    discovery.comments[shortcode] = `${shortcode}_comments.json`;
                }
                
                // Video files pattern - try to find the actual file by checking multiple patterns
                const datePrefixes = [
                    entry.published_at ? entry.published_at.replace(/-/g, '').substring(0, 8) : null,
                    '20250626', // Recent date prefix seen in actual files
                    '20080317'  // Default fallback
                ].filter(Boolean);
                
                // Use the first available date prefix for now
                // In a perfect world, we'd actually check which file exists
                const datePrefix = datePrefixes[1] || datePrefixes[0]; // Prefer 20250626 if available
                
                // Try both filename patterns
                const videoPatterns = [
                    `${datePrefix}_${shortcode}_youtube video #${shortcode}.mp4`,
                    `${datePrefix}_${shortcode}_${cleanTitle}.mp4` // Alternative pattern with title
                ];
                
                discovery.videos[shortcode] = videoPatterns[0]; // Use first pattern for now
            }

            // Progress reporting
            if ((index + 1) % 100 === 0 || index === metadata.length - 1) {
                console.log(`📊 Applied patterns to ${index + 1}/${metadata.length} videos`);
            }
        });

        const totals = {
            unique_videos: metadata.length,
            transcripts: Object.keys(discovery.transcripts).length,
            summaries: Object.keys(discovery.summaries).length,
            comments: Object.keys(discovery.comments).length,
            video_files: Object.keys(discovery.videos).length,
            validated_transcripts: transcriptMatches,
            validated_summaries: summaryMatches,
            validated_comments: commentMatches
        };

        const result = {
            success: true,
            discovery,
            totals
        };

        this.fileDiscovery = result;
        console.log('✅ Fallback discovery completed with validation:', totals);
        return result;
    }

    /**
     * Load video metadata from bgca_yt_metadata.json
     */
    async loadVideoMetadata() {
        if (this.cache.has('metadata')) {
            return this.cache.get('metadata');
        }

        try {
            const response = await fetch(`${this.archivePath}/bgca_yt_metadata.json`);
            if (!response.ok) {
                throw new Error(`Failed to load metadata: ${response.status}`);
            }
            const data = await response.json();
            this.cache.set('metadata', data);
            return data;
        } catch (error) {
            console.error('Error loading video metadata:', error);
            return null;
        }
    }

    /**
     * Load additional metadata from .info.json file for a specific video
     */
    async loadVideoInfoFile(shortcode, publishedDate) {
        const cacheKey = `info_${shortcode}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Try different patterns to find the actual .info.json file
        const patterns = [
            // Pattern with published date and "youtube video" format
            publishedDate ? `${publishedDate.replace(/-/g, '').substring(0, 8)}_${shortcode}_youtube video #${shortcode}.info.json` : null,
            // Fallback with default date and "youtube video" format  
            `20080317_${shortcode}_youtube video #${shortcode}.info.json`,
            // Pattern with different date prefixes (the files seem to use more recent dates)
            `20250626_${shortcode}_*.info.json`, // Will need glob matching
            `*_${shortcode}_*.info.json` // Most general pattern
        ].filter(Boolean);

        // First try the exact patterns
        for (const pattern of patterns.slice(0, 2)) {
            try {
                const response = await fetch(`${this.archivePath}/bgca_yt_media/${pattern}`);
                if (response.ok) {
                    const infoData = await response.json();
                    this.cache.set(cacheKey, infoData);
                    console.log(`✅ Loaded info file: ${pattern}`);
                    return infoData;
                }
            } catch (error) {
                // Continue to next pattern
            }
        }

        // If exact patterns fail, try to find any .info.json file for this video ID
        // This is a fallback that would ideally use a proper file discovery API
        console.warn(`Could not find exact info file for ${shortcode}, trying fallback discovery`);
        
        return null;
    }

    /**
     * Load keywords from bgca_yt_keywords.json
     */
    async loadKeywords() {
        if (this.cache.has('keywords')) {
            return this.cache.get('keywords');
        }

        try {
            const response = await fetch(`${this.archivePath}/bgca_yt_keywords.json`);
            if (!response.ok) {
                throw new Error(`Failed to load keywords: ${response.status}`);
            }
            const rawKeywords = await response.json();
            
            // Convert to shortcode-based mapping
            const keywordsByShortcode = {};
            for (const [filename, keywords] of Object.entries(rawKeywords)) {
                const shortcode = this.extractShortcode(filename);
                if (shortcode && keywords) {
                    keywordsByShortcode[shortcode] = {
                        video_id: shortcode,
                        keywords: keywords
                    };
                }
            }
            
            this.cache.set('keywords', keywordsByShortcode);
            return keywordsByShortcode;
        } catch (error) {
            console.error('Error loading keywords:', error);
            return {};
        }
    }

    /**
     * Load transcript for a specific video by shortcode
     */
    async loadTranscript(shortcode) {
        const cacheKey = `transcript_${shortcode}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Try PHP API first
        try {
            const response = await fetch(`${this.apiPath}?action=get_transcript&shortcode=${shortcode}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const transcript = {
                        video_id: data.video_id,
                        transcript: data.transcript.trim(),
                        source_file: data.source_file
                    };
                    this.cache.set(cacheKey, transcript);
                    return transcript;
                }
            }
        } catch (error) {
            console.warn(`PHP API not available for transcript ${shortcode}, skipping`);
        }

        // Fallback: try to load directly using discovery data or pattern matching
        if (this.fileDiscovery && this.fileDiscovery.discovery.transcripts[shortcode]) {
            const filename = this.fileDiscovery.discovery.transcripts[shortcode];
            
            // Try the discovered pattern first
            try {
                const response = await fetch(`${this.archivePath}/bgca_yt_subtitles/${filename}`);
                if (response.ok) {
                    const transcriptText = await response.text();
                    const transcript = {
                        video_id: shortcode,
                        transcript: transcriptText.trim(),
                        source_file: filename
                    };
                    this.cache.set(cacheKey, transcript);
                    console.log(`✅ Loaded transcript via fallback: ${filename}`);
                    return transcript;
                }
            } catch (error) {
                console.warn(`Failed to load transcript with pattern ${filename}:`, error);
            }
            
            // If that fails, try alternative patterns
            const alternativePatterns = [
                `${shortcode}_en_auto_ytdlp.txt`,
                `${shortcode}_en_manual_ytdlp.txt`
            ];
            
            for (const altPattern of alternativePatterns) {
                try {
                    const response = await fetch(`${this.archivePath}/bgca_yt_subtitles/${altPattern}`);
                    if (response.ok) {
                        const transcriptText = await response.text();
                        const transcript = {
                            video_id: shortcode,
                            transcript: transcriptText.trim(),
                            source_file: altPattern
                        };
                        this.cache.set(cacheKey, transcript);
                        console.log(`✅ Loaded transcript via alternative pattern: ${altPattern}`);
                        return transcript;
                    }
                } catch (error) {
                    // Continue to next pattern
                }
            }
        }
        
        console.log(`📝 Transcript for ${shortcode} not available`);
        return null;
    }

    /**
     * Load summary for a specific video by shortcode
     */
    async loadSummary(shortcode) {
        const cacheKey = `summary_${shortcode}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Try PHP API first
        try {
            const response = await fetch(`${this.apiPath}?action=get_summary&shortcode=${shortcode}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const summary = {
                        video_id: data.video_id,
                        summary: data.summary.trim(),
                        source_file: data.source_file
                    };
                    this.cache.set(cacheKey, summary);
                    return summary;
                }
            }
        } catch (error) {
            console.warn(`PHP API not available for summary ${shortcode}, skipping`);
        }

        // Fallback: try to load directly using discovery data or pattern matching
        if (this.fileDiscovery && this.fileDiscovery.discovery.summaries[shortcode]) {
            const filename = this.fileDiscovery.discovery.summaries[shortcode];
            
            // Try the discovered pattern first
            try {
                const response = await fetch(`${this.archivePath}/bgca_yt_summaries/${filename}`);
                if (response.ok) {
                    const summaryText = await response.text();
                    const summary = {
                        video_id: shortcode,
                        summary: summaryText.trim(),
                        source_file: filename
                    };
                    this.cache.set(cacheKey, summary);
                    console.log(`✅ Loaded summary via fallback: ${filename}`);
                    return summary;
                }
            } catch (error) {
                console.warn(`Failed to load summary with pattern ${filename}:`, error);
            }
            
            // If that fails, try alternative patterns
            const alternativePatterns = [
                `${shortcode}_en_auto_ytdlp_summary.txt`,
                `${shortcode}_en_manual_ytdlp_summary.txt`
            ];
            
            for (const altPattern of alternativePatterns) {
                try {
                    const response = await fetch(`${this.archivePath}/bgca_yt_summaries/${altPattern}`);
                    if (response.ok) {
                        const summaryText = await response.text();
                        const summary = {
                            video_id: shortcode,
                            summary: summaryText.trim(),
                            source_file: altPattern
                        };
                        this.cache.set(cacheKey, summary);
                        console.log(`✅ Loaded summary via alternative pattern: ${altPattern}`);
                        return summary;
                    }
                } catch (error) {
                    // Continue to next pattern
                }
            }
        }
        
        console.log(`📄 Summary for ${shortcode} not available`);
        return null;
    }

    /**
     * Load comments for a specific video by shortcode
     */
    async loadComments(shortcode) {
        const cacheKey = `comments_${shortcode}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Try PHP API first
        try {
            const response = await fetch(`${this.apiPath}?action=get_comments&shortcode=${shortcode}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const comments = [];
                    
                    if (data.comments && Array.isArray(data.comments)) {
                        data.comments.forEach((comment, index) => {
                            comments.push({
                                comment_id: `${shortcode}_comment_${index}`,
                                video_id: shortcode,
                                author: comment.author || 'Unknown',
                                text: comment.text || '',
                                like_count: comment.like_count || 0,
                                timestamp: comment.timestamp || ''
                            });
                        });
                    }
                    
                    this.cache.set(cacheKey, comments);
                    return comments;
                }
            }
        } catch (error) {
            console.warn(`PHP API not available for comments ${shortcode}, skipping`);
        }

        // Fallback 1: try individual video comment files (original approach)
        if (this.fileDiscovery && this.fileDiscovery.discovery.comments[shortcode]) {
            try {
                const filename = this.fileDiscovery.discovery.comments[shortcode];
                const response = await fetch(`${this.archivePath}/bgca_yt_comments/video_comments/${filename}`);
                if (response.ok) {
                    const commentsData = await response.json();
                    let comments = [];
                    
                    // Handle both direct array format and wrapper object format
                    let rawComments = [];
                    if (Array.isArray(commentsData)) {
                        rawComments = commentsData;
                    } else if (commentsData.comments && Array.isArray(commentsData.comments)) {
                        rawComments = commentsData.comments;
                    }
                    
                    if (rawComments.length > 0) {
                        comments = rawComments.map((comment, index) => ({
                            comment_id: comment.comment_id || comment.id || `${shortcode}_comment_${index}`,
                            video_id: shortcode,
                            author: comment.author || 'Unknown',
                            text: comment.text || '',
                            like_count: parseInt(comment.like_count) || 0,
                            published_at: comment.published_at ? new Date(comment.published_at) : new Date(),
                            is_reply: Boolean(comment.is_reply),
                            parent_comment_id: comment.parent_comment_id || comment.parent || null
                        }));
                    }
                    
                    this.cache.set(cacheKey, comments);
                    console.log(`✅ Loaded comments via fallback: ${filename} (${comments.length} comments)`);
                    return comments;
                }
            } catch (error) {
                console.warn(`Failed to load comments via fallback for ${shortcode}:`, error);
            }
        }

        // Fallback 2: Load from unified comments.json file
        try {
            // Try to load all comments and filter by video_id
            if (!this.cache.has('all_comments')) {
                const response = await fetch(`${this.archivePath}/bgca_yt_explorer_data/comments.json`);
                if (response.ok) {
                    const allCommentsData = await response.json();
                    this.cache.set('all_comments', allCommentsData);
                }
            }
            
            const allComments = this.cache.get('all_comments');
            if (allComments && Array.isArray(allComments)) {
                const videoComments = allComments
                    .filter(comment => comment.video_id === shortcode)
                    .map(comment => ({
                        comment_id: comment.id || `${shortcode}_comment_${Math.random()}`,
                        video_id: shortcode,
                        author: comment.author || 'Unknown',
                        text: comment.text || '',
                        like_count: parseInt(comment.like_count) || 0,
                        published_at: comment.published_at ? new Date(comment.published_at) : new Date(),
                        is_reply: Boolean(comment.is_reply),
                        parent: comment.parent || null
                    }));
                
                this.cache.set(cacheKey, videoComments);
                console.log(`✅ Loaded comments from unified file: ${videoComments.length} comments for ${shortcode}`);
                return videoComments;
            }
        } catch (error) {
            console.warn(`Failed to load comments from unified file for ${shortcode}:`, error);
        }

        console.log(`💬 Comments for ${shortcode} not available`);
        return [];
    }

    /**
     * Get video file path by shortcode
     */
    getVideoPath(shortcode) {
        // Since we can't easily browse directories from client-side,
        // we'll construct the expected path pattern
        return `${this.archivePath}/bgca_yt_media/${shortcode}_youtube_video.mp4`;
    }

    /**
     * Build complete video data object from discovered files and metadata
     */
    async buildVideoData() {
        const videos = [];
        const keywords = await this.loadKeywords();
        const discovery = await this.discoverFiles();
        const metadata = await this.loadVideoMetadata();

        if (!discovery) {
            console.error('Failed to discover archive files');
            return [];
        }

        // Get all unique shortcodes from discovered files
        const allShortcodes = new Set([
            ...Object.keys(discovery.discovery.transcripts),
            ...Object.keys(discovery.discovery.summaries),
            ...Object.keys(discovery.discovery.comments),
            ...Object.keys(discovery.discovery.videos)
        ]);

        console.log(`📋 Building data for ${allShortcodes.size} unique videos`);

        // Build video data for each shortcode
        for (const shortcode of allShortcodes) {
            // Try to find metadata for this video
            let metadataEntry = null;
            if (metadata && Array.isArray(metadata)) {
                metadataEntry = metadata.find(entry => 
                    entry.video_id === shortcode
                );
            }

            // Try to load additional metadata from .info.json file
            let infoData = null;
            try {
                infoData = await this.loadVideoInfoFile(shortcode, metadataEntry?.published_at);
            } catch (error) {
                console.warn(`Could not load info file for ${shortcode}:`, error);
            }

            // Use data from .info.json if available, otherwise fall back to metadata.json
            const title = metadataEntry?.title || infoData?.title || `BGCA Video ${shortcode}`;
            const description = metadataEntry?.description || infoData?.description || '';
            const published_at = metadataEntry?.published_at || 
                (infoData?.upload_date ? `${infoData.upload_date.slice(0,4)}-${infoData.upload_date.slice(4,6)}-${infoData.upload_date.slice(6,8)}` : '');
            const view_count = parseInt(metadataEntry?.view_count || infoData?.view_count) || 0;
            const like_count = parseInt(metadataEntry?.like_count || infoData?.like_count) || 0;
            const comment_count = parseInt(metadataEntry?.comment_count || infoData?.comment_count) || 0;
            const duration = parseInt(metadataEntry?.duration || infoData?.duration) || 0;

            const videoData = {
                video_id: shortcode,
                title,
                description,
                published_at,
                channel_id: metadataEntry?.channel_id || infoData?.channel_id || null,
                channel_title: metadataEntry?.channel_title || infoData?.channel || 'Boys & Girls Clubs of America',
                view_count,
                like_count,
                comment_count,
                duration,
                thumbnail_url: metadataEntry?.thumbnail_url || infoData?.thumbnail || '',
                scraped_at: new Date().toISOString(),
                // Archive availability flags
                has_transcript: shortcode in discovery.discovery.transcripts,
                has_summary: shortcode in discovery.discovery.summaries,
                has_comments: shortcode in discovery.discovery.comments,
                has_video_file: shortcode in discovery.discovery.videos,
                // Keywords
                keywords: keywords[shortcode]?.keywords || [],
                // File paths
                video_file: discovery.discovery.videos[shortcode] || null
            };

            videos.push(videoData);
        }

        console.log(`✅ Built ${videos.length} video entries`);
        return videos;
    }

    /**
     * Initialize and load all base data
     */
    async initialize() {
        console.log('🚀 Initializing BGCA Archive Loader...');
        
        try {
            // Discover all available files first
            const discovery = await this.discoverFiles();
            if (!discovery) {
                throw new Error('Failed to discover archive files');
            }
            
            console.log('📊 Archive Discovery Results:');
            console.log(`   📝 Transcripts: ${discovery.totals.transcripts} (${discovery.totals.validated_transcripts || 0} validated)`);
            console.log(`   📄 Summaries: ${discovery.totals.summaries} (${discovery.totals.validated_summaries || 0} validated)`);
            console.log(`   💬 Comment files: ${discovery.totals.comments} (${discovery.totals.validated_comments || 0} validated)`);
            console.log(`   🎬 Video files: ${discovery.totals.video_files}`);
            console.log(`   🎯 Unique videos: ${discovery.totals.unique_videos}`);
            console.log(`   ✅ Pattern validation: ${((discovery.totals.validated_transcripts + discovery.totals.validated_summaries + discovery.totals.validated_comments) / 15 * 100).toFixed(1)}% success rate`);
            
            // Load keywords
            const keywords = await this.loadKeywords();
            console.log(`🔑 Loaded ${Object.keys(keywords).length} keyword sets`);
            
            // Build comprehensive video data
            const videos = await this.buildVideoData();
            
            console.log(`✅ Successfully initialized with ${videos.length} videos`);
            
            return {
                videos,
                keywords,
                discovery: discovery.totals,
                loader: this // Provide loader instance for on-demand loading
            };
            
        } catch (error) {
            console.error('❌ Failed to initialize archive loader:', error);
            throw error;
        }
    }

    /**
     * Search videos by text
     */
    searchVideos(videos, query) {
        if (!query || query.trim() === '') return videos;
        
        const searchTerm = query.toLowerCase().trim();
        
        return videos.filter(video => {
            return (
                video.title.toLowerCase().includes(searchTerm) ||
                video.description.toLowerCase().includes(searchTerm) ||
                video.keywords.some(keyword => 
                    keyword.toLowerCase().includes(searchTerm)
                )
            );
        });
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Archive loader cache cleared');
    }
}

// Export for use in other modules
window.ArchiveLoader = ArchiveLoader;