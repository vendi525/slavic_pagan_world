"""Saves the newest long video from the YouTube channel into the site.

Writes _data/latest_video.yml (id, title, date) and assets/images/latest-video.jpg.
The daily GitHub Action runs this and commits only when the video changed.
Uses the channel's long-videos list, so Shorts are skipped.
"""
import pathlib
import sys
import urllib.request
import xml.etree.ElementTree as ET

PLAYLIST = "UULFFQIPSgAB4ixVkAamAupKyQ"  # same list as youtube_videos in _data/links.yml
FEED = "https://www.youtube.com/feeds/videos.xml?playlist_id=" + PLAYLIST
ROOT = pathlib.Path(__file__).resolve().parent.parent
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def quote(text):
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main():
    entries = ET.fromstring(fetch(FEED)).findall("a:entry", NS)
    if not entries:
        sys.exit("No videos in the feed, leaving the site as it is.")
    newest = max(entries, key=lambda e: e.find("a:published", NS).text)
    video_id = newest.find("yt:videoId", NS).text
    title = newest.find("a:title", NS).text.strip()
    date = newest.find("a:published", NS).text[:10]

    data_file = ROOT / "_data" / "latest_video.yml"
    if data_file.exists() and ("id: " + quote(video_id)) in data_file.read_text():
        print("Already up to date:", video_id)
        return

    image = None
    for size in ("maxresdefault", "hqdefault"):
        try:
            image = fetch("https://i.ytimg.com/vi/%s/%s.jpg" % (video_id, size))
            break
        except Exception:
            continue
    if image:
        (ROOT / "assets" / "images" / "latest-video.jpg").write_bytes(image)

    data_file.write_text(
        "# Written by tools/update_latest_video.py every morning. Don't edit by hand.\n"
        "id: %s\ntitle: %s\ndate: %s\n" % (quote(video_id), quote(title), date)
    )
    print("New video:", video_id, title)


if __name__ == "__main__":
    main()
