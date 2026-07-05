import base64
import os
import sys
from hmac import compare_digest
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def validate_target(raw: str) -> Path:
    path = Path(raw)
    if not path.is_absolute() or path.suffix.lower() not in {".exe", ".lnk"} or not path.is_file():
        raise ValueError("invalid target")
    return path.resolve()


def parse_request(uri: str, secret: str) -> Path:
    parsed = urlparse(uri)
    if parsed.scheme != "aura-launch" or parsed.netloc != "open":
        raise ValueError("bad action")
    query = parse_qs(parsed.query)
    if not secret or not compare_digest(query.get("token", [""])[0], secret):
        raise ValueError("bad token")
    raw = base64.urlsafe_b64decode(query.get("target", [""])[0] + "===").decode("utf-8")
    return validate_target(raw)


def main() -> int:
    try:
        secret = Path(__file__).with_name("secret.txt").read_text(encoding="utf-8").strip()
        target = parse_request(sys.argv[1], secret)
        os.startfile(target)
    except (IndexError, OSError, UnicodeError, ValueError):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
