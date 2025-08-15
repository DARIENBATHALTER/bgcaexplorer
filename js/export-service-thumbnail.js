/**
 * Generate Comment with Thumbnail HTML for Export Service
 * This module creates YouTube mobile app-style screenshots
 */

// This function will be added to the ExportService class
function generateCommentWithThumbnailHTML(comment, videoTitle = '', videoThumbnail = '') {
    const avatarColor = this.generateAvatarColor(comment.author);
    const firstLetter = comment.author[1]?.toUpperCase() || comment.author[0]?.toUpperCase() || 'U';
    const formattedDate = this.formatDate(comment.published_at);
    const likeDisplay = this.formatLikes(comment.like_count);
    
    // Escape HTML
    const commentText = this.escapeHTML(comment.text);
    const authorName = this.escapeHTML(comment.author);
    const videoTitleEscaped = this.escapeHTML(videoTitle);

    // The dimensions should match the iPhone screenshot aspect ratio (1179x2556)
    // But we'll use 590x1280 as requested
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
        
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', Arial, sans-serif;
            margin: 0;
            padding: 0;
            width: 590px;
            height: 1280px;
            overflow: hidden;
            position: relative;
            background: #000;
        }
        
        /* Container that holds everything */
        .phone-container {
            width: 590px;
            height: 1280px;
            position: relative;
            background: white;
        }
        
        /* iOS Status Bar */
        .status-bar {
            height: 44px;
            background: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            font-size: 15px;
            font-weight: 600;
            color: #000;
        }
        
        .status-left {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .status-right {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        /* YouTube Header */
        .youtube-header {
            height: 56px;
            background: white;
            display: flex;
            align-items: center;
            padding: 0 16px;
            border-bottom: 1px solid #e5e5e5;
        }
        
        .youtube-logo {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .yt-icon {
            width: 36px;
            height: 25px;
            background: #FF0000;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            font-weight: bold;
        }
        
        .yt-text {
            font-size: 20px;
            font-weight: 500;
            color: #212121;
            font-family: 'Roboto', sans-serif;
        }
        
        /* Content Area */
        .content-area {
            height: calc(1280px - 44px - 56px - 83px);
            overflow: hidden;
            background: #f9f9f9;
        }
        
        /* Video Thumbnail */
        .video-container {
            position: relative;
            width: 100%;
            height: 331px;
            background: #000;
        }
        
        .video-thumbnail {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .video-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
            color: #fff;
            font-size: 60px;
        }
        
        /* Video Info */
        .video-info {
            background: white;
            padding: 12px 16px;
            border-bottom: 1px solid #e5e5e5;
        }
        
        .video-title {
            font-size: 16px;
            font-weight: 500;
            color: #030303;
            line-height: 22px;
            margin: 0;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        /* Comment Section */
        .comment-wrapper {
            background: white;
            margin-top: 8px;
            padding: 16px;
        }
        
        .comment-card {
            background: #f2f2f2;
            border-radius: 12px;
            padding: 12px;
            display: flex;
            gap: 12px;
        }
        
        .comment-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: ${avatarColor};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 16px;
            font-weight: 500;
            flex-shrink: 0;
        }
        
        .comment-body {
            flex: 1;
            min-width: 0;
        }
        
        .comment-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        
        .comment-author {
            font-size: 13px;
            font-weight: 500;
            color: #030303;
        }
        
        .comment-time {
            font-size: 12px;
            color: #606060;
        }
        
        .comment-text {
            font-size: 14px;
            line-height: 20px;
            color: #030303;
            margin-bottom: 8px;
            word-wrap: break-word;
            white-space: pre-wrap;
        }
        
        .comment-stats {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #606060;
        }
        
        /* Bottom Navigation */
        .bottom-nav {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 83px;
            background: white;
            border-top: 1px solid #e5e5e5;
        }
        
        /* iOS Home Indicator */
        .home-indicator {
            position: absolute;
            bottom: 8px;
            left: 50%;
            transform: translateX(-50%);
            width: 134px;
            height: 5px;
            background: #000;
            border-radius: 100px;
            opacity: 0.3;
        }
    </style>
</head>
<body>
    <div class="phone-container">
        <!-- iOS Status Bar -->
        <div class="status-bar">
            <div class="status-left">
                <span>12:14</span>
                <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M1 0C0.447715 0 0 0.447715 0 1V8C0 8.55229 0.447715 9 1 9H13C13.5523 9 14 8.55229 14 8V1C14 0.447715 13.5523 0 13 0H1ZM15 3.5V5.5C16.1046 5.5 17 4.60457 17 3.5C17 2.39543 16.1046 1.5 15 1.5V3.5Z" fill="black"/>
                </svg>
            </div>
            <div class="status-right">
                <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
                    <path d="M1 4C1.89543 4 2.71836 3.62708 3.33579 3.00965C3.95322 2.39222 4.32614 1.56929 4.32614 0.673862C4.32614 0.301339 4.02481 0 3.65228 0C3.27976 0 2.97842 0.301339 2.97842 0.673862C2.97842 1.19689 2.7707 1.69846 2.39977 2.06939C2.02885 2.44032 1.52728 2.64804 1.00425 2.64804C0.631721 2.64804 0.330383 2.94938 0.330383 3.32191C0.330383 3.69443 0.631721 3.99577 1.00425 3.99577L1 4ZM1 12C4.31371 12 7 9.31371 7 6C7 5.44772 6.55228 5 6 5C5.44772 5 5 5.44772 5 6C5 8.20914 3.20914 10 1 10C0.447715 10 0 10.4477 0 11C0 11.5523 0.447715 12 1 12ZM1 8C2.10457 8 3 7.10457 3 6C3 5.44772 2.55228 5 2 5C1.44772 5 1 5.44772 1 6C1 6.55228 0.552285 7 0 7V8C0 8 0.447715 8 1 8Z" fill="black"/>
                </svg>
                <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
                    <path opacity="0.35" d="M13.3333 0H1.66667C0.746192 0 0 0.746192 0 1.66667V9.16667C0 10.0871 0.746192 10.8333 1.66667 10.8333H13.3333C14.2538 10.8333 15 10.0871 15 9.16667V1.66667C15 0.746192 14.2538 0 13.3333 0Z" fill="black"/>
                    <path d="M1 3.5V7.33333C1 7.88562 1.44772 8.33333 2 8.33333H13C13.5523 8.33333 14 7.88562 14 7.33333V3.5C14 2.94772 13.5523 2.5 13 2.5H2C1.44772 2.5 1 2.94772 1 3.5Z" fill="black"/>
                </svg>
                <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
                    <rect opacity="0.35" x="0.5" y="0.833252" width="21" height="10.3333" rx="2.16667" stroke="black"/>
                    <path opacity="0.4" d="M23 4V8C23.8047 7.66122 24.3333 6.87313 24.3333 6C24.3333 5.12687 23.8047 4.33878 23 4Z" fill="black"/>
                    <rect x="2" y="2.33325" width="18" height="7.33333" rx="1.33333" fill="black"/>
                </svg>
            </div>
        </div>
        
        <!-- YouTube Header -->
        <div class="youtube-header">
            <div class="youtube-logo">
                <div class="yt-icon">▶</div>
                <span class="yt-text">YouTube</span>
            </div>
        </div>
        
        <!-- Content Area -->
        <div class="content-area">
            <!-- Video -->
            <div class="video-container">
                ${videoThumbnail ? 
                    `<img src="${videoThumbnail}" alt="" class="video-thumbnail" crossorigin="anonymous">` : 
                    `<div class="video-placeholder">▶</div>`
                }
            </div>
            
            <!-- Video Title -->
            <div class="video-info">
                <h2 class="video-title">${videoTitleEscaped}</h2>
            </div>
            
            <!-- Comment -->
            <div class="comment-wrapper">
                <div class="comment-card">
                    <div class="comment-avatar">${firstLetter}</div>
                    <div class="comment-body">
                        <div class="comment-meta">
                            <span class="comment-author">${authorName}</span>
                            <span class="comment-time">${formattedDate}</span>
                        </div>
                        <div class="comment-text">${commentText}</div>
                        <div class="comment-stats">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="#606060">
                                <path d="M3.17188 10.5H2.25C1.83516 10.5 1.5 10.1648 1.5 9.75V5.57812C1.5 5.16328 1.83516 4.82812 2.25 4.82812H3.17188C3.58672 4.82812 3.92188 5.16328 3.92188 5.57812V9.75C3.92188 10.1648 3.58672 10.5 3.17188 10.5ZM5.01562 9.95312C5.01562 10.2305 5.16797 10.4859 5.41406 10.6172C5.66016 10.7531 5.95781 10.7438 6.19453 10.5938L7.97344 9.42656C8.14453 9.31875 8.35078 9.25781 8.5625 9.25781H9.84375C10.3969 9.25781 10.8609 8.83594 10.9203 8.28516C10.9609 7.90312 10.8016 7.53281 10.5047 7.30078L9.66094 6.63281C9.66094 6.63281 10.0477 5.23359 9.95391 4.78594C9.76641 3.89531 9.14844 3.19688 8.23828 3.05391C7.78359 2.98125 7.33125 3.14062 7.02891 3.47344C6.82734 3.69844 6.60938 4.07812 6.46875 4.59141C6.33984 5.06016 6.09141 5.48672 5.74688 5.83125L5.42344 6.15469C5.18672 6.39141 5.01562 6.71953 5.01562 7.02188V9.95312Z"/>
                            </svg>
                            <span>${likeDisplay}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Bottom Navigation -->
        <div class="bottom-nav"></div>
        
        <!-- iOS Home Indicator -->
        <div class="home-indicator"></div>
    </div>
</body>
</html>`;
}

// Export the function for use in ExportService
window.generateCommentWithThumbnailHTML = generateCommentWithThumbnailHTML;