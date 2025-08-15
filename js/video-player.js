/**
 * VideoPlayer - Handles both local video playback and YouTube embeds
 * Manages video loading, error handling, and player controls
 * Version: 4.0 (YouTube + Local support via ModeManager)
 */
class VideoPlayer {
    constructor(videoElement, fallbackElement, modeManager = null) {
        this.videoElement = videoElement;
        this.fallbackElement = fallbackElement;
        this.modeManager = modeManager;
        this.currentVideo = null;
        this.isPlaying = false;
        this.videoContainer = videoElement.closest('.video-container');
        this.playOverlay = document.getElementById('videoPlayOverlay');
        this.youtubeIframe = null;
        this.currentPlayerType = null; // 'local' or 'youtube'
        
        // Custom control elements
        this.customControls = document.getElementById('customControls');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
        this.timeDisplay = document.getElementById('timeDisplay');
        this.muteBtn = document.getElementById('muteBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        
        console.log('🎥 VideoPlayer v4.0 initialized (YouTube + Local support)');
        this.setupEventListeners();
        this.setupCustomControls();
    }

    /**
     * Set up video player event listeners
     */
    setupEventListeners() {
        // Video loading events
        this.videoElement.addEventListener('loadstart', () => {
            this.showLoading(true);
        });

        this.videoElement.addEventListener('canplay', () => {
            this.showLoading(false);
            this.hideError();
        });

        this.videoElement.addEventListener('error', (e) => {
            console.warn('🎥 Video playback error:', e);
            this.handleVideoError();
        });

        // Playback events
        this.videoElement.addEventListener('play', () => {
            this.isPlaying = true;
            this.hidePlayOverlay();
            this.updatePlayPauseIcon();
            this.updateProgress();
        });

        this.videoElement.addEventListener('pause', () => {
            this.isPlaying = false;
            this.showPlayOverlay();
            this.updatePlayPauseIcon();
        });

        this.videoElement.addEventListener('ended', () => {
            this.isPlaying = false;
            this.showPlayOverlay();
            this.updatePlayPauseIcon();
        });

        // Play overlay click handler
        if (this.playOverlay) {
            this.playOverlay.addEventListener('click', () => {
                if (this.videoElement.src) {
                    this.play();
                }
        });
        }

        // Network events
        this.videoElement.addEventListener('stalled', () => {
            console.warn('🎥 Video playback stalled');
        });

        this.videoElement.addEventListener('waiting', () => {
            console.warn('🎥 Video buffering...');
        });

        // Time updates for custom controls
        this.videoElement.addEventListener('timeupdate', () => {
            this.updateProgress();
        });

        this.videoElement.addEventListener('loadedmetadata', () => {
            this.updateTimeDisplay();
            console.log(`🎥 Video metadata loaded - Duration: ${this.videoElement.duration}s`);
        });

        this.videoElement.addEventListener('loadeddata', () => {
            console.log(`🎥 Video data loaded - can now seek`);
        });

        this.videoElement.addEventListener('seeked', () => {
            console.log(`🎥 Seek completed - Current time: ${this.videoElement.currentTime}s`);
            this.updateProgress();
        });

        this.videoElement.addEventListener('seeking', () => {
            console.log(`🎥 Seeking started - Target: ${this.videoElement.currentTime}s`);
        });

        this.videoElement.addEventListener('error', (e) => {
            console.error(`🎥 Video error during playback:`, e);
        });

        // Debug: Monitor any unexpected currentTime changes
        let lastTime = 0;
        this.videoElement.addEventListener('timeupdate', () => {
            if (Math.abs(this.videoElement.currentTime - lastTime) > 10) {
                console.log(`🕐 Large time jump: ${lastTime}s → ${this.videoElement.currentTime}s`);
            }
            lastTime = this.videoElement.currentTime;
        });
    }

    /**
     * Set up custom video controls
     */
    setupCustomControls() {
        // Play/Pause button
        this.playPauseBtn?.addEventListener('click', () => {
            this.togglePlay();
        });

        // Progress bar clicking
        this.progressContainer?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const rect = this.progressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, clickX / rect.width));
            const duration = this.videoElement.duration;
            
            console.log(`🎯 Progress click debug:`);
            console.log(`  - Click X: ${e.clientX}, Rect left: ${rect.left}, Relative: ${clickX}`);
            console.log(`  - Container width: ${rect.width}`);
            console.log(`  - Calculated percentage: ${percentage * 100}%`);
            console.log(`  - Video duration: ${duration}`);
            
            if (duration && !isNaN(duration) && duration > 0) {
                const newTime = duration * percentage;
                console.log(`  - Seeking to: ${newTime}s`);
                console.log(`  - Video ready state: ${this.videoElement.readyState}`);
                console.log(`  - Video current time before: ${this.videoElement.currentTime}s`);
                console.log(`  - Video seekable ranges: ${this.videoElement.seekable.length}`);
                
                if (this.videoElement.readyState >= 2 && this.videoElement.seekable.length > 0) {
                    try {
                        // Check if the seek target is within seekable range
                        const seekableStart = this.videoElement.seekable.start(0);
                        const seekableEnd = this.videoElement.seekable.end(0);
                        const clampedTime = Math.max(seekableStart, Math.min(seekableEnd, newTime));
                        
                        console.log(`  - Seekable range: ${seekableStart}s to ${seekableEnd}s`);
                        console.log(`  - Clamped seek time: ${clampedTime}s`);
                        
                        // Pause video before seeking (some browsers require this)
                        const wasPlaying = !this.videoElement.paused;
                        if (wasPlaying) {
                            this.videoElement.pause();
                            console.log(`  - Video paused for seeking`);
                        }
                        
                        // Try a more robust seek approach
                        this.performSeek(clampedTime, wasPlaying);
                        
                    } catch (error) {
                        console.error(`  - Seek failed:`, error);
                    }
                } else {
                    console.log(`  - Video not ready for seeking (readyState: ${this.videoElement.readyState}, seekable: ${this.videoElement.seekable.length})`);
                }
                
                // Force update after a small delay to ensure the seek completed
                setTimeout(() => {
                    console.log(`  - After timeout, current time: ${this.videoElement.currentTime}s`);
                    this.updateProgress();
                }, 200);
            } else {
                console.log(`  - Cannot seek: duration=${duration}`);
            }
        });

        // Add mousedown/mousemove for dragging
        let isDragging = false;
        
        this.progressContainer?.addEventListener('mousedown', (e) => {
            isDragging = true;
            this.handleProgressDrag(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                this.handleProgressDrag(e);
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Volume controls
        this.muteBtn?.addEventListener('click', () => {
            this.toggleMute();
        });

        this.volumeSlider?.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.videoElement.volume = volume;
            this.updateVolumeIcon();
        });

        // Fullscreen button
        this.fullscreenBtn?.addEventListener('click', () => {
            this.toggleFullscreen();
        });
    }

    /**
     * Load video based on current mode (local or YouTube)
     */
    async loadVideo(videoData, dataManager) {
        try {
            this.currentVideo = videoData;
            this.hideError();
            this.showLoading(true);

            console.log(`🔍 DEBUG - Video ID: ${videoData.video_id}`);
            console.log(`🔍 DEBUG - Video Title: ${videoData.title}`);
            console.log(`🔍 DEBUG - Current Mode: ${this.modeManager?.getCurrentMode()}`);
            
            if (this.modeManager?.isYouTubeMode()) {
                // YouTube mode - embed YouTube video
                console.log('🔗 Loading YouTube embed for video:', videoData.title);
                await this.loadYouTubeVideo(videoData);
            } else {
                // Local mode - try to load local video file
                const localPath = dataManager.getVideoFilePath(videoData.video_id);
                console.log(`🔍 DEBUG - getVideoFilePath returned: ${localPath}`);
                
                if (localPath) {
                    if (localPath.startsWith('filesystem:')) {
                        // Handle File System Access API
                        console.log(`🎥 Attempting to load video via File System Access API`);
                        try {
                            await this.loadLocalVideoFSA(videoData, dataManager);
                        } catch (error) {
                            console.log(`🔗 File System Access failed, showing YouTube fallback`);
                            this.showYouTubeFallback(videoData, dataManager);
                        }
                    } else {
                        // Handle traditional file path
                        console.log(`🎥 Attempting to load local video: ${localPath}`);
                        try {
                            await this.loadLocalVideo(localPath, videoData);
                        } catch (error) {
                            console.log(`🔗 Local video failed to load, showing YouTube fallback`);
                            this.showYouTubeFallback(videoData, dataManager);
                        }
                    }
                } else {
                    console.log(`🔗 No local video mapping found, showing YouTube fallback`);
                this.showYouTubeFallback(videoData, dataManager);
                }
            }

        } catch (error) {
            console.error('🎥 Failed to load video:', error);
            this.showYouTubeFallback(videoData, dataManager);
        }
    }

    /**
     * Load YouTube video as iframe embed
     */
    async loadYouTubeVideo(videoData) {
        return new Promise((resolve) => {
            console.log(`🔗 Creating YouTube embed for: ${videoData.title}`);
            
            // Hide local video element and custom controls
            this.videoElement.style.display = 'none';
            this.hidePlayOverlay();
            this.customControls.style.display = 'none';
            
            // Remove existing iframe if present
            if (this.youtubeIframe) {
                this.youtubeIframe.remove();
            }
            
            // Create YouTube iframe
            this.youtubeIframe = document.createElement('iframe');
            this.youtubeIframe.src = `https://www.youtube.com/embed/${videoData.video_id}?enablejsapi=1&modestbranding=1&rel=0`;
            this.youtubeIframe.className = 'youtube-embed';
            this.youtubeIframe.style.cssText = `
                width: 100%;
                height: 100%;
                border: none;
                border-radius: 8px;
            `;
            this.youtubeIframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            this.youtubeIframe.allowFullscreen = true;
            
            // Insert iframe into video container
            this.videoContainer.appendChild(this.youtubeIframe);
            
            this.currentPlayerType = 'youtube';
            this.showLoading(false);
            
            console.log(`✅ YouTube embed loaded for: ${videoData.title}`);
            resolve();
        });
    }

    /**
     * Load local video file - handles both single paths and arrays of possible paths
     */
    async loadLocalVideo(filePath, videoData) {
        return new Promise(async (resolve, reject) => {
            // Handle array of possible paths
            if (Array.isArray(filePath)) {
                console.log(`🎬 VideoPlayer v4.0: Trying ${filePath.length} possible video paths for ${videoData.video_id}`);
                
                for (let i = 0; i < filePath.length; i++) {
                    const currentPath = filePath[i];
                    console.log(`🔍 Attempting path ${i + 1}/${filePath.length}: ${currentPath}`);
                    
                    try {
                        await this.loadSingleVideoPath(currentPath, videoData);
                        console.log(`✅ Successfully loaded video from path: ${currentPath}`);
                        resolve();
                        return;
                    } catch (error) {
                        console.warn(`⚠️ Failed to load path ${i + 1}/${filePath.length}: ${currentPath}`, error.message);
                        // Continue to next path
                    }
                }
                
                // If we get here, all paths failed
                console.error(`🚨 All ${filePath.length} video paths failed for ${videoData.video_id}`);
                reject(new Error(`All video paths failed for ${videoData.video_id}`));
                return;
            }
            
            // Handle single path (legacy behavior)
            console.log(`🎬 VideoPlayer v4.0: Setting video source to: ${filePath}`);
            try {
                await this.loadSingleVideoPath(filePath, videoData);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Load a single video path
     */
    async loadSingleVideoPath(filePath, videoData) {
        return new Promise(async (resolve, reject) => {
            // Show local video element and custom controls
            this.videoElement.style.display = 'block';
            this.customControls.style.display = 'block';
            
            // Hide any existing YouTube iframe
            if (this.youtubeIframe) {
                this.youtubeIframe.style.display = 'none';
            }
            
            // Configure video element
            this.videoElement.preload = 'metadata';
            this.videoElement.autoplay = false;
            
            try {
                // Set video source based on mode
                if (this.modeManager?.isLocalMode() && this.modeManager.directoryManager?.isDirectorySelected()) {
                    // Use File System Access API to get blob URL
                    console.log('🌐 Using File System Access API - creating blob URL');
                    const blobUrl = await this.modeManager.getVideoSource(videoData.video_id, filePath);
                    this.videoElement.src = blobUrl;
                } else {
                    // Use traditional local server approach
                    console.log('🖥️ Using local server mode');
                    this.videoElement.src = filePath;
                }
            
                // Set poster if available (could use YouTube thumbnail)
                this.setVideoPoster(videoData.video_id);

            } catch (blobError) {
                console.error('🚨 Failed to create blob URL, falling back to direct path:', blobError);
                this.videoElement.src = filePath;
            }

            // Add timeout for loading
            const loadTimeout = setTimeout(() => {
                this.videoElement.removeEventListener('canplay', handleCanPlay);
                this.videoElement.removeEventListener('error', handleError);
                this.videoElement.removeEventListener('loadstart', handleLoadStart);
                console.error(`🚨 VideoPlayer v4.0: Timeout loading video: ${filePath}`);
                reject(new Error('Video loading timeout'));
            }, 5000); // Reduced timeout for faster fallback

            // Handle successful load
            const handleCanPlay = () => {
                clearTimeout(loadTimeout);
                this.videoElement.removeEventListener('canplay', handleCanPlay);
                this.videoElement.removeEventListener('error', handleError);
                this.videoElement.removeEventListener('loadstart', handleLoadStart);
                console.log(`✅ VideoPlayer v4.0: Video loaded successfully: ${filePath}`);
                this.currentPlayerType = 'local';
                this.showVideo();
                resolve();
            };

            // Handle load error
            const handleError = (e) => {
                clearTimeout(loadTimeout);
                this.videoElement.removeEventListener('canplay', handleCanPlay);
                this.videoElement.removeEventListener('error', handleError);
                this.videoElement.removeEventListener('loadstart', handleLoadStart);
                console.error(`🚨 VideoPlayer v4.0: Video error for ${filePath}:`, e);
                console.error(`🚨 Error details - Type: ${e.type}, Target: ${e.target?.tagName}, Src: ${e.target?.src}`);
                reject(new Error(`Failed to load video: ${e.type}`));
            };

            // Handle load start (shows we're getting data)
            const handleLoadStart = () => {
                console.log(`🎯 VideoPlayer v4.0: Video load started: ${filePath}`);
            };

            this.videoElement.addEventListener('canplay', handleCanPlay);
            this.videoElement.addEventListener('error', handleError);
            this.videoElement.addEventListener('loadstart', handleLoadStart);

            // Load the video
            this.videoElement.load();
        });
    }

    /**
     * Load local video using File System Access API
     */
    async loadLocalVideoFSA(videoData, dataManager) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`🎬 Loading video via File System Access API: ${videoData.video_id}`);
                
                // Get file handle from data manager
                const fileHandle = await dataManager.getVideoFileHandle(videoData.video_id);
                const file = await fileHandle.getFile();
                
                // Create blob URL for the video file
                const blobUrl = URL.createObjectURL(file);
                console.log(`🎬 Created blob URL for video: ${fileHandle.name}`);
                
                // Handle successful load
                const handleCanPlay = () => {
                    clearTimeout(loadTimeout);
                    this.videoElement.removeEventListener('canplay', handleCanPlay);
                    this.videoElement.removeEventListener('error', handleError);
                    this.videoElement.removeEventListener('loadstart', handleLoadStart);
                    console.log(`✅ File System Access video loaded successfully: ${fileHandle.name}`);
                    this.currentPlayerType = 'local';
                    this.showVideo();
                    resolve();
                };

                // Handle load error
                const handleError = (e) => {
                    clearTimeout(loadTimeout);
                    this.videoElement.removeEventListener('canplay', handleCanPlay);
                    this.videoElement.removeEventListener('error', handleError);
                    this.videoElement.removeEventListener('loadstart', handleLoadStart);
                    URL.revokeObjectURL(blobUrl); // Clean up blob URL
                    console.error(`🚨 File System Access video error:`, e);
                    reject(new Error(`Failed to load video: ${e.type}`));
                };

                // Handle load start
                const handleLoadStart = () => {
                    console.log(`🎯 File System Access video load started: ${fileHandle.name}`);
                };

                this.videoElement.addEventListener('canplay', handleCanPlay);
                this.videoElement.addEventListener('error', handleError);
                this.videoElement.addEventListener('loadstart', handleLoadStart);

                // Show local video element and controls
                this.videoElement.style.display = 'block';
                this.customControls.style.display = 'flex';
                this.hideYouTubeEmbed();
                
                // Set video source to blob URL
                this.videoElement.src = blobUrl;
                
                // Set poster if available
                this.setVideoPoster(videoData.video_id);

                // Add timeout for loading
                const loadTimeout = setTimeout(() => {
                    this.videoElement.removeEventListener('canplay', handleCanPlay);
                    this.videoElement.removeEventListener('error', handleError);
                    this.videoElement.removeEventListener('loadstart', handleLoadStart);
                    URL.revokeObjectURL(blobUrl); // Clean up blob URL
                    reject(new Error('Video load timeout'));
                }, 30000);

                // Load the video
                this.videoElement.load();
                
            } catch (error) {
                console.error('🚨 Failed to get video file handle:', error);
                reject(error);
            }
        });
    }

    /**
     * Show YouTube fallback when local video fails
     */
    showYouTubeFallback(videoData, dataManager) {
        console.log(`🔗 Local video failed, loading YouTube player as fallback for: ${videoData.title}`);
        
        // Hide the fallback message since we're showing the actual video
        this.fallbackElement.style.display = 'none';
        
        // Load the YouTube video directly instead of just showing a link
        this.loadYouTubeVideo(videoData);
    }

    /**
     * Handle video playback errors
     */
    handleVideoError() {
        this.showLoading(false);
        
        if (this.currentVideo) {
            console.warn(`🎥 Local video failed for ${this.currentVideo.video_id}, showing fallback`);
            // You could implement retry logic here or immediately show YouTube fallback
            this.showError('Video playback failed. Please try the YouTube link.');
        }
    }

    /**
     * Show video player
     */
    showVideo() {
        this.videoElement.style.display = 'block';
        this.fallbackElement.style.display = 'none';
        this.showLoading(false);
        this.showPlayOverlay(); // Show play button when video loads
    }

    /**
     * Hide video player
     */
    hideVideo() {
        this.videoElement.style.display = 'none';
        this.hidePlayOverlay(); // Hide play button when video is hidden
    }

    /**
     * Show loading state
     */
    showLoading(show) {
        if (show) {
            this.videoElement.classList.add('video-loading');
        } else {
            this.videoElement.classList.remove('video-loading');
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.fallbackElement.style.display = 'block';
        const alertElement = this.fallbackElement.querySelector('.alert');
        if (alertElement) {
            alertElement.innerHTML = `
                <i class="bi bi-exclamation-triangle"></i>
                ${message} <a href="#" id="openYouTubeLink" target="_blank">Watch on YouTube</a>
            `;
        }
    }

    /**
     * Hide error message
     */
    hideError() {
        this.fallbackElement.style.display = 'none';
    }

    /**
     * Show play overlay button
     */
    showPlayOverlay() {
        if (this.playOverlay) {
            this.playOverlay.style.display = 'flex';
        }
        if (this.videoContainer) {
            this.videoContainer.classList.remove('playing');
        }
    }

    /**
     * Hide play overlay button
     */
    hidePlayOverlay() {
        if (this.playOverlay) {
            this.playOverlay.style.display = 'none';
        }
        if (this.videoContainer) {
            this.videoContainer.classList.add('playing');
        }
    }

    /**
     * Hide YouTube embed
     */
    hideYouTubeEmbed() {
        if (this.youtubeIframe) {
            this.youtubeIframe.style.display = 'none';
        }
    }

    /**
     * Play video
     */
    play() {
        if (this.videoElement.src) {
            return this.videoElement.play();
        }
    }

    /**
     * Pause video
     */
    pause() {
        this.videoElement.pause();
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Set video time
     */
    setTime(seconds) {
        this.videoElement.currentTime = seconds;
    }

    /**
     * Perform a robust seek operation
     */
    performSeek(targetTime, wasPlaying) {
        console.log(`🎯 Performing robust seek to: ${targetTime}s`);
        
        // Ensure video is in the right state
        if (this.videoElement.readyState < 2) {
            console.log(`❌ Video not ready for seeking (readyState: ${this.videoElement.readyState})`);
            return;
        }

        return new Promise((resolve) => {
            let seekAttempts = 0;
            const maxAttempts = 3;
            
            const attemptSeek = () => {
                seekAttempts++;
                console.log(`  - Seek attempt ${seekAttempts}: setting currentTime to ${targetTime}s`);
                
                // Store the target for verification
                const targetTimeToSet = targetTime;
                
                // Set the time
                this.videoElement.currentTime = targetTimeToSet;
                
                // Check immediately if it was set correctly
                setTimeout(() => {
                    const actualTime = this.videoElement.currentTime;
                    console.log(`  - After setting: target=${targetTimeToSet}s, actual=${actualTime}s`);
                    
                    // If the time wasn't set correctly and we haven't exhausted attempts
                    if (Math.abs(actualTime - targetTimeToSet) > 1 && seekAttempts < maxAttempts) {
                        console.log(`  - Seek didn't stick, retrying... (attempt ${seekAttempts + 1})`);
                        setTimeout(attemptSeek, 100);
                    } else {
                        // Seek completed (or we've exhausted attempts)
                        console.log(`  - Seek ${seekAttempts < maxAttempts ? 'completed' : 'failed'} at ${actualTime}s`);
                        
                        // Resume playback if it was playing
                        if (wasPlaying) {
                            console.log(`  - Resuming playback`);
                            this.videoElement.play().catch(e => console.log('Play after seek failed:', e));
                        }
                        
                        resolve(actualTime);
                    }
                }, 50);
            };
            
            // Start the seek attempt
            attemptSeek();
        });
    }

    /**
     * Get video duration
     */
    getDuration() {
        return this.videoElement.duration || 0;
    }

    /**
     * Get current time
     */
    getCurrentTime() {
        return this.videoElement.currentTime || 0;
    }

    /**
     * Set volume (0-1)
     */
    setVolume(volume) {
        this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Get volume (0-1)
     */
    getVolume() {
        return this.videoElement.volume;
    }

    /**
     * Set muted state
     */
    setMuted(muted) {
        this.videoElement.muted = muted;
    }

    /**
     * Check if muted
     */
    isMuted() {
        return this.videoElement.muted;
    }

    /**
     * Enter fullscreen
     */
    enterFullscreen() {
        if (this.videoElement.requestFullscreen) {
            this.videoElement.requestFullscreen();
        } else if (this.videoElement.webkitRequestFullscreen) {
            this.videoElement.webkitRequestFullscreen();
        } else if (this.videoElement.mozRequestFullScreen) {
            this.videoElement.mozRequestFullScreen();
        }
    }

    /**
     * Exit fullscreen
     */
    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        }
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (this.isFullscreen()) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    /**
     * Check if in fullscreen
     */
    isFullscreen() {
        return !!(document.fullscreenElement || 
                 document.webkitFullscreenElement || 
                 document.mozFullScreenElement);
    }

    /**
     * Get video metadata
     */
    getMetadata() {
        return {
            duration: this.getDuration(),
            currentTime: this.getCurrentTime(),
            volume: this.getVolume(),
            muted: this.isMuted(),
            paused: this.videoElement.paused,
            ended: this.videoElement.ended,
            readyState: this.videoElement.readyState,
            videoWidth: this.videoElement.videoWidth,
            videoHeight: this.videoElement.videoHeight
        };
    }

    /**
     * Update progress bar
     */
    updateProgress() {
        if (this.videoElement.duration) {
            const percentage = (this.videoElement.currentTime / this.videoElement.duration) * 100;
            
            if (this.progressBar) {
                this.progressBar.style.width = `${percentage}%`;
            }
            this.updateTimeDisplay();
        }
    }

    /**
     * Update time display
     */
    updateTimeDisplay() {
        if (this.timeDisplay) {
            const current = this.formatTime(this.videoElement.currentTime || 0);
            const duration = this.formatTime(this.videoElement.duration || 0);
            this.timeDisplay.textContent = `${current} / ${duration}`;
        }
    }

    /**
     * Update play/pause icon
     */
    updatePlayPauseIcon() {
        if (this.playPauseBtn) {
            const icon = this.playPauseBtn.querySelector('i');
            if (icon) {
                icon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
            }
        }
    }

    /**
     * Update volume icon
     */
    updateVolumeIcon() {
        if (this.muteBtn) {
            const icon = this.muteBtn.querySelector('i');
            if (icon) {
                const volume = this.videoElement.volume;
                if (this.videoElement.muted || volume === 0) {
                    icon.className = 'fas fa-volume-mute';
                } else if (volume < 0.5) {
                    icon.className = 'fas fa-volume-down';
                } else {
                    icon.className = 'fas fa-volume-up';
                }
            }
        }
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        this.videoElement.muted = !this.videoElement.muted;
        this.updateVolumeIcon();
        if (this.volumeSlider) {
            this.volumeSlider.value = this.videoElement.muted ? 0 : this.videoElement.volume * 100;
        }
    }

    /**
     * Handle progress bar dragging
     */
    handleProgressDrag(e) {
        if (!this.progressContainer) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const rect = this.progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const duration = this.videoElement.duration;
        
        console.log(`🎯 Drag: ${percentage * 100}% at ${clickX}px of ${rect.width}px`);
        
        if (duration && !isNaN(duration) && duration > 0) {
            const newTime = duration * percentage;
            this.videoElement.currentTime = newTime;
            this.updateProgress(); // Force immediate visual update
        }
    }

    /**
     * Format time helper
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.pause();
        this.videoElement.src = '';
        this.videoElement.load();
        this.currentVideo = null;
    }

    /**
     * Set video poster with fallback logic
     */
    async setVideoPoster(videoId) {
        const thumbnailUrls = [
            `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            `https://img.youtube.com/vi/${videoId}/default.jpg`
        ];
        
        for (const url of thumbnailUrls) {
            try {
                const success = await this.testThumbnailUrl(url);
                if (success) {
                    this.videoElement.poster = url;
                    console.log(`🎞️ Set video poster: ${url}`);
                    return;
                }
            } catch (error) {
                continue;
            }
        }
        
        // If all fail, don't set a poster
        console.log(`🎞️ No valid poster found for video: ${videoId}`);
    }

    /**
     * Test if a thumbnail URL is valid
     */
    testThumbnailUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            
            img.onload = () => {
                if (img.naturalWidth > 120 && img.naturalHeight > 90) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            
            img.onerror = () => resolve(false);
            
            setTimeout(() => resolve(false), 2000);
            
            img.src = url;
        });
    }
}

// Utility functions for video handling
class VideoUtils {
    /**
     * Generate video thumbnail URL from YouTube
     */
    static getYouTubeThumbnail(videoId, quality = 'maxresdefault') {
        // Available qualities: default, mqdefault, hqdefault, sddefault, maxresdefault
        return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
    }

    /**
     * Extract video ID from YouTube URL
     */
    static extractVideoId(url) {
        const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    /**
     * Generate YouTube embed URL
     */
    static getYouTubeEmbedUrl(videoId, options = {}) {
        const params = new URLSearchParams({
            autoplay: options.autoplay ? '1' : '0',
            mute: options.mute ? '1' : '0',
            controls: options.controls !== false ? '1' : '0',
            start: options.start || '0',
            ...options.extraParams
        });
        
        return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
    }

    /**
     * Check if browser supports video format
     */
    static canPlayFormat(format) {
        const video = document.createElement('video');
        return video.canPlayType(format) !== '';
    }

    /**
     * Get supported video formats
     */
    static getSupportedFormats() {
        const video = document.createElement('video');
        const formats = {
            mp4: video.canPlayType('video/mp4'),
            webm: video.canPlayType('video/webm'),
            ogg: video.canPlayType('video/ogg'),
            mov: video.canPlayType('video/quicktime')
        };
        
        return Object.entries(formats)
            .filter(([format, support]) => support !== '')
            .map(([format, support]) => ({ format, support }));
    }
}

// Export for use in other modules
window.VideoPlayer = VideoPlayer;
window.VideoUtils = VideoUtils; 