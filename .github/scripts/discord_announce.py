import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path


def split_messages(header, body_lines, footer, limit):
    messages = []
    current_lines = list(header)

    for line in body_lines:
        candidate = "\n".join(current_lines + [line])
        if len(candidate) <= limit:
            current_lines.append(line)
        else:
            if current_lines:
                messages.append("\n".join(current_lines))
            current_lines = [line]

    if footer:
        candidate = "\n".join(current_lines + footer)
        if len(candidate) <= limit:
            messages.append("\n".join(current_lines + footer))
        else:
            if current_lines:
                messages.append("\n".join(current_lines))
            messages.append("\n".join(footer))
    elif current_lines:
        messages.append("\n".join(current_lines))

    return [message for message in messages if message.strip()]


def main():
    webhook = os.environ.get("DISCORD_WEBHOOK")
    version = os.environ.get("VERSION_TAG")
    repo = os.environ.get("GITHUB_REPOSITORY")
    notes_path = Path(os.environ.get("RELEASE_NOTES_FILE", "RELEASE_NOTES.md"))
    max_len = 2000

    if not webhook:
        raise SystemExit("DISCORD_WEBHOOK is required")
    if not version:
        raise SystemExit("VERSION_TAG is required")
    if not repo:
        raise SystemExit("GITHUB_REPOSITORY is required")

    header_lines = [
        "🚀 **New Release Published!**",
        f"**Version:** {version}",
        "**Changelog:**",
    ]
    download_line = f"**Download:** https://github.com/{repo}/releases/tag/{version}"

    if notes_path.exists():
        raw_lines = notes_path.read_text(encoding="utf-8").splitlines()
    else:
        raw_lines = []

    bullet_lines = [line for line in raw_lines if line.strip().startswith("- ")]
    if not bullet_lines:
        bullet_lines = [line for line in raw_lines if line.strip()]

    messages = split_messages(header_lines, bullet_lines, [download_line], max_len)
    if not messages:
        messages = ["\n".join(header_lines + [download_line])]

    for message in messages:
        if len(message) > max_len:
            raise SystemExit(f"Discord message exceeds {max_len} characters")

        payload = json.dumps({"content": message}).encode("utf-8")
        request = urllib.request.Request(
            webhook,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "manatan-release-bot/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                response.read()
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", errors="replace")
            raise SystemExit(f"Discord webhook request failed ({err.code}): {detail}")
        except urllib.error.URLError as err:
            raise SystemExit(f"Discord webhook request failed: {err}")
        time.sleep(1)


if __name__ == "__main__":
    main()
