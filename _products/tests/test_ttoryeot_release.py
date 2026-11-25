"""Focused checks for the current Ttoryeot desktop download information."""
import json
import unittest
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = json.loads((ROOT / "_products/ttoryeot-desktop.json").read_text())
ITEMS = {item["os"]: item for item in DATA["downloads"]}
BASE = "https://github.com/207studio-oss/ttoryeot-desktop/releases/download"
PAGES = {"en": ROOT / "ttoryeot/index.html", "ko": ROOT / "ko/ttoryeot/index.html"}


class DesktopReleaseTest(unittest.TestCase):
    def test_windows_installer(self):
        item = ITEMS["windows"]
        url = "https://github.com/207studio-oss/ttoryeot-desktop/releases/latest"
        self.assertEqual(item["href"], url)
        for lang, page in PAGES.items():
            html = unescape(page.read_text())
            self.assertIn(url, html)
            self.assertIn(item["name"][lang], html)
            self.assertIn('src="/assets/ttoryeot-windows-release.js"', html)
            self.assertIn("data-tt-windows-sums hidden", html)
            self.assertIn(DATA["windows_checksums"][lang], html)

    def test_mac_and_checksums(self):
        url = f"{BASE}/v0.2.5/ttoryeot-desktop-0.2.5-macos-universal.dmg"
        self.assertEqual(ITEMS["mac"]["href"], url)
        self.assertEqual(DATA["checksums"]["href"], f"{BASE}/v0.2.5/SHA256SUMS")
        for lang, page in PAGES.items():
            html = unescape(page.read_text())
            self.assertIn(url, html)
            self.assertIn("v0.2.5", DATA["checksums"][lang])
            self.assertIn(DATA["checksums"][lang], html)

    def test_cli_mcp_versions(self):
        for kind in ("windows-cli", "windows-cli-zip", "linux"):
            self.assertIn("v0.3.2", ITEMS[kind]["href"])
        for page in PAGES.values():
            html = unescape(page.read_text())
            for kind in ("windows-cli", "windows-cli-zip", "linux"):
                self.assertIn(ITEMS[kind]["href"], html)

    def test_windows_portable_remains_on_verified_release(self):
        item = ITEMS["windows-zip"]
        url = f"{BASE}/v0.2.5/ttoryeot-desktop-0.2.5-windows-x64.zip"
        self.assertEqual(item["href"], url)
        for lang, page in PAGES.items():
            html = unescape(page.read_text())
            self.assertIn(url, html)
            self.assertIn(item["name"][lang], html)
            self.assertIn("v0.2.5", item["name"][lang])
            self.assertNotIn(f"{BASE}/v0.2.6/ttoryeot-desktop-0.2.6-windows-x64.zip", html)

    def test_llms_platform_versions(self):
        mac = "ttoryeot-desktop/releases/tag/v0.2.5"
        windows = "https://207studio.dev/ttoryeot/#ttoryeot"
        for filename in ("llms.txt", "llms-full.txt"):
            output = (ROOT / filename).read_text()
            template = (ROOT / "_products/templates" / filename).read_text()
            line = next(line for line in output.splitlines() if "- [Ttoryeot]" in line)
            template_line = next(line for line in template.splitlines() if "- [Ttoryeot]" in line)
            self.assertEqual(template_line.replace("{{downloads}}", ""), line)
            for phrase in (mac, windows, "offers an x64 installer at", "v0.3.2"):
                self.assertIn(phrase, line)
            for phrase in ("portable ZIP", "two-page view", "annotated PDF"):
                self.assertNotIn(phrase, line)
        for lang, page in PAGES.items():
            html = unescape(page.read_text()).lower()
            excluded = ("two-page view", "annotated pdf") if lang == "en" else ("두 쪽 보기", "주석 pdf")
            for phrase in excluded:
                self.assertNotIn(phrase, html)


if __name__ == "__main__":
    unittest.main()
