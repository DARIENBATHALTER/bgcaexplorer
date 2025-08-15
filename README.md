# Medical Medium YouTube Archive Explorer

A web-based application for exploring downloaded YouTube videos and comments from the Medical Medium channel. Now supports both local development and hosted deployment!

## 🌟 Features

- **Video Grid & Detail Views**: Browse and watch videos with custom controls
- **Advanced Search**: Search through video titles, descriptions, and comments
- **Comment Analysis**: View comment insights and word clouds
- **Export Functionality**: Export comments to various formats
- **Responsive Design**: Works on desktop and mobile devices
- **Dual Mode Support**: Local development or hosted deployment

## 🚀 Deployment Options

### Option 1: Hosted Mode (Recommended)

Deploy to GitHub Pages, Netlify, Vercel, or any static hosting service. Users select their local video directory using the browser's File System Access API.

**Supported Browsers**: Chrome, Edge (latest versions)

1. Deploy the entire project to your hosting service
2. Users visit the hosted URL
3. On first load, they select their local video directory
4. Videos stream directly from their local files

**Benefits:**
- ✅ Easy sharing via URL
- ✅ No local server setup required
- ✅ Automatic updates when you redeploy
- ✅ Works from any device with supported browser

### Option 2: Local Development Mode

Run locally using Python's built-in HTTP server. Supports all browsers.

1. Place your video files in `YouTube_Downloads/` directory
2. Ensure `data/video-mapping.json` exists
3. Run: `python -m http.server 8080`
4. Open: `http://localhost:8080`
5. Click "Use Local Server" if prompted

**Benefits:**
- ✅ Works in all browsers (Firefox, Safari, etc.)
- ✅ Full file system access
- ✅ No directory selection needed

## 📁 Required Files Structure

```
MMArchiveTool/
├── YouTube_Downloads/          # Your downloaded video files
├── data/
│   ├── video-mapping.json     # Required: Video metadata
│   ├── videos.json            # Optional: Video list
│   └── comments.json          # Optional: Comment data
├── css/                       # Styling files
├── js/                        # Application logic
└── index.html                # Main entry point
```

## 🎮 Usage

### First Time Setup (Hosted Mode)

1. Visit the hosted application URL
2. Your browser will check File System Access API support:
   - **Supported**: Click "Select Video Folder" and choose your video directory
   - **Not Supported**: Follow local server instructions

### Directory Selection

The app will scan your selected directory for:
- Video files: `.mp4`, `.webm`, `.ogg`, `.mov`, `.avi`

**Note**: Metadata (`video-mapping.json`, `videos.json`, `comments.json`) is served from the hosted app, not from your local directory. Users only need to select their video files folder.

### Video Playback

- **Hosted Mode**: Videos loaded as blob URLs (uses RAM)
- **Local Mode**: Videos streamed from local server

## 🛠️ Development

### Local Development

```bash
# Start local server
python -m http.server 8080

# Visit in browser
open http://localhost:8080
```

### Deployment to GitHub Pages

1. Push code to GitHub repository
2. Enable GitHub Pages in repository settings
3. Deploy from main branch or docs folder
4. Share the GitHub Pages URL

### Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| Hosted Mode | ✅ | ✅ | ❌ | ❌ |
| Local Mode | ✅ | ✅ | ✅ | ✅ |

## 📋 Data Format

### video-mapping.json
```json
{
  "video_id_1": {
    "video_id": "video_id_1",
    "title": "Video Title",
    "description": "Video description...",
    "published_at": "2024-01-01T00:00:00Z",
    "view_count": 12345,
    "comment_count": 67,
    "file_path": "YouTube_Downloads/video_file.mp4"
  }
}
```

## 🔧 Technical Details

### File System Access API
- Provides secure access to local files
- No data uploaded to server
- Files read directly in browser
- Requires user permission per session

### Fallback Mode
- Uses traditional HTTP server approach
- Broader browser compatibility
- Requires local server setup

## 📝 License

© 2025 Darien Bathalter - Created for Medical Medium Archive exploration

## 🤝 Support

For issues or custom development:
- Email: me@darienbathalter.com
- Phone: (904) 572-6183 