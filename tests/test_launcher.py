import base64
import importlib.util
import tempfile
import unittest
from pathlib import Path
from urllib.parse import quote


MODULE_PATH = Path(__file__).parents[1] / "launcher-helper" / "launcher.py"


def load_launcher():
    spec = importlib.util.spec_from_file_location("aura_launcher", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def make_uri(token, target):
    encoded = base64.urlsafe_b64encode(str(target).encode()).decode().rstrip("=")
    return f"aura-launch://open?token={quote(token)}&target={encoded}"


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.exe = self.root / "app.exe"
        self.link = self.root / "app.lnk"
        self.exe.touch()
        self.link.touch()

    def tearDown(self):
        self.temp.cleanup()

    def test_rejects_wrong_secret(self):
        launcher = load_launcher()
        with self.assertRaises(ValueError):
            launcher.parse_request(make_uri("wrong", self.exe), "correct")

    def test_rejects_relative_and_unsupported_paths(self):
        launcher = load_launcher()
        for target in ("calc.exe", str(self.root / "note.txt")):
            with self.subTest(target=target), self.assertRaises(ValueError):
                launcher.validate_target(target)

    def test_accepts_existing_exe_and_shortcut(self):
        launcher = load_launcher()
        self.assertEqual(launcher.validate_target(str(self.exe)), self.exe.resolve())
        self.assertEqual(launcher.validate_target(str(self.link)), self.link.resolve())

    def test_parses_a_valid_request(self):
        launcher = load_launcher()
        self.assertEqual(launcher.parse_request(make_uri("secret", self.exe), "secret"), self.exe.resolve())


if __name__ == "__main__":
    unittest.main()
