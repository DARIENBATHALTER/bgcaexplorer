/**
 * Configuration for BGCA YouTube Archive Explorer
 * This file centralizes all configuration settings
 */

const AppConfig = {
    // Data directory path - relative to the explorer index.html
    // Update this path to point to the archive folder
    DATA_PATH: '../bgca_yt_archive',
    
    // Individual data file paths
    get dataFiles() {
        return {
            videos: `${this.DATA_PATH}/bgca_yt_metadata.json`,
            comments: `${this.DATA_PATH}/bgca_yt_comments.json`,
            keywords: `${this.DATA_PATH}/bgca_yt_keywords.json`,
            transcripts: `${this.DATA_PATH}/bgca_yt_transcripts.json`,
            summaries: `${this.DATA_PATH}/bgca_yt_summaries.json`,
            videoMapping: `${this.DATA_PATH}/bgca_yt_metadata.json`,
            searchIndex: `${this.DATA_PATH}/search_index.json`,
            transcriptIndex: `${this.DATA_PATH}/transcript_index.json`,
            wordFreqIndex: `${this.DATA_PATH}/word_freq_index.json`,
            videoCommentsIndex: `${this.DATA_PATH}/video_comments_index.json`
        };
    },
    
    // Archive paths for local video playback
    ARCHIVE_BASE: '../bgca_yt_archive',
    
    // Feature flags
    features: {
        localVideoPlayback: true,
        transcripts: true,
        summaries: true,
        keywords: true,
        comments: true,
        analytics: true
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfig;
}