/**
 * ModeManager - Handles switching between Local Archive and YouTube modes
 * Provides unified interface for different video sources
 */
class ModeManager {
    constructor() {
        this.currentMode = null; // 'local' or 'youtube'
        this.directoryManager = new DirectoryManager();
        this.videoMapping = null;
        
        console.log('🎛️ ModeManager initialized');
    }

    /**
     * Set application mode
     */
    setMode(mode) {
        this.currentMode = mode;
        console.log(`🎛️ Mode set to: ${mode}`);
        
        // Update UI to reflect current mode
        this.updateModeIndicator();
    }

    /**
     * Get current mode
     */
    getCurrentMode() {
        return this.currentMode;
    }

    /**
     * Check if current mode is local archive
     */
    isLocalMode() {
        return this.currentMode === 'local';
    }

    /**
     * Check if current mode is YouTube
     */
    isYouTubeMode() {
        return this.currentMode === 'youtube';
    }

    /**
     * Initialize Local Archive mode
     */
    async initializeLocalMode() {
        try {
            console.log('🎛️ Initializing Local Archive mode...');
            
            // Check File System Access API support
            if (this.directoryManager.isSupported) {
                // Request directory access
                await this.directoryManager.requestDirectory();
                
                // Scan directory for files
                const scanResult = await this.directoryManager.scanDirectory();
                
                // Skip video mapping for BGCA - using archive loader instead
                console.log('🎛️ Skipping video mapping load - using archive loader for BGCA');
                this.videoMapping = {};
                
                console.log(`🎛️ Local mode initialized: ${scanResult.videoFiles.size} files found`);
                return {
                    success: true,
                    directoryName: this.directoryManager.getDirectoryName(),
                    fileCount: scanResult.videoFiles.size
                };
            } else {
                // Fallback to local server mode
                console.log('🎛️ Using local server fallback');
                return {
                    success: true,
                    directoryName: 'Local Server',
                    fileCount: 'Available via localhost:8080'
                };
            }
        } catch (error) {
            console.error('🎛️ Failed to initialize local mode:', error);
            throw error;
        }
    }

    /**
     * Initialize YouTube mode
     */
    async initializeYouTubeMode() {
        try {
            console.log('🎛️ Initializing YouTube mode...');
            
            // Skip video mapping for BGCA - using archive loader instead
            console.log('🎛️ Skipping video mapping load - using archive loader for BGCA');
            this.videoMapping = {};
            
            console.log('🎛️ YouTube mode initialized successfully');
            return {
                success: true,
                message: 'YouTube mode ready - videos will stream from YouTube'
            };
        } catch (error) {
            console.error('🎛️ Failed to initialize YouTube mode:', error);
            throw error;
        }
    }

    /**
     * Get video source URL based on current mode
     */
    async getVideoSource(videoId, filePath) {
        if (this.currentMode === 'local') {
            if (this.directoryManager.isSupported && this.directoryManager.isDirectorySelected()) {
                // Use File System Access API
                return await this.directoryManager.getVideoBlob(filePath);
            } else {
                // Use local server
                return filePath;
            }
        } else if (this.currentMode === 'youtube') {
            // Return YouTube embed URL
            return `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
        }
        
        throw new Error(`Unknown mode: ${this.currentMode}`);
    }

    /**
     * Get video player type based on current mode
     */
    getPlayerType() {
        return this.currentMode === 'youtube' ? 'youtube' : 'local';
    }

    /**
     * Update mode indicator in header
     */
    updateModeIndicator() {
        const header = document.querySelector('.navbar-brand span');
        if (header) {
            // Keep the title simple, let the badge show the mode
            header.textContent = 'Medical Medium Archive Explorer';
        }

        // Add mode badge to header
        const existingBadge = document.querySelector('.mode-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        const navbar = document.querySelector('.navbar-brand');
        if (navbar) {
            const badge = document.createElement('span');
            badge.className = `badge ${this.currentMode === 'youtube' ? 'bg-danger' : 'bg-primary'} mode-badge ms-2`;
            badge.innerHTML = this.currentMode === 'youtube' ? 
                '<i class="bi bi-youtube"></i> YouTube' : 
                '<i class="bi bi-folder"></i> Local';
            
            // Check if we're on mobile
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // On mobile, create a container for actions under the title
                let mobileActions = document.querySelector('.mobile-header-actions');
                if (!mobileActions) {
                    mobileActions = document.createElement('div');
                    mobileActions.className = 'mobile-header-actions';
                    navbar.appendChild(mobileActions);
                }
                
                // Clear and add badge to mobile actions container
                mobileActions.innerHTML = '';
                badge.className = badge.className.replace('ms-2', ''); // Remove margin
                mobileActions.appendChild(badge);
            } else {
                // On desktop, add badge directly to navbar
                navbar.appendChild(badge);
            }
        }
        
        // Listen for window resize to update layout
        window.addEventListener('resize', () => {
            // Re-run this method on resize to handle layout changes
            setTimeout(() => this.updateModeIndicator(), 100);
        });
    }

    /**
     * Switch modes (for future enhancement)
     */
    async switchMode(newMode) {
        if (newMode === this.currentMode) {
            return;
        }

        console.log(`🎛️ Switching from ${this.currentMode} to ${newMode}`);
        
        if (newMode === 'local') {
            await this.initializeLocalMode();
        } else if (newMode === 'youtube') {
            await this.initializeYouTubeMode();
        }

        this.setMode(newMode);
    }

    /**
     * Get statistics for current mode
     */
    getStats() {
        return {
            mode: this.currentMode,
            isLocalMode: this.isLocalMode(),
            isYouTubeMode: this.isYouTubeMode(),
            hasDirectoryAccess: this.directoryManager?.isDirectorySelected() || false,
            directoryName: this.directoryManager?.getDirectoryName() || null
        };
    }
}

// Export for use in other modules
window.ModeManager = ModeManager; 