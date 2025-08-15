# Pre-indexing for Faster Loading

The Medical Medium Archive Tool now supports pre-indexing to dramatically reduce loading times from ~30 seconds to just a few seconds.

## What is Pre-indexing?

Pre-indexing processes the raw comment data ahead of time and creates optimized data structures that can be loaded instantly by the browser. Instead of processing 82,000 comments every time the app starts, the browser loads pre-computed indexes.

## How to Use Pre-indexing

### 1. Run the Pre-indexing Script

After updating your data (videos.json or comments.json), run:

```bash
python3 preindex_comments.py
```

This will create three optimized files in the `data/` directory:
- `video_comments_index.json` (38MB) - Comments organized by video for instant access
- `search_index.json` (47MB) - Search-optimized comment data
- `word_freq_index.json` (0.6MB) - Pre-computed word clouds and insights

### 2. The App Automatically Uses Pre-indexed Data

The app will automatically detect and use the pre-indexed files if they exist. If not available, it falls back to the original loading method.

## Performance Benefits

| Loading Method | Load Time | Memory Usage | User Experience |
|----------------|-----------|--------------|-----------------|
| Original | ~30 seconds | High CPU usage | Slow, blocking |
| Pre-indexed | ~3 seconds | Minimal CPU | Fast, smooth |

## File Sizes

- **Original comments.json**: 46MB
- **Pre-indexed files total**: 85MB
- **Trade-off**: ~40MB extra storage for 10x faster loading

## When to Re-run Pre-indexing

Re-run the pre-indexing script whenever:
- You update the source data files (videos.json or comments.json)
- You want to refresh the word frequency analysis
- You modify the indexing algorithm

## Technical Details

The pre-indexing script:

1. **Video-Comment Index**: Groups all comments by video_id with optimized sorting
2. **Search Index**: Creates word-based search structures for faster text queries  
3. **Word Frequency Index**: Pre-computes word clouds and engagement analysis for all videos
4. **Maintains Compatibility**: The app works with or without pre-indexed files

## Recommendation

For the best user experience, always run pre-indexing after data updates. The one-time 30-second indexing process saves users 27+ seconds every time they open the app. 