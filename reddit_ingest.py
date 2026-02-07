import urllib.request
import json
import time
import xml.etree.ElementTree as ET
import os
import hashlib
import sys
from datetime import datetime

# Ensure console handles emojis/unicode
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

CONFIG = {
    "subreddits": ["stocks", "investing", "wallstreetbets", "pennystocks", "cryptocurrency"],
    "pushshift_base": "https://api.pushshift.io/reddit",
    "output_file": "data/reddit_ingested.json",
    "post_score_threshold": 20,
    "post_comment_threshold": 20,
    "comment_score_threshold": 10,
    "recency_hours": 24
}

def hash_author(author):
    if not author: return "anonymous"
    return "user_" + hashlib.md5(author.encode()).hexdigest()[:8]

def fetch_reddit_json(url, retries=3):
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebkit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                if i == retries - 1:
                    print(f"!!! CRITICAL: Rate limited (429) retries exhausted for {url}. Exiting. !!!")
                    sys.exit(1)
                wait = (i + 2) * 5 # More aggressive backoff
                print(f"  Rate limited (429). Waiting {wait}s and retrying...")
                time.sleep(wait)
                continue
            if e.code == 403:
                print(f"!!! CRITICAL: Access Forbidden (403). Reddit is likely blocking the CI runner. Exiting. !!!")
                sys.exit(1)
            print(f"Error fetching from {url}: {e}")
            return None
        except Exception as e:
            print(f"Error fetching from {url}: {e}")
            return None
    return None

def ingest_subreddit(sub, days_back, sort_type, output_file, score_thresh, comment_thresh):
    all_ingested = {}
    print(f"Processing r/{sub} ({sort_type}, {days_back}d)...")
    
    url = f"https://www.reddit.com/r/{sub}/{sort_type}.json?limit=100"
    data = fetch_reddit_json(url)
    
    if not data or 'data' not in data:
        print(f"  Failed to get data for r/{sub}")
        return []

    posts = data['data']['children']
    for p_wrap in posts:
        p = p_wrap['data']
        
        now = time.time()
        is_recent = (now - p['created_utc']) < (days_back * 3600 * 24)
        
        # Only filter if thresholds are > 0
        has_engagement = True
        if score_thresh > 0:
            has_engagement = has_engagement and p.get('score', 0) > score_thresh
        if comment_thresh > 0:
            has_engagement = has_engagement and p.get('num_comments', 0) > comment_thresh
        
        if is_recent and has_engagement:
            post_data = {
                "post_id": p['id'],
                "subreddit": sub,
                "title": p['title'],
                "body": p.get('selftext', ''),
                "url": f"https://www.reddit.com{p['permalink']}",
                "created_utc": p['created_utc'],
                "score": p['score'],
                "num_comments": p['num_comments'],
                "author_hash": hash_author(p['author']),
                "comments": []
            }
            
            print(f"  Fetching comments for: {p['title'][:50]}...")
            comment_url = f"https://www.reddit.com/comments/{p['id']}.json?limit=50&sort=top"
            comment_data = fetch_reddit_json(comment_url)
            time.sleep(0.5)
            
            if comment_data and len(comment_data) > 1:
                raw_comments = comment_data[1]['data']['children']
                filtered_comments = []
                for c_wrap in raw_comments:
                    if c_wrap['kind'] == 't1':
                        c = c_wrap['data']
                        # Only filter by score if thresholds are > 0
                        if (score_thresh == 0 or c.get('score', 0) > CONFIG["comment_score_threshold"]) and c.get('body') not in ['[deleted]', '[removed]']:
                            filtered_comments.append({
                                "comment_id": c['id'],
                                "body": c['body'],
                                "score": c['score'],
                                "author_hash": hash_author(c['author']),
                                "created_utc": c['created_utc']
                            })
            
                filtered_comments.sort(key=lambda x: x['score'], reverse=True)
                post_data["comments"] = filtered_comments[:10]
            
            all_ingested[p['id']] = post_data
    
    final_list = sorted(all_ingested.values(), key=lambda x: x['score'], reverse=True)
    # Take only top 10
    final_list = final_list[:10]
    return final_list

def main():
    if not os.path.exists('data'):
        os.makedirs('data')

    print("Starting Ingestion Sub-Agent (Python Edition)...")

    # Job 1: Hot Discussions (24h)
    print("\n--- JOB 1: HOT DISCUSSIONS ---")
    temp_all_hot = []
    for sub in CONFIG["subreddits"]:
        posts = ingest_subreddit(sub, 1, "hot", "", CONFIG["post_score_threshold"], CONFIG["post_comment_threshold"])
        if posts:
            temp_all_hot.extend(posts)
        print("  Waiting 3s before next subreddit...")
        time.sleep(1) # Reduced from 3s for faster local execution
    
    # FAILSAFE: If we found no posts, do NOT overwrite the data file.
    # Exiting with 1 will cause the GitHub Action to fail and stop the deploy.
    if len(temp_all_hot) < 5:
        print(f"\n!!! FAILSAFE TRIGGERED !!!")
        print(f"Only {len(temp_all_hot)} posts found. This is too low.")
        print("Aborting to prevent overwriting dashboard with empty data.")
        sys.exit(1)

    temp_all_hot.sort(key=lambda x: x['score'], reverse=True)
    hot_output = {
        "ingested_at": datetime.now().isoformat(),
        "posts": temp_all_hot[:20] # Keep top 20 for hot
    }
    with open(CONFIG["output_file"], 'w', encoding='utf-8') as f:
        json.dump(hot_output, f, indent=4)
    print(f"TOTAL HOT: {len(temp_all_hot)} surfaced. Saved to {CONFIG['output_file']}")

    # Job 2: Long Term Investment (1 week)
    print("\n--- JOB 2: LONG TERM INVESTING (r/financialindependence) ---")
    lt_posts = ingest_subreddit("financialindependence", 7, "top", "", 0, 0)
    lt_output = {
        "ingested_at": datetime.now().isoformat(),
        "posts": (lt_posts or [])[:10]
    }
    with open("data/long_term_ingested.json", 'w', encoding='utf-8') as f:
        json.dump(lt_output, f, indent=4)
    print(f"LONG TERM: {len(lt_posts or [])} surfaced. Saved to data/long_term_ingested.json")

    print("\nAll Ingestion Tasks Complete.")

import traceback

if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("\n!!! SCRIPT CRASHED !!!")
        traceback.print_exc()
        sys.exit(1)
