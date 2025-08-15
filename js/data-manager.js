/**
 * DataManager - Handles all data operations for the BGCA Archive Explorer
 * Manages archive data loading, IndexedDB storage, and data querying
 */
class DataManager {
    constructor() {
        this.db = null;
        this.videos = [];
        this.comments = [];
        this.videoMapping = {};
        this.isInitialized = false;
        this.dbName = 'BGCAArchiveDB';
        this.dbVersion = 1;
        this.usingPreIndexedData = false;
        
        // Archive loader
        this.archiveLoader = new ArchiveLoader();
        
        // Pre-indexed data stores
        this.videoCommentsIndex = null;
        this.searchIndex = null;
        this.wordFreqIndex = null;
    }

    /**
     * Initialize the data manager by loading archive data and setting up IndexedDB
     */
    async initialize(progressCallback) {
        try {
            progressCallback?.('Initializing archive loader...', 5);
            const archiveData = await this.archiveLoader.initialize();
            progressCallback?.('Archive discovered', 25);

            progressCallback?.('Loading video data from archive...', 30);
            this.videos = archiveData.videos;
            progressCallback?.(`Loaded ${this.videos.length} videos`, 45);

            progressCallback?.('Building video mapping...', 50);
            this.buildVideoMapping();
            progressCallback?.('Video mapping built', 60);

            // Set up basic comment structure (will be loaded on-demand)
            this.comments = [];
            progressCallback?.('Comments will be loaded on-demand', 70);

            // Skip IndexedDB setup for now - we're using direct archive access
            progressCallback?.('Archive data ready - using direct access', 90);

            progressCallback?.('Ready!', 100);
            this.isInitialized = true;
            
            console.log('✅ DataManager initialized successfully');
            console.log(`📊 ${this.videos.length} videos loaded from archive`);
            console.log(`📊 Discovery: ${JSON.stringify(archiveData.discovery, null, 2)}`);
            
        } catch (error) {
            console.error('❌ DataManager initialization failed:', error);
            throw error;
        }
    }

    /**
     * Build video mapping from videos array with multiple fallback patterns
     */
    buildVideoMapping() {
        this.videoMapping = {};
        this.videos.forEach(video => {
            if (video.video_file) {
                // Use the actual video file path - the video_file already contains the filename
                this.videoMapping[video.video_id] = `../bgca_yt_archive/bgca_yt_media/${video.video_file}`;
            } else {
                // Generate multiple possible paths for this video
                const videoId = video.video_id;
                const title = video.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
                
                // Try different date prefixes and filename patterns
                const datePrefixes = [
                    video.published_at ? new Date(video.published_at).toISOString().slice(0, 10).replace(/-/g, '') : null,
                    '20250626', // Recent date seen in actual files
                    '20080317'  // Default fallback
                ].filter(Boolean);
                
                // Create multiple possible filenames to try
                const possiblePaths = [];
                datePrefixes.forEach(datePrefix => {
                    // Pattern 1: Standard format
                    possiblePaths.push(`../bgca_yt_archive/bgca_yt_media/${datePrefix}_${videoId}_youtube video #${videoId}.mp4`);
                    // Pattern 2: Title-based format (clean up title for filename)
                    const cleanTitle = title.replace(/\([^)]*\)/g, (match) => {
                        const content = match.slice(1, -1);
                        if (content.match(/^\d+:\d+$/)) {
                            return content.replace(':', '');
                        }
                        return match.replace(/:/g, '_');
                    });
                    possiblePaths.push(`../bgca_yt_archive/bgca_yt_media/${datePrefix}_${videoId}_${cleanTitle}.mp4`);
                });
                
                // Store the first possible path (the video player will try multiple)
                this.videoMapping[video.video_id] = possiblePaths;
            }
        });
        console.log(`📁 Built video mapping for ${Object.keys(this.videoMapping).length} videos`);
    }

    /**
     * Load transcript for a video using archive loader
     */
    async loadTranscript(videoId) {
        return await this.archiveLoader.loadTranscript(videoId);
    }

    /**
     * Load summary for a video using archive loader
     */
    async loadSummary(videoId) {
        return await this.archiveLoader.loadSummary(videoId);
    }

    /**
     * Load comments for a video using archive loader
     */
    async loadCommentsForVideo(videoId) {
        return await this.archiveLoader.loadComments(videoId);
    }

    /**
     * Initialize from pre-loaded mapping data (for File System Access API mode)
     */
    async initializeFromMapping(videoMappingData) {
        try {
            console.log('📊 DataManager: Initializing from mapping data...');
            
            // Store the video mapping data directly
            this.videoMapping = videoMappingData;
            
            // Extract videos array if the mapping contains it
            if (videoMappingData.videos) {
                this.videos = videoMappingData.videos;
            } else {
                // If it's just a mapping object, convert to videos array
                this.videos = Object.values(videoMappingData).map(video => ({
                    ...video,
                    published_at: new Date(video.published_at || video.upload_date),
                    view_count: parseInt(video.view_count) || 0,
                    comment_count: parseInt(video.comment_count) || 0
                }));
            }
            
            // Extract comments if available
            if (videoMappingData.comments) {
                this.comments = videoMappingData.comments.map(comment => ({
                    ...comment,
                    published_at: new Date(comment.published_at),
                    like_count: parseInt(comment.like_count) || 0,
                    is_reply: Boolean(comment.is_reply)
                }));
            } else {
                this.comments = [];
            }
            
            // Set up basic indexing
            this.buildVideoCommentsIndex();
            
            this.isInitialized = true;
            
            console.log(`✅ DataManager initialized from mapping with ${this.videos.length} videos, ${this.comments.length} comments`);
            
        } catch (error) {
            console.error('❌ DataManager initialization from mapping failed:', error);
            throw error;
        }
    }

    /**
     * Initialize for hosted mode - metadata from server, videos from local directory
     */
    async initializeFromHostedMapping(videoMappingData) {
        try {
            console.log('📊 DataManager: Initializing for hosted mode...');
            
            // Load videos and comments from the hosted data files
            await this.loadVideoData();
            await this.loadCommentData();
            
            // Store the video mapping (which contains file paths)
            this.videoMapping = videoMappingData;
            
            // Set up basic indexing
            this.buildVideoCommentsIndex();
            
            this.isInitialized = true;
            
            console.log(`✅ DataManager initialized for hosted mode with ${this.videos.length} videos, ${this.comments.length} comments`);
            
        } catch (error) {
            console.error('❌ DataManager hosted mode initialization failed:', error);
            throw error;
        }
    }

    /**
     * Build video-comments index for faster lookups
     */
    buildVideoCommentsIndex() {
        if (!this.videoCommentsIndex) {
            this.videoCommentsIndex = {};
            this.comments.forEach(comment => {
                if (!this.videoCommentsIndex[comment.video_id]) {
                    this.videoCommentsIndex[comment.video_id] = [];
                }
                this.videoCommentsIndex[comment.video_id].push(comment);
            });
        }
    }

    /**
     * Load video data from JSON file
     */
    async loadVideoData() {
        try {
            const response = await fetch(AppConfig.dataFiles.videos);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            this.videos = await response.json();
            console.log(`📹 Loaded ${this.videos.length} videos`);
            
            // Process dates and ensure numeric fields
            this.videos = this.videos.map(video => ({
                ...video,
                published_at: new Date(video.published_at),
                view_count: parseInt(video.view_count) || 0,
                comment_count: parseInt(video.comment_count) || 0
            }));
            
        } catch (error) {
            console.error('❌ Failed to load video data:', error);
            throw new Error('Failed to load video data. Please ensure videos.json exists.');
        }
    }

    /**
     * Load comment data from pre-indexed files for faster loading
     */
    async loadCommentData() {
        try {
            console.log('📄 Attempting to load pre-indexed data...');
            
            // Try to load pre-indexed data files first
            try {
                const [videoCommentsResponse, searchIndexResponse, wordFreqResponse] = await Promise.all([
                    fetch(AppConfig.dataFiles.videoCommentsIndex),
                    fetch(AppConfig.dataFiles.searchIndex),
                    fetch(AppConfig.dataFiles.wordFreqIndex)
                ]);
                
                console.log('📡 Pre-index files response status:', {
                    videoComments: videoCommentsResponse.status,
                    searchIndex: searchIndexResponse.status, 
                    wordFreq: wordFreqResponse.status
                });
                
                if (videoCommentsResponse.ok && searchIndexResponse.ok && wordFreqResponse.ok) {
                    this.videoCommentsIndex = await videoCommentsResponse.json();
                    this.searchIndex = await searchIndexResponse.json();
                    this.wordFreqIndex = await wordFreqResponse.json();
                    
                    console.log('✅ Loaded pre-indexed data');
                    console.log(`📊 Indexed ${Object.keys(this.videoCommentsIndex).length} videos`);
                    console.log(`🔍 Search index contains ${Object.keys(this.searchIndex).length} comments`);
                    
                    // For backward compatibility, reconstruct the comments array from pre-indexed data
                    this.comments = [];
                    Object.values(this.videoCommentsIndex).forEach(videoComments => {
                        // Pre-indexed data already has processed dates and numeric fields
                        videoComments.forEach(comment => {
                            // Convert date strings back to Date objects if needed
                            if (typeof comment.published_at === 'string') {
                                comment.published_at = new Date(comment.published_at);
                            }
                            this.comments.push(comment);
                        });
                    });
                    
                    console.log(`💬 Reconstructed ${this.comments.length} comments from pre-indexed data`);
                    this.usingPreIndexedData = true;
                    return;
                }
            } catch (preIndexError) {
                console.warn('⚠️ Pre-indexed files not available, falling back to original method:', preIndexError.message);
            }
            
            // Fallback to original loading method
            const response = await fetch(AppConfig.dataFiles.comments);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            this.comments = await response.json();
            console.log(`💬 Loaded ${this.comments.length} comments`);
            
            // Process dates and ensure numeric fields
            this.comments = this.comments.map(comment => ({
                ...comment,
                published_at: new Date(comment.published_at),
                like_count: parseInt(comment.like_count) || 0,
                is_reply: Boolean(comment.is_reply)
            }));
            
        } catch (error) {
            console.error('❌ Failed to load comment data:', error);
            throw new Error('Failed to load comment data. Please ensure comments.json exists.');
        }
    }

    /**
     * Load video file mapping
     */
    async loadVideoMapping() {
        try {
            const response = await fetch(AppConfig.dataFiles.videoMapping);
            if (!response.ok) {
                console.warn('⚠️ video-mapping.json not found, videos will fallback to YouTube links');
                return;
            }
            
            this.videoMapping = await response.json();
            console.log(`🗂️ Loaded video mapping for ${Object.keys(this.videoMapping).length} videos`);
            
            // Debug: Show first few mappings
            const firstKeys = Object.keys(this.videoMapping).slice(0, 3);
            console.log('🔍 First few video mappings:', firstKeys.map(key => ({
                id: key,
                title: this.videoMapping[key].title,
                path: this.videoMapping[key].file_path
            })));
            
        } catch (error) {
            console.warn('⚠️ Failed to load video mapping:', error);
            this.videoMapping = {};
        }
    }

    /**
     * Initialize IndexedDB for efficient querying
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.warn('⚠️ IndexedDB not available, falling back to in-memory arrays');
                resolve(); // Don't fail if IndexedDB isn't available
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ IndexedDB initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create videos store
                if (!db.objectStoreNames.contains('videos')) {
                    const videoStore = db.createObjectStore('videos', { keyPath: 'video_id' });
                    videoStore.createIndex('published_at', 'published_at');
                    videoStore.createIndex('view_count', 'view_count');
                    videoStore.createIndex('comment_count', 'comment_count');
                    videoStore.createIndex('title', 'title');
                }

                // Create comments store
                if (!db.objectStoreNames.contains('comments')) {
                    const commentStore = db.createObjectStore('comments', { keyPath: 'comment_id' });
                    commentStore.createIndex('video_id', 'video_id');
                    commentStore.createIndex('author', 'author');
                    commentStore.createIndex('published_at', 'published_at');
                    commentStore.createIndex('like_count', 'like_count');
                    commentStore.createIndex('is_reply', 'is_reply');
                    commentStore.createIndex('parent_comment_id', 'parent_comment_id');
                }
            };
        });
    }

    /**
     * Populate IndexedDB with loaded data
     */
    async populateDatabase(progressCallback) {
        if (!this.db) {
            // IndexedDB not available, just simulate progress for user feedback
            progressCallback?.('Using in-memory storage...', 90);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for user feedback
            return;
        }

        try {
            // Clear existing data
            progressCallback?.('Clearing existing data...', 82);
            await this.clearStore('videos');
            await this.clearStore('comments');

            // Add videos
            progressCallback?.('Indexing videos...', 85);
            await this.addToStore('videos', this.videos);

            // Add comments (this is the slow part)
            progressCallback?.('Indexing comments...', 88);
            await this.addToStore('comments', this.comments, progressCallback);

            progressCallback?.('Finalizing database...', 95);
            console.log('✅ IndexedDB populated with data');
        } catch (error) {
            console.warn('⚠️ Failed to populate IndexedDB, using in-memory fallback:', error);
            progressCallback?.('Using in-memory storage...', 90);
        }
    }

    /**
     * Clear an IndexedDB store
     */
    async clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add data to an IndexedDB store
     */
    async addToStore(storeName, data, progressCallback) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            let completed = 0;
            const total = data.length;
            const isComments = storeName === 'comments';
            
            data.forEach((item, index) => {
                const request = store.add(item);
                request.onsuccess = () => {
                    completed++;
                    
                    // Update progress for comments (the slow operation)
                    if (isComments && progressCallback && completed % 1000 === 0) {
                        const progress = 88 + Math.floor((completed / total) * 7); // 88% to 95%
                        progressCallback(`Indexing comments... ${completed.toLocaleString()}/${total.toLocaleString()}`, progress);
                    }
                    
                    if (completed === total) resolve();
                };
                request.onerror = () => reject(request.error);
            });
            
            if (total === 0) resolve();
        });
    }

    /**
     * Get videos with filtering and pagination
     */
    async getVideos(filters = {}, pagination = { page: 1, limit: 24 }) {
        let filteredVideos = [...this.videos];

        // Apply filters
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filteredVideos = filteredVideos.filter(video => 
                video.title.toLowerCase().includes(searchLower) ||
                video.description?.toLowerCase().includes(searchLower)
            );
        }

        if (filters.dateFrom) {
            filteredVideos = filteredVideos.filter(video => 
                video.published_at >= new Date(filters.dateFrom)
            );
        }

        if (filters.dateTo) {
            filteredVideos = filteredVideos.filter(video => 
                video.published_at <= new Date(filters.dateTo)
            );
        }

        if (filters.minViews) {
            filteredVideos = filteredVideos.filter(video => 
                video.view_count >= parseInt(filters.minViews)
            );
        }

        if (filters.minComments) {
            filteredVideos = filteredVideos.filter(video => 
                video.comment_count >= parseInt(filters.minComments)
            );
        }

        // Apply sorting
        const sortBy = filters.sortBy || 'date-desc';
        filteredVideos.sort((a, b) => {
            switch (sortBy) {
                case 'date-asc':
                    return a.published_at - b.published_at;
                case 'date-desc':
                    return b.published_at - a.published_at;
                case 'views-desc':
                    return b.view_count - a.view_count;
                case 'views-asc':
                    return a.view_count - b.view_count;
                case 'comments-desc':
                    return b.comment_count - a.comment_count;
                case 'comments-asc':
                    return a.comment_count - b.comment_count;
                case 'title-asc':
                    return a.title.localeCompare(b.title);
                case 'title-desc':
                    return b.title.localeCompare(a.title);
                default:
                    return b.published_at - a.published_at;
            }
        });

        // Apply pagination
        const startIndex = (pagination.page - 1) * pagination.limit;
        const endIndex = startIndex + pagination.limit;
        const paginatedVideos = filteredVideos.slice(startIndex, endIndex);

        return {
            videos: paginatedVideos,
            total: filteredVideos.length,
            page: pagination.page,
            totalPages: Math.ceil(filteredVideos.length / pagination.limit),
            hasNext: endIndex < filteredVideos.length,
            hasPrev: pagination.page > 1
        };
    }

    /**
     * Get a single video by ID
     */
    getVideo(videoId) {
        return this.videos.find(video => video.video_id === videoId);
    }

    /**
     * Get comments for a video with filtering and pagination
     */
    async getComments(videoId, filters = {}, pagination = { page: 1, limit: 50 }) {
        // Load comments from archive loader (on-demand)
        let videoComments = [];
        try {
            videoComments = await this.loadCommentsForVideo(videoId);
            console.log(`📝 Loaded ${videoComments.length} comments for video ${videoId}`);
        } catch (error) {
            console.warn(`Failed to load comments for video ${videoId}:`, error);
            
            // Fallback to pre-indexed data if available
            if (this.videoCommentsIndex && this.videoCommentsIndex[videoId]) {
                videoComments = [...this.videoCommentsIndex[videoId]];
            } else {
                videoComments = this.comments.filter(comment => comment.video_id === videoId);
            }
        }

        // Apply filters
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            videoComments = videoComments.filter(comment => 
                comment.text.toLowerCase().includes(searchLower) ||
                comment.author.toLowerCase().includes(searchLower)
            );
        }

        if (filters.repliesOnly) {
            videoComments = videoComments.filter(comment => comment.is_reply);
        }

        // Apply sorting
        const sortBy = filters.sortBy || 'likes-desc';
        videoComments.sort((a, b) => {
            switch (sortBy) {
                case 'likes-desc':
                    return b.like_count - a.like_count;
                case 'likes-asc':
                    return a.like_count - b.like_count;
                case 'date-desc':
                    return b.published_at - a.published_at;
                case 'date-asc':
                    return a.published_at - b.published_at;
                default:
                    return b.like_count - a.like_count;
            }
        });

        // Group comments with their replies
        const topLevelComments = videoComments.filter(comment => !comment.is_reply);
        const replies = videoComments.filter(comment => comment.is_reply);

        const commentsWithReplies = topLevelComments.map(comment => ({
            ...comment,
            replies: replies.filter(reply => reply.parent_comment_id === comment.comment_id)
        }));

        // Apply pagination
        const startIndex = (pagination.page - 1) * pagination.limit;
        const endIndex = startIndex + pagination.limit;
        const paginatedComments = commentsWithReplies.slice(startIndex, endIndex);

        return {
            comments: paginatedComments,
            total: commentsWithReplies.length,
            page: pagination.page,
            totalPages: Math.ceil(commentsWithReplies.length / pagination.limit),
            hasNext: endIndex < commentsWithReplies.length,
            hasPrev: pagination.page > 1
        };
    }

    /**
     * Get ALL comments for a video without pagination (for export)
     */
    async getAllComments(videoId, filters = {}) {
        let videoComments = [];
        
        // Load comments from archive loader (on-demand)
        try {
            videoComments = await this.loadCommentsForVideo(videoId);
            console.log(`📝 Loaded ${videoComments.length} comments for video ${videoId} (all comments)`);
        } catch (error) {
            console.warn(`Failed to load comments for video ${videoId}:`, error);
            
            // Fallback to pre-indexed data if available
            if (this.videoCommentsIndex && this.videoCommentsIndex[videoId]) {
                videoComments = [...this.videoCommentsIndex[videoId]];
            } else {
                videoComments = this.comments.filter(comment => comment.video_id === videoId);
            }
        }

        // Apply filters (same as getComments but no pagination)
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            videoComments = videoComments.filter(comment => 
                comment.text.toLowerCase().includes(searchLower) ||
                comment.author.toLowerCase().includes(searchLower)
            );
        }

        if (filters.repliesOnly) {
            videoComments = videoComments.filter(comment => comment.is_reply);
        }

        // Apply sorting
        const sortBy = filters.sortBy || 'likes-desc';
        videoComments.sort((a, b) => {
            switch (sortBy) {
                case 'likes-desc':
                    return b.like_count - a.like_count;
                case 'likes-asc':
                    return a.like_count - b.like_count;
                case 'date-desc':
                    return b.published_at - a.published_at;
                case 'date-asc':
                    return a.published_at - b.published_at;
                default:
                    return b.like_count - a.like_count;
            }
        });

        // Group comments with their replies (same as getComments)
        const topLevelComments = videoComments.filter(comment => !comment.is_reply);
        const replies = videoComments.filter(comment => comment.is_reply);

        const commentsWithReplies = topLevelComments.map(comment => ({
            ...comment,
            replies: replies.filter(reply => reply.parent_comment_id === comment.comment_id)
        }));

        return commentsWithReplies;
    }

    /**
     * Get video file path if available
     */
    getVideoFilePath(videoId) {
        const mapping = this.videoMapping[videoId];
        if (mapping) {
            // Handle string paths, arrays of paths, and object format
            if (typeof mapping === 'string') {
                return mapping;
            } else if (Array.isArray(mapping)) {
                return mapping; // Return array of possible paths
            } else if (mapping.file_path) {
                return mapping.file_path;
            }
        }
        return null;
    }

    /**
     * Get YouTube URL for a video
     */
    getYouTubeUrl(videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
    }

    /**
     * Search across all comments
     */
    async searchComments(query, videoId = null) {
        const searchLower = query.toLowerCase();
        let searchComments = videoId 
            ? this.comments.filter(comment => comment.video_id === videoId)
            : this.comments;

        const results = searchComments.filter(comment => 
            comment.text.toLowerCase().includes(searchLower) ||
            comment.author.toLowerCase().includes(searchLower)
        );

        // Sort by relevance (like count * relevance score)
        results.sort((a, b) => {
            const aRelevance = this.calculateRelevance(a, query);
            const bRelevance = this.calculateRelevance(b, query);
            return bRelevance - aRelevance;
        });

        return results;
    }

    /**
     * Calculate search relevance score
     */
    calculateRelevance(comment, query) {
        const text = comment.text.toLowerCase();
        const author = comment.author.toLowerCase();
        const queryLower = query.toLowerCase();
        
        let score = 0;
        
        // Exact match in text
        if (text.includes(queryLower)) score += 10;
        
        // Exact match in author
        if (author.includes(queryLower)) score += 5;
        
        // Like count boost
        score += Math.log(comment.like_count + 1);
        
        return score;
    }

    /**
     * Get pre-computed word frequencies for a video
     */
    getWordFrequencies(videoId) {
        if (this.wordFreqIndex && this.wordFreqIndex[videoId]) {
            return this.wordFreqIndex[videoId];
        }
        return { word_cloud: [], liked_words: [] };
    }

    /**
     * Get statistics about the data
     */
    getStats() {
        const totalComments = this.comments.length;
        const totalReplies = this.comments.filter(c => c.is_reply).length;
        const totalVideos = this.videos.length;
        const totalViews = this.videos.reduce((sum, v) => sum + v.view_count, 0);
        
        return {
            totalVideos,
            totalComments,
            totalReplies,
            totalViews,
            averageCommentsPerVideo: Math.round(totalComments / totalVideos),
            videosWithMapping: Object.keys(this.videoMapping).length
        };
    }
}

// Export for use in other modules
window.DataManager = DataManager; 