/**
 * BGCA Archive Data Loader
 * Dynamically loads and processes data from archive folders
 */

class ArchiveLoader {
    constructor() {
        this.archivePath = '../bgca_yt_archive'; // Will be updated when user selects directory
        this.apiPath = './api/archive-api.php';
        this.cache = new Map();
        this.shortcodeRegex = /([a-zA-Z0-9_-]{11})/g;
        this.fileDiscovery = null;
        this.directoryHandle = null; // Store the directory handle from File System Access API
    }

    /**
     * Set directory handle for File System Access API
     */
    setDirectoryHandle(directoryHandle) {
        this.directoryHandle = directoryHandle;
        if (directoryHandle) {
            console.log(`📁 Archive loader updated to use directory: ${directoryHandle.name}`);
        }
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
     * Uses existing data files instead of file system discovery
     */
    async fallbackDiscovery() {
        console.log('📊 Using data-based discovery instead of file system discovery');
        
        // Load existing metadata from videos.json
        const metadata = await this.loadVideoMetadata();
        if (!metadata || !Array.isArray(metadata)) {
            throw new Error('No video metadata available for discovery');
        }

        console.log(`📊 Building discovery structure for ${metadata.length} videos`);

        // Load data from existing JSON files instead of file discovery
        try {
            // Load transcripts index
            const transcriptsResponse = await fetch(`${this.archivePath}/transcripts.json`);
            const transcripts = transcriptsResponse.ok ? await transcriptsResponse.json() : {};

            // Load summaries index  
            const summariesResponse = await fetch(`${this.archivePath}/summaries.json`);
            const summaries = summariesResponse.ok ? await summariesResponse.json() : {};

            // Load comments index
            const commentsResponse = await fetch(`${this.archivePath}/comments.json`);
            const comments = commentsResponse.ok ? await commentsResponse.json() : {};

            console.log(`📊 Loaded data: ${Object.keys(transcripts).length} transcripts, ${Object.keys(summaries).length} summaries, ${Object.keys(comments).length} comments`);

            // Create discovery structure based on available data
            const discovery = {
                transcripts: {},
                summaries: {},
                comments: {},
                videos: {}
            };

            // Map data to discovery structure
            metadata.forEach((entry) => {
                const shortcode = entry.video_id;
                if (shortcode) {
                    // Check if data exists for this video
                    if (transcripts[shortcode]) {
                        discovery.transcripts[shortcode] = `${shortcode}.txt`; // Simplified path
                    }
                    if (summaries[shortcode]) {
                        discovery.summaries[shortcode] = `${shortcode}_summary.txt`;
                    }
                    if (comments[shortcode]) {
                        discovery.comments[shortcode] = `${shortcode}_comments.json`;
                    }
                    
                    // Assume video files follow standard pattern
                    discovery.videos[shortcode] = `${shortcode}.mp4`;
                }
            });

            const totals = {
                unique_videos: metadata.length,
                transcripts: Object.keys(discovery.transcripts).length,
                summaries: Object.keys(discovery.summaries).length,
                comments: Object.keys(discovery.comments).length,
                video_files: Object.keys(discovery.videos).length
            };

            const result = {
                success: true,
                discovery,
                totals
            };

            this.fileDiscovery = result;
            console.log('✅ Data-based discovery completed:', totals);
            return result;
            
        } catch (error) {
            console.error('❌ Error during data-based discovery:', error);
            throw new Error('Failed to load discovery data from JSON files');
        }
    }

    /**
     * Load video metadata from user's directory or fallback to local data
     */
    async loadVideoMetadata() {
        if (this.cache.has('metadata')) {
            return this.cache.get('metadata');
        }

        // Try to load from user's selected directory first
        if (this.directoryHandle) {
            try {
                const metadataFile = await this.directoryHandle.getFileHandle('bgca_yt_metadata.json');
                const file = await metadataFile.getFile();
                const data = JSON.parse(await file.text());
                const metadata = Array.isArray(data) ? data : Object.values(data);
                
                this.cache.set('metadata', metadata);
                console.log(`📊 Loaded ${metadata.length} videos from user directory metadata`);
                return metadata;
            } catch (error) {
                console.log('📁 No metadata in user directory, trying explorer_data folder...');
                
                try {
                    const explorerDataDir = await this.directoryHandle.getDirectoryHandle('bgca_yt_explorer_data');
                    const videosFile = await explorerDataDir.getFileHandle('videos.json');
                    const file = await videosFile.getFile();
                    const data = JSON.parse(await file.text());
                    const metadata = Array.isArray(data) ? data : Object.values(data);
                    
                    this.cache.set('metadata', metadata);
                    console.log(`📊 Loaded ${metadata.length} videos from user directory explorer_data`);
                    return metadata;
                } catch (explorerError) {
                    console.log('📁 No explorer_data folder, falling back to included data...');
                }
            }
        }

        // Fallback: load from included data files
        try {
            const response = await fetch('./data/videos.json');
            if (!response.ok) {
                throw new Error(`Failed to load fallback metadata: ${response.status}`);
            }
            const data = await response.json();
            const metadata = Array.isArray(data) ? data : Object.values(data);
            
            this.cache.set('metadata', metadata);
            console.log(`📊 Loaded ${metadata.length} videos from included data (fallback)`);
            return metadata;
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

        // Try loading from user's directory first
        if (this.directoryHandle) {
            try {
                const explorerDataDir = await this.directoryHandle.getDirectoryHandle('bgca_yt_explorer_data');
                const transcriptsFile = await explorerDataDir.getFileHandle('transcripts.json');
                const file = await transcriptsFile.getFile();
                const transcripts = JSON.parse(await file.text());
                
                if (transcripts[shortcode]) {
                    const transcript = {
                        video_id: shortcode,
                        transcript: transcripts[shortcode],
                        source_file: 'user_directory/transcripts.json'
                    };
                    this.cache.set(cacheKey, transcript);
                    console.log(`✅ Loaded transcript from user directory: ${shortcode}`);
                    return transcript;
                }
            } catch (error) {
                console.log(`📁 No transcript in user directory for ${shortcode}, trying fallback...`);
            }
        }

        // Fallback: load from included data
        try {
            const response = await fetch('./data/transcripts.json');
            if (response.ok) {
                const transcripts = await response.json();
                if (transcripts[shortcode]) {
                    const transcript = {
                        video_id: shortcode,
                        transcript: transcripts[shortcode],
                        source_file: 'included_data/transcripts.json'
                    };
                    this.cache.set(cacheKey, transcript);
                    console.log(`✅ Loaded transcript from included data: ${shortcode}`);
                    return transcript;
                }
            }
        } catch (error) {
            console.warn(`Failed to load transcript for ${shortcode}:`, error);
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

        try {
            // Load from summaries.json
            const response = await fetch(`${this.archivePath}/summaries.json`);
            if (response.ok) {
                const summaries = await response.json();
                if (summaries[shortcode]) {
                    const summary = {
                        video_id: shortcode,
                        summary: summaries[shortcode],
                        source_file: 'summaries.json'
                    };
                    this.cache.set(cacheKey, summary);
                    console.log(`✅ Loaded summary from JSON: ${shortcode}`);
                    return summary;
                }
            }
        } catch (error) {
            console.warn(`Failed to load summary for ${shortcode}:`, error);
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

        try {
            // Load from comments.json
            const response = await fetch(`${this.archivePath}/comments.json`);
            if (response.ok) {
                const commentsData = await response.json();
                if (commentsData[shortcode]) {
                    const rawComments = commentsData[shortcode];
                    
                    // Normalize comment format
                    const comments = Array.isArray(rawComments) ? rawComments.map((comment, index) => ({
                        comment_id: comment.comment_id || comment.id || `${shortcode}_comment_${index}`,
                        video_id: shortcode,
                        author: comment.author || 'Unknown',
                        text: comment.text || '',
                        like_count: parseInt(comment.like_count) || 0,
                        published_at: comment.published_at ? new Date(comment.published_at) : new Date(),
                        is_reply: Boolean(comment.is_reply),
                        parent_comment_id: comment.parent_comment_id || comment.parent || null
                    })) : [];
                    
                    this.cache.set(cacheKey, comments);
                    console.log(`✅ Loaded comments from JSON: ${shortcode} (${comments.length} comments)`);
                    return comments;
                }
            }
        } catch (error) {
            console.warn(`Failed to load comments for ${shortcode}:`, error);
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