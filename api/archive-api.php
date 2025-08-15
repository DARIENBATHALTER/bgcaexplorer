<?php
/**
 * BGCA Archive API
 * Server-side API to discover and serve archive files
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$archiveBase = dirname(__DIR__, 2) . '/bgca_yt_archive';

function extractShortcode($filename) {
    $patterns = [
        '/_([a-zA-Z0-9_-]{11})_en_auto_ytdlp/',
        '/_([a-zA-Z0-9_-]{11})_summary/',
        '/_([a-zA-Z0-9_-]{11})_comments/',
        '/_([a-zA-Z0-9_-]{11})_youtube/',
        '/_([a-zA-Z0-9_-]{11})\.mp4/',
        '/([a-zA-Z0-9_-]{11})/'
    ];
    
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $filename, $matches)) {
            return $matches[1];
        }
    }
    return null;
}

function discoverFiles($directory, $pattern = '*') {
    if (!is_dir($directory)) {
        return [];
    }
    
    $files = glob($directory . '/' . $pattern);
    return array_map('basename', $files);
}

function getFilesByShortcode($directory, $pattern, $shortcodes = null) {
    $files = discoverFiles($directory, $pattern);
    $result = [];
    
    foreach ($files as $file) {
        $shortcode = extractShortcode($file);
        if ($shortcode && ($shortcodes === null || in_array($shortcode, $shortcodes))) {
            $result[$shortcode] = $file;
        }
    }
    
    return $result;
}

// Route handling
$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'discover_transcripts':
            $files = getFilesByShortcode($archiveBase . '/bgca_yt_subtitles', '*_en_auto_ytdlp.txt');
            echo json_encode(['success' => true, 'files' => $files, 'count' => count($files)]);
            break;
            
        case 'discover_summaries':
            $files = getFilesByShortcode($archiveBase . '/bgca_yt_summaries', '*_summary.txt');
            echo json_encode(['success' => true, 'files' => $files, 'count' => count($files)]);
            break;
            
        case 'discover_comments':
            $files = getFilesByShortcode($archiveBase . '/bgca_yt_comments/video_comments', '*_comments.json');
            echo json_encode(['success' => true, 'files' => $files, 'count' => count($files)]);
            break;
            
        case 'discover_videos':
            $files = getFilesByShortcode($archiveBase . '/bgca_yt_media', '*.mp4');
            echo json_encode(['success' => true, 'files' => $files, 'count' => count($files)]);
            break;
            
        case 'get_transcript':
            $shortcode = $_GET['shortcode'] ?? '';
            if (!$shortcode) {
                throw new Exception('Shortcode required');
            }
            
            // Find the actual transcript file
            $files = getFilesByShortcode($archiveBase . '/bgca_yt_subtitles', '*_en_auto_ytdlp.txt', [$shortcode]);
            if (empty($files[$shortcode])) {
                throw new Exception('Transcript not found');
            }
            
            $filename = $files[$shortcode];
            $filepath = $archiveBase . '/bgca_yt_subtitles/' . $filename;
            
            if (!file_exists($filepath)) {
                throw new Exception('Transcript file does not exist');
            }
            
            $content = file_get_contents($filepath);
            echo json_encode([
                'success' => true,
                'video_id' => $shortcode,
                'transcript' => $content,
                'source_file' => $filename
            ]);
            break;
            
        case 'get_summary':
            $shortcode = $_GET['shortcode'] ?? '';
            if (!$shortcode) {
                throw new Exception('Shortcode required');
            }
            
            $files = getFilesByShortcode($archiveBase . '/bgca_yt_summaries', '*_summary.txt', [$shortcode]);
            if (empty($files[$shortcode])) {
                throw new Exception('Summary not found');
            }
            
            $filename = $files[$shortcode];
            $filepath = $archiveBase . '/bgca_yt_summaries/' . $filename;
            
            if (!file_exists($filepath)) {
                throw new Exception('Summary file does not exist');
            }
            
            $content = file_get_contents($filepath);
            echo json_encode([
                'success' => true,
                'video_id' => $shortcode,
                'summary' => $content,
                'source_file' => $filename
            ]);
            break;
            
        case 'get_comments':
            $shortcode = $_GET['shortcode'] ?? '';
            if (!$shortcode) {
                throw new Exception('Shortcode required');
            }
            
            $files = getFilesByShortcode($archiveBase . '/bgca_yt_comments/video_comments', '*_comments.json', [$shortcode]);
            if (empty($files[$shortcode])) {
                throw new Exception('Comments not found');
            }
            
            $filename = $files[$shortcode];
            $filepath = $archiveBase . '/bgca_yt_comments/video_comments/' . $filename;
            
            if (!file_exists($filepath)) {
                throw new Exception('Comments file does not exist');
            }
            
            $content = file_get_contents($filepath);
            $data = json_decode($content, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('Invalid JSON in comments file');
            }
            
            echo json_encode([
                'success' => true,
                'video_id' => $shortcode,
                'comments' => $data['comments'] ?? [],
                'source_file' => $filename
            ]);
            break;
            
        case 'discover_all':
            $result = [
                'success' => true,
                'discovery' => [
                    'transcripts' => getFilesByShortcode($archiveBase . '/bgca_yt_subtitles', '*_en_auto_ytdlp.txt'),
                    'summaries' => getFilesByShortcode($archiveBase . '/bgca_yt_summaries', '*_summary.txt'),
                    'comments' => getFilesByShortcode($archiveBase . '/bgca_yt_comments/video_comments', '*_comments.json'),
                    'videos' => getFilesByShortcode($archiveBase . '/bgca_yt_media', '*.mp4')
                ]
            ];
            
            // Calculate totals
            $allShortcodes = array_unique(array_merge(
                array_keys($result['discovery']['transcripts']),
                array_keys($result['discovery']['summaries']),
                array_keys($result['discovery']['comments']),
                array_keys($result['discovery']['videos'])
            ));
            
            $result['totals'] = [
                'unique_videos' => count($allShortcodes),
                'transcripts' => count($result['discovery']['transcripts']),
                'summaries' => count($result['discovery']['summaries']),
                'comments' => count($result['discovery']['comments']),
                'video_files' => count($result['discovery']['videos'])
            ];
            
            echo json_encode($result);
            break;
            
        default:
            throw new Exception('Invalid action');
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>