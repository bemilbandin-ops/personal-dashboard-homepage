import json
import urllib.request
import re

# Map of our icon IDs to Radix icon names
icon_map = {
    "i-home": "home",
    "i-spark": "lightning-bolt",
    "i-cloud": "cloud",
    "i-folder": "file",
    "i-help": "question-mark-circled",
    "i-reset": "update",
    "i-search": "magnifying-glass",
    "i-code": "code",
    "i-play": "play",
    "i-headphones": "speaker-moderate", # radix doesn't have headphones, use speaker
    "i-mail": "envelope-closed",
    "i-design": "magic-wand",
    "i-plus": "plus",
    "i-sun": "sun",
    "i-note": "pencil-1",
    "i-settings": "gear",
    "i-close": "cross-1",
    "i-clock": "clock",
    "i-alarm": "bell",
    "i-timer": "timer",
    "i-stopwatch": "stopwatch",
    "i-pause": "pause",
    "i-flag": "flag",
    "i-trash": "trash"
}

base_url = "https://raw.githubusercontent.com/radix-ui/icons/master/packages/radix-icons/icons/{}.svg"

symbols = []

for internal_id, radix_name in icon_map.items():
    url = base_url.format(radix_name)
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            svg_content = response.read().decode('utf-8')
            # Extract paths
            paths = re.findall(r'<path[^>]*>', svg_content)
            # Some radix icons have multiple paths
            paths_str = "".join(paths)
            symbols.append(f'    <symbol id="{internal_id}" viewBox="0 0 15 15">{paths_str}</symbol>')
    except Exception as e:
        print(f"Failed to fetch {radix_name}: {e}")
        # fallback to empty symbol
        symbols.append(f'    <symbol id="{internal_id}" viewBox="0 0 15 15"></symbol>')

sprite = '<svg class="svg-sprite" aria-hidden="true" style="display: none;">\n' + "\n".join(symbols) + '\n  </svg>'

# Read index.html
with open(r'd:\Codexcode\homepage\index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace SVG sprite
new_html = re.sub(r'<svg class="svg-sprite"[^>]*>.*?</svg>', sprite, html, flags=re.DOTALL)

with open(r'd:\Codexcode\homepage\index.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Icons replaced!")
