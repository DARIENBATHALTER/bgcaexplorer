/**
 * VideoGrid Component - Handles video grid rendering and interactions
 * This component can be extended for more advanced grid features
 */
class VideoGridComponent {
    constructor(container, dataManager) {
        this.container = container;
        this.dataManager = dataManager;
        this.videos = [];
        this.isLoading = false;
        
        this.setupEventHandlers();
    }

    /**
     * Setup event handlers for video grid
     */
    setupEventHandlers() {
        this.container.addEventListener('click', (e) => {
            const videoCard = e.target.closest('.video-card');
            if (videoCard && !this.isLoading) {
                const videoId = videoCard.dataset.videoId;
                this.onVideoClick?.(videoId);
            }
        });

        // Lazy loading for images
        this.setupLazyLoading();
    }

    /**
     * Setup lazy loading for video thumbnails
     */
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        observer.unobserve(img);
                    }
                });
            });

            // Observe all lazy images
            this.container.addEventListener('DOMNodeInserted', (e) => {
                if (e.target.classList?.contains('lazy')) {
                    imageObserver.observe(e.target);
                }
            });
        }
    }

    /**
     * Render videos in the grid
     */
    render(videos) {
        this.videos = videos;
        this.isLoading = true;

        const html = videos.map(video => this.createVideoCard(video)).join('');
        this.container.innerHTML = html;

        // Setup lazy loading for new images
        this.container.querySelectorAll('img[data-src]').forEach(img => {
            if ('IntersectionObserver' in window) {
                // Will be handled by observer
            } else {
                // Fallback for older browsers
                img.src = img.dataset.src;
            }
        });

        this.isLoading = false;
    }

    /**
     * Create video card HTML
     */
    createVideoCard(video) {
        const thumbnail = `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`;
        const date = new Date(video.published_at).toLocaleDateString();
        const views = this.formatNumber(video.view_count);
        const comments = this.formatNumber(video.comment_count);
        
        return `
            <div class="col-md-6 col-lg-4 col-xl-3">
                <div class="card video-card" data-video-id="${video.video_id}">
                    <div class="video-thumbnail">
                        <img class="card-img-top lazy" 
                             data-src="${thumbnail}" 
                             alt="${this.escapeHTML(video.title)}" 
                             loading="lazy"
                             src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3C/svg%3E">
                    </div>
                    <div class="video-card-body card-body">
                        <h6 class="video-title" title="${this.escapeHTML(video.title)}">
                            ${this.escapeHTML(video.title)}
                        </h6>
                        <div class="video-stats">
                            <small class="text-muted">${views} views • ${comments} comments</small>
                        </div>
                        <div class="video-date">
                            <small class="text-muted">${date}</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Add skeleton loading cards
     */
    renderSkeleton(count = 12) {
        const skeletonCards = Array(count).fill(0).map(() => `
            <div class="col-md-6 col-lg-4 col-xl-3">
                <div class="card video-card skeleton">
                    <div class="video-thumbnail skeleton">
                        <div class="card-img-top" style="height: 180px; background: #f0f0f0;"></div>
                    </div>
                    <div class="video-card-body card-body">
                        <div class="skeleton" style="height: 1rem; margin-bottom: 0.5rem; background: #e0e0e0;"></div>
                        <div class="skeleton" style="height: 0.8rem; width: 60%; background: #e0e0e0;"></div>
                    </div>
                </div>
            </div>
        `).join('');

        this.container.innerHTML = skeletonCards;
    }

    /**
     * Format numbers (1000 -> 1K)
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace('.0', '') + 'K';
        }
        return num.toString();
    }

    /**
     * Escape HTML
     */
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Set video click handler
     */
    setVideoClickHandler(handler) {
        this.onVideoClick = handler;
    }
}

// Export for use in other modules
window.VideoGridComponent = VideoGridComponent; 